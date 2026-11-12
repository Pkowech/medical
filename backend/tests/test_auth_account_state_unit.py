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
