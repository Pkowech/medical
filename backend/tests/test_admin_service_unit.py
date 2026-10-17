from ts_runtime import run_typescript


def test_admin_user_and_role_management_contracts():
    run_typescript(
        r"""
const assert = require('node:assert/strict');
const { BadRequestException } = require('@nestjs/common');
const { AdminService } = require('./src/modules/admin/services/admin.service.ts');

function createService() {
  let createArgs;
  const prisma = {
    user: {
      create: async args => {
        createArgs = args;
        return { id: 'user-1' };
      },
      update: async args => args,
    },
    role: {
      findUnique: async () => ({ id: 'role-student' }),
      create: async args => args,
      update: async args => args,
    },
    permission: {
      findMany: async ({ where }) =>
        where.name.in.includes('manage_users')
          ? [{ id: 'permission-1', name: 'manage_users' }]
          : [],
    },
  };
  return { prisma, service: new AdminService(prisma, {}), getCreateArgs: () => createArgs };
}

(async () => {
  {
    const { service, getCreateArgs } = createService();
    const result = await service.createUser({
      email: 'student@example.com',
      password: 'temporary-password',
      role: 'student',
      acceptTerms: true,
      status: 'active',
    });
    const createArgs = getCreateArgs();
    assert.equal(result.id, 'user-1');
    assert.match(createArgs.data.password, /^\$argon2/);
    assert.notEqual(createArgs.data.password, 'temporary-password');
    assert.deepEqual(createArgs.data.userRoles, { create: { roleId: 'role-student' } });
    assert.deepEqual(createArgs.data.securitySettings, { create: { acceptTerms: true } });
    assert.equal(Object.hasOwn(createArgs.select, 'password'), false);
  }

  {
    const prisma = {
      user: { create: null, update: async args => args },
      role: { findUnique: async () => ({ id: 'role-instructor' }) },
      permission: { findMany: async () => [] },
    };
    const service = new AdminService(prisma, {});
    const result = await service.updateUser('user-1', {
      role: 'instructor',
      status: 'suspended',
    });
    assert.deepEqual(result.data, {
      isActive: true,
      isLocked: true,
      userRoles: { deleteMany: {}, create: { roleId: 'role-instructor' } },
    });
  }

  {
    const { service } = createService();
    const result = await service.createRole({
      name: 'moderator',
      permissionNames: ['manage_users'],
    });
    assert.deepEqual(result.data.permissions, {
      create: [{ permission: { connect: { id: 'permission-1' } } }],
    });
  }

  {
    const { service } = createService();
    await assert.rejects(
      service.createRole({ name: 'moderator', permissionNames: ['missing_permission'] }),
      error => error instanceof BadRequestException,
    );
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
"""
    )
