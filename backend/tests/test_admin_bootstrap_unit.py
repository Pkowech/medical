from ts_runtime import run_typescript


def test_initial_admin_bootstrap_is_idempotent_and_does_not_elevate_existing_users():
    run_typescript(
        r"""
const assert = require('node:assert/strict');
const argon2 = require('argon2');
const { bootstrapInitialAdmin } = require('./scripts/bootstrap-admin.ts');

let existingUser = null;
let existingAdminRole = null;
let createArgs;
let transactionCalls = 0;
const prisma = {
  role: {
    findUnique: async () => ({ id: 'admin-role' }),
  },
  user: {
    findUnique: async () => existingUser,
  },
  $transaction: async callback => {
    transactionCalls += 1;
    return callback({
      userRole: {
        findFirst: async () => existingAdminRole,
      },
      user: {
        create: async args => {
          createArgs = args;
          return { id: 'new-admin' };
        },
      },
    });
  },
};

(async () => {
  const password = 'correct horse battery staple';
  const created = await bootstrapInitialAdmin(prisma, {
    email: '  ADMIN@example.com ',
    password,
    firstName: 'Initial',
    lastName: 'Admin',
  });
  assert.deepEqual(created, { created: true, userId: 'new-admin' });
  assert.equal(createArgs.data.email, 'admin@example.com');
  assert.equal(await argon2.verify(createArgs.data.password, password), true);
  assert.deepEqual(createArgs.data.userRoles, {
    create: { roleId: 'admin-role' },
  });
  assert.deepEqual(createArgs.data.securitySettings, {
    create: { isEmailVerified: true },
  });

  existingAdminRole = { id: 'existing-admin-role' };
  await assert.rejects(
    bootstrapInitialAdmin(prisma, {
      email: 'another-admin@example.com',
      password,
    }),
    /only creates the initial administrator/,
  );
  assert.equal(transactionCalls, 2);
  existingAdminRole = null;

  existingUser = {
    id: 'existing-admin',
    userRoles: [{ role: { name: 'admin' } }],
  };
  const existingAdmin = await bootstrapInitialAdmin(prisma, {
    email: 'admin@example.com',
    password,
  });
  assert.deepEqual(existingAdmin, {
    created: false,
    userId: 'existing-admin',
  });
  assert.equal(transactionCalls, 2);

  existingUser = {
    id: 'existing-student',
    userRoles: [{ role: { name: 'student' } }],
  };
  await assert.rejects(
    bootstrapInitialAdmin(prisma, {
      email: 'admin@example.com',
      password,
    }),
    /refusing to elevate/,
  );
  assert.equal(transactionCalls, 2);

  await assert.rejects(
    bootstrapInitialAdmin(prisma, {
      email: 'new@example.com',
      password: 'short',
    }),
    /at least 16 characters/,
  );
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
"""
    )


def test_development_seed_scripts_refuse_production_mode():
    run_typescript(
        r"""
const assert = require('node:assert/strict');
process.env.NODE_ENV = 'production';

for (const seedPath of [
  './prisma/seeds/seed.ts',
  './prisma/seeds/courses.seed.ts',
  './prisma/seeds/seed_roles.ts',
]) {
  assert.throws(
    () => require(seedPath),
    /disabled in production/,
    `${seedPath} should refuse production execution`,
  );
}
"""
    )
