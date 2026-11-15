from ts_runtime import run_typescript


def test_effective_role_permissions_fetch_only_unique_permission_names():
    run_typescript(
        r"""
const assert = require('node:assert/strict');
const { Role } = require('./src/modules/auth/constants/role.constants.ts');
const {
  PermissionCalculationService,
} = require('./src/modules/auth/services/permission-calculation.service.ts');

let query;
const service = Object.create(PermissionCalculationService.prototype);
service.prisma = {
  permission: {
    findMany: async args => {
      query = args;
      return [{ name: 'manage_users' }, { name: 'access_courses' }];
    },
  },
};

(async () => {
  assert.deepEqual(
    await service.getEffectivePermissionsForRole(Role.admin),
    ['manage_users', 'access_courses'],
  );
  assert.deepEqual(query.select, { name: true });
  assert.deepEqual(query.where.roles.some.role.name.in, [
    Role.admin,
    Role.student,
    Role.moderator,
    Role.instructor,
  ]);
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
"""
    )
