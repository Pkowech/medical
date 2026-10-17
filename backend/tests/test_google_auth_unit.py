from ts_runtime import run_typescript


def test_google_auth_verifies_identity_terms_and_existing_users():
    run_typescript(
        r"""
const assert = require('node:assert/strict');
const { Module } = require('node:module');
const originalLoad = Module._load;
let googleProfile = {
  sub: 'google-subject',
  email: 'student@example.com',
  email_verified: true,
  given_name: 'Medical',
  family_name: 'Student',
  picture: 'https://example.com/avatar.png',
};
let verifyError = null;
const verifyCalls = [];
class OAuth2 {
  async verifyIdToken(args) {
    verifyCalls.push(args);
    if (verifyError) throw verifyError;
    return { getPayload: () => googleProfile };
  }
}
Module._load = function (request, parent, isMain) {
  if (request === 'googleapis') return { google: { auth: { OAuth2 } } };
  return originalLoad.call(this, request, parent, isMain);
};

const { BadRequestException, ServiceUnavailableException, UnauthorizedException } =
  require('@nestjs/common');
const { Role } = require('./src/modules/auth/constants/role.constants.ts');
const { AuthService } = require('./src/modules/auth/services/auth.service.ts');
const user = {
  id: 'user-1',
  email: 'student@example.com',
  username: 'medical-student',
  firstName: 'Medical',
  lastName: 'Student',
  isActive: true,
  isLocked: false,
  lockedUntil: null,
  userRoles: [{ role: { name: Role.student } }],
};
let existing = null;
let configClientId = 'google-client-id';
const prisma = {
  user: {
    findFirst: async () => existing,
    findUnique: async () => user,
    update: async () => user,
  },
  userSecuritySettings: { upsert: async () => undefined },
};
const usersService = { create: async () => ({ id: user.id }) };
let createCalls = 0;
usersService.create = async data => {
  createCalls += 1;
  usersService.lastCreateData = data;
  return { id: user.id };
};
const service = new AuthService(
  prisma,
  { signAsync: async () => 'app-access-token' },
  { isEmailVerified: async () => true },
  { createRefreshToken: async () => 'app-refresh-token' },
  {},
  { log: async () => undefined },
  {},
  { getEffectivePermissionsForRole: async () => ['access_courses'] },
  usersService,
  {},
  {},
  { get: (key, fallback) => key === 'GOOGLE_CLIENT_ID' ? configClientId : fallback },
);

(async () => {
  existing = null;
  const created = await service.loginWithGoogle(
    { idToken: 'google-id-token', acceptTerms: true },
    '127.0.0.1',
    'test-agent',
  );
  assert.deepEqual(verifyCalls.at(-1), {
    idToken: 'google-id-token',
    audience: 'google-client-id',
  });
  assert.equal(usersService.lastCreateData.email, 'student@example.com');
  assert.equal(usersService.lastCreateData.role, Role.student);
  assert.equal(usersService.lastCreateData.acceptTerms, true);
  assert.equal(created.accessToken, 'app-access-token');
  assert.equal(created.refreshToken, 'app-refresh-token');
  assert.equal(created.user.id, user.id);
  assert.equal(created.roles.role, Role.student);

  existing = user;
  const createCallsBeforeExisting = createCalls;
  const matched = await service.loginWithGoogle({ idToken: 'google-id-token' });
  assert.equal(createCalls, createCallsBeforeExisting);
  assert.equal(matched.user.id, user.id);
  assert.equal(prisma.userSecuritySettings.upsert ? true : false, true);

  existing = null;
  await assert.rejects(
    service.loginWithGoogle({ idToken: 'google-id-token' }),
    error => error instanceof BadRequestException &&
      error.getResponse().code === 'GOOGLE_TERMS_REQUIRED',
  );
  assert.equal(createCalls, createCallsBeforeExisting);

  googleProfile = { ...googleProfile, email_verified: false };
  await assert.rejects(
    service.loginWithGoogle({ idToken: 'google-id-token', acceptTerms: true }),
    error => error instanceof UnauthorizedException,
  );
  googleProfile = {
    sub: 'google-subject',
    email: 'student@example.com',
    email_verified: true,
    given_name: 'Medical',
    family_name: 'Student',
    picture: 'https://example.com/avatar.png',
  };

  verifyError = new Error('invalid token');
  await assert.rejects(
    service.loginWithGoogle({ idToken: 'invalid-google-id-token', acceptTerms: true }),
    error => error instanceof UnauthorizedException,
  );
  verifyError = null;

  configClientId = undefined;
  await assert.rejects(
    service.loginWithGoogle({ idToken: 'google-id-token' }),
    error => error instanceof ServiceUnavailableException,
  );
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
"""
    )
