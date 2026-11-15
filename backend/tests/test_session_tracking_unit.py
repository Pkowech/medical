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
const queuedAuditEvents = [];
const service = Object.create(SessionTrackingService.prototype);
service.maxSessions = { student: 3 };
service.prefix = 'session:';
service.userSessionsPrefix = 'userSessions:';
service.prisma = {
  $transaction: async callback => callback({
    transaction: true,
    userSession: {
      create: async args => { created.push(args.data); },
      update: async () => undefined,
      updateMany: async args => { service.revokedWhere = args.where; },
    },
  }),
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
service.auditLogService = {
  enqueueInTransaction: async (transaction, payload) => {
    assert.equal(transaction.transaction, true);
    queuedAuditEvents.push(payload);
  },
  log: async () => undefined,
};
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
  assert.equal(queuedAuditEvents.length, 1);
  assert.equal(queuedAuditEvents[0].eventType, 'sessionCreated');
  assert.equal(queuedAuditEvents[0].userId, 'user-1');

  await service.removeSession('session-1', 'user-1');
  assert.deepEqual(blacklisted, ['access-token-secret']);
  assert.deepEqual(service.revokedWhere, {
    id: 'session-1',
    userId: 'user-1',
  });
  assert.equal(queuedAuditEvents.length, 2);
  assert.equal(queuedAuditEvents[1].eventType, 'sessionRevoked');
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
const queuedAuditEvents = [];
const service = Object.create(SessionTrackingService.prototype);
service.prefix = 'session:';
service.userSessionsPrefix = 'userSessions:';
service.prisma = {
  $transaction: async callback => callback({
    userSession: {
      updateMany: async args => { revoked.push(args.where.id); },
    },
  }),
  userSession: {
    findMany: async () => [{ id: 'session-1' }, { id: 'session-2' }],
    findFirst: async args => ({ token: `token-${args.where.id}` }),
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
service.auditLogService = {
  enqueueInTransaction: async (_transaction, payload) => {
    queuedAuditEvents.push(payload);
  },
};

(async () => {
  assert.equal(await service.revokeAllSessions('user-1'), 2);
  assert.deepEqual(revoked, [
    'token-session-1',
    'session-1',
    'token-session-2',
    'session-2',
  ]);
  assert.equal(queuedAuditEvents.length, 2);
  assert.ok(queuedAuditEvents.every(event => event.eventType === 'sessionRevoked'));
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
"""
    )


def test_revoke_all_refresh_tokens_works_without_a_redis_client_handle():
    run_typescript(
        r"""
const assert = require('node:assert/strict');
const { RefreshTokenService } =
  require('./src/modules/auth/services/refresh-token.service.ts');

const deleted = [];
const service = Object.create(RefreshTokenService.prototype);
service.userTokensPrefix = 'user_tokens:';
service.redisService = {
  getSetMembers: async key => {
    assert.equal(key, 'user_tokens:user-1');
    return ['refresh_token:first', 'refresh_token:second'];
  },
  del: async key => { deleted.push(key); },
};

(async () => {
  await service.revokeAllUserTokens('user-1');
  assert.deepEqual(deleted.sort(), [
    'refresh_token:first',
    'refresh_token:second',
    'user_tokens:user-1',
  ]);
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
"""
    )


def test_revoke_session_tokens_batches_reads_and_removes_expired_index_entries():
    run_typescript(
        r"""
const assert = require('node:assert/strict');
const { RefreshTokenService } =
  require('./src/modules/auth/services/refresh-token.service.ts');

const tokens = new Map([
  ['refresh_token:old-session', { sessionId: 'session-old' }],
  ['refresh_token:current-session', { sessionId: 'session-current' }],
]);
const removed = [];
const service = Object.create(RefreshTokenService.prototype);
service.userTokensPrefix = 'user_tokens:';
service.tokenPrefix = 'refresh_token:';
service.redisService = {
  getSetMembers: async () => [
    'refresh_token:old-session',
    'refresh_token:current-session',
    'refresh_token:expired',
  ],
  get: async key => tokens.get(key) ?? null,
  del: async key => {
    removed.push(key);
    tokens.delete(key);
  },
  removeFromSet: async (_setKey, key) => { removed.push(key); },
};

(async () => {
  await service.revokeSessionTokens('user-1', 'session-old');
  assert.equal(tokens.has('refresh_token:old-session'), false);
  assert.equal(tokens.has('refresh_token:current-session'), true);
  assert.deepEqual([...new Set(removed)].sort(), [
    'refresh_token:expired',
    'refresh_token:old-session',
  ]);
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
"""
    )
