from ts_runtime import run_typescript


def test_jwt_validation_rejects_inactive_and_locked_accounts():
    run_typescript(
        r"""
const assert = require('node:assert/strict');
const { AuthService } = require('./src/modules/auth/services/auth.service.ts');

const service = Object.create(AuthService.prototype);
service.logger = { debug: () => undefined, error: () => undefined };
service.usersService = {
  findOne: async () => ({
    id: 'user-1',
    isActive: false,
    isLocked: false,
  }),
};

(async () => {
  await assert.rejects(
    service.validateUser({ sub: 'user-1' }),
    error => error.status === 401,
  );

  service.usersService.findOne = async () => ({
    id: 'user-1',
    isActive: true,
    isLocked: true,
    lockedUntil: new Date(Date.now() + 60_000),
  });
  await assert.rejects(
    service.validateUser({ sub: 'user-1' }),
    error => error.status === 401,
  );
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
"""
    )


def test_expected_login_rejection_is_not_logged_as_an_application_error():
    run_typescript(
        r"""
const assert = require('node:assert/strict');
const { AuthService } = require('./src/modules/auth/services/auth.service.ts');

const errors = [];
const warnings = [];
const service = Object.create(AuthService.prototype);
service.prisma = {
  user: { findFirst: async () => null },
};
service.enqueueAuthenticationAudit = async () => undefined;
service.metrics = { recordAuthStage: () => undefined };
service.logger = {
  error: message => errors.push(message),
  warn: message => warnings.push(message),
};

(async () => {
  await assert.rejects(
    service.login({ username: 'missing-user', password: 'password' }),
    error => error.status === 401,
  );
  assert.equal(errors.length, 0);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /Username not found/);
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
"""
    )
