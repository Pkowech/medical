from ts_runtime import run_typescript


def test_sessions_are_persisted_without_caching_tokens_and_revocation_blacklists_access():
    run_typescript(
        r"""
const assert = require('node:assert/strict');
const { SessionTrackingService } =
  require('./src/modules/auth/services/session-tracking.service.ts');

const created = [];
const cache = new Map();
const blacklisted = [];
const service = Object.create(SessionTrackingService.prototype);
service.maxSessions = { student: 3 };
service.prefix = 'session:';
service.userSessionsPrefix = 'userSessions:';
service.prisma = {
  userSession: {
    findUnique: async () => null,
    findMany: async () => [],
    findFirst: async args => {
      assert.deepEqual(args.where, {
        id: 'session-1',
        userId: 'user-1',
        revokedAt: null,
      });
      return { token: 'access-token-secret' };
    },
    create: async args => { created.push(args.data); },
    update: async () => undefined,
    updateMany: async args => { service.revokedWhere = args.where; },
  },
};
service.redisService = {
  set: async (key, value) => { cache.set(key, JSON.parse(value)); },
  addToSet: async () => undefined,
  del: async () => undefined,
  removeFromSet: async () => undefined,
};
service.auditLogService = { log: async () => undefined };
service.tokenBlacklistService = {
  blacklistToken: async token => { blacklisted.push(token); },
};
service.refreshTokenService = {
  revokeSessionTokens: async () => undefined,
};
service.logger = { log: () => undefined, warn: () => undefined };

(async () => {
  await service.trackSession('session-1', {
    id: 'session-1',
    userId: 'user-1',
    role: 'student',
    token: 'access-token-secret',
    ipAddress: '127.0.0.1',
    userAgent: 'test',
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 60_000),
  });
  assert.equal(created.length, 1);
  assert.equal(created[0].token, 'access-token-secret');
  assert.equal(
    Object.hasOwn(cache.get('session:session-1'), 'token'),
    false,
  );

  await service.removeSession('session-1', 'user-1');
  assert.deepEqual(blacklisted, ['access-token-secret']);
  assert.deepEqual(service.revokedWhere, {
    id: 'session-1',
    userId: 'user-1',
  });
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
"""
    )


def test_revoke_all_sessions_uses_database_records_even_if_redis_index_is_stale():
    run_typescript(
        r"""
const assert = require('node:assert/strict');
const { SessionTrackingService } =
  require('./src/modules/auth/services/session-tracking.service.ts');

const revoked = [];
const service = Object.create(SessionTrackingService.prototype);
service.prefix = 'session:';
service.userSessionsPrefix = 'userSessions:';
service.prisma = {
  userSession: {
    findMany: async () => [{ id: 'session-1' }, { id: 'session-2' }],
    findFirst: async args => ({ token: `token-${args.where.id}` }),
    updateMany: async args => { revoked.push(args.where.id); },
  },
};
service.redisService = {
  del: async () => undefined,
  removeFromSet: async () => undefined,
};
service.tokenBlacklistService = {
  blacklistToken: async token => { revoked.push(token); },
};
service.refreshTokenService = {
  revokeSessionTokens: async () => undefined,
};
service.auditLogService = { log: async () => undefined };

(async () => {
  assert.equal(await service.revokeAllSessions('user-1'), 2);
  assert.deepEqual(revoked, [
    'token-session-1',
    'session-1',
    'token-session-2',
    'session-2',
  ]);
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
"""
    )
