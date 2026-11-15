from ts_runtime import run_typescript


def test_existing_roles_refresh_default_permissions_without_losing_grants():
    run_typescript(
        r"""
const assert = require('node:assert/strict');
const {
  RoleInitializationService,
} = require('./src/modules/auth/services/role-initialization.service.ts');

const existingRoleNames = ['admin', 'instructor', 'moderator', 'student'];
const customGrant = 'role-admin:custom-permission';
const grants = new Set([customGrant]);
let addedDefaultGrants = 0;
let permissionBatches = 0;
const service = Object.create(RoleInitializationService.prototype);
service.prisma = {
  $transaction: async callback => callback({
    role: {
      findMany: async () =>
        existingRoleNames.map(name => ({ id: `role-${name}`, name })),
      upsert: async ({ where }) => ({ id: `role-${where.name}` }),
    },
    permission: {
      createMany: async ({ data, skipDuplicates }) => {
        assert.equal(skipDuplicates, true);
        permissionBatches += 1;
        return { count: data.length };
      },
      findMany: async ({ where }) =>
        where.name.in.map(name => ({ id: `permission-${name}`, name })),
    },
    rolePermission: {
      createMany: async ({ data }) => {
        for (const grant of data) {
          const key = `${grant.roleId}:${grant.permissionId}`;
          if (!grants.has(key)) {
            grants.add(key);
            addedDefaultGrants += 1;
          }
        }
        return { count: data.length };
      },
    },
  }),
};
service.logger = {
  debug: () => undefined,
  log: () => undefined,
  error: () => undefined,
};

(async () => {
  await service.initializeDefaultRoles();
  assert.equal(grants.has(customGrant), true);
  assert.equal(permissionBatches, 1);
  assert.equal(addedDefaultGrants, 0);
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
"""
    )
