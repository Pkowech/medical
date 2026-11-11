from ts_runtime import run_typescript


def test_role_bootstrap_creates_missing_defaults_and_preserves_admin_changes():
    run_typescript(
        r"""
const assert = require('node:assert/strict');
const { Role } = require('./src/modules/auth/constants/role.constants.ts');
const {
  RoleInitializationService,
} = require('./src/modules/auth/services/role-initialization.service.ts');

const roles = new Map();
const permissions = new Map();
const rolePermissionKeys = new Set();

const transaction = {
  role: {
    findMany: async ({ where }) =>
      [...roles.values()].filter(role => where.name.in.includes(role.name)),
    upsert: async ({ where, update, create }) => {
      const existing = roles.get(where.name);
      if (existing) {
        Object.assign(existing, update);
        return existing;
      }

      const role = { id: `role-${where.name}`, ...create };
      roles.set(where.name, role);
      return role;
    },
  },
  permission: {
    upsert: async ({ where, update, create }) => {
      const existing = permissions.get(where.name);
      if (existing) {
        Object.assign(existing, update);
        return existing;
      }

      const permission = { id: `permission-${where.name}`, ...create };
      permissions.set(where.name, permission);
      return permission;
    },
  },
  rolePermission: {
    createMany: async ({ data, skipDuplicates }) => {
      assert.equal(skipDuplicates, true);
      for (const grant of data) {
        rolePermissionKeys.add(`${grant.roleId}:${grant.permissionId}`);
      }
    },
  },
};

const prisma = {
  $transaction: callback => callback(transaction),
};
const service = new RoleInitializationService(prisma);

(async () => {
  await service.onApplicationBootstrap();

  assert.deepEqual([...roles.keys()].sort(), Object.values(Role).sort());
  assert.ok(roles.has(Role.student));
  assert.ok(rolePermissionKeys.has('role-student:permission-access_courses'));
  assert.ok(rolePermissionKeys.has('role-student:permission-take_assessments'));
  assert.ok(rolePermissionKeys.has('role-admin:permission-manage_system'));
  assert.ok(!rolePermissionKeys.has('role-student:permission-manage_users'));
  for (const grant of rolePermissionKeys) {
    const permissionId = grant.slice(grant.indexOf(':') + 1);
    assert.ok([...permissions.values()].some(permission => permission.id === permissionId));
  }

  const studentRole = roles.get(Role.student);
  studentRole.description = 'Admin-managed description';
  studentRole.isActive = false;

  const customGrantKey = `${studentRole.id}:custom-permission`;
  const removedDefaultGrantKey = `${studentRole.id}:permission-access_courses`;
  rolePermissionKeys.add(customGrantKey);
  rolePermissionKeys.delete(removedDefaultGrantKey);
  const grantsBeforeRestart = rolePermissionKeys.size;

  await service.onApplicationBootstrap();

  assert.equal(rolePermissionKeys.size, grantsBeforeRestart);
  assert.ok(rolePermissionKeys.has(customGrantKey));
  assert.ok(!rolePermissionKeys.has(removedDefaultGrantKey));
  assert.equal(studentRole.description, 'Admin-managed description');
  assert.equal(studentRole.isActive, false);
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
"""
    )
