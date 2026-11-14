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
let permissionUpserts = 0;
const service = Object.create(RoleInitializationService.prototype);
service.prisma = {
  $transaction: async callback => callback({
    role: {
      findMany: async () =>
        existingRoleNames.map(name => ({ id: `role-${name}`, name })),
      upsert: async ({ where }) => ({ id: `role-${where.name}` }),
    },
    permission: {
      upsert: async ({ where }) => {
        permissionUpserts += 1;
        return { id: `permission-${where.name}`, name: where.name };
      },
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
  assert.ok(permissionUpserts > 0);
  assert.equal(addedDefaultGrants, 0);
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
"""
    )
