import { Injectable, Logger } from '@nestjs/common';
import { getErrorMessage } from '#common/utils/error.utils';
import { PrismaService } from '#infrastructure/prisma/prisma.service';
import {
  roleHierarchy,
  Role,
  ROLE_DESCRIPTIONS,
  ROLE_COLORS,
} from '../constants/role.constants';
import {
  Prisma,
  Permission as PrismaPermission,
  PrismaClient,
} from '@prisma/client';

@Injectable()
export class RoleInitializationService {
  private readonly logger = new Logger(RoleInitializationService.name);

  constructor(private readonly prisma: PrismaService) {}

  async initializeDefaultRoles() {
    try {
      await this.prisma.$transaction(async (tx) => {
        // Ensure all default permissions exist
        const permissions = await this.createDefaultPermissions(tx);
        const permissionMap: Record<string, PrismaPermission> =
          Object.fromEntries(permissions.map((p) => [p.name, p]));

        // Define role permissions for active roles
        const baseRolePermissions: Record<Role, string[]> = {
          [Role.student]: [
            'access_courses',
            'join_study_groups',
            'view_progress',
            'take_assessments',
            'view_personal_analytics',
            'manage_profile',
            'view_public_content',
            'view_course_previews',
            'view_public_courses',
            'create_study_group',
            'manage_own_study_groups',
            'read_own_profile',
          ],
          [Role.moderator]: [
            'manage_students',
            'access_courses',
            'join_study_groups',
            'view_progress',
            'moderate_content',
            'view_community_analytics',
            'manage_study_groups',
            'read_own_profile',
          ],
          [Role.instructor]: [
            'create_content',
            'manage_courses',
            'view_analytics',
            'manage_students',
            'approve_content',
            'manage_assessments',
            'view_content_analytics',
            'create_study_group',
            'manage_own_study_groups',
            'read_own_profile',
          ],
          [Role.admin]: [
            'manage_users',
            'manage_content',
            'manage_courses',
            'view_analytics',
            'manage_settings',
            'manage_roles',
            'create_content',
            'manage_students',
            'access_courses',
            'join_study_groups',
            'view_progress',
            'approve_content',
            'manage_system',
            'view_audit_logs',
            'manage_study_groups',
            'read_users',
            'read_own_profile',
          ],
        };

        // Inheritance rules (higher roles inherit lower role permissions)
        const inheritedPermissions: Record<Role, Role[]> = {
          [Role.admin]: [Role.instructor, Role.moderator, Role.student],
          [Role.instructor]: [Role.student],
          [Role.moderator]: [Role.student],
          [Role.student]: [],
        };

        // Build final permission sets with inheritance
        const roles = (Object.values(Role)).map((role) => {
          const inherited = inheritedPermissions[role].flatMap(
            (r) => baseRolePermissions[r],
          );
          const allPermissions = [
            ...new Set([...baseRolePermissions[role], ...inherited]),
          ];

          const currentRolePermissionIds = allPermissions
            .filter((permName) => permissionMap[permName])
            .map((permName) => permissionMap[permName].id);

          return {
            name: role,
            description: ROLE_DESCRIPTIONS[role],
            color: ROLE_COLORS[role],
            hierarchyLevel: roleHierarchy[role],
            isActive: true,
            permissionIds: currentRolePermissionIds,
          };
        });

        // Upsert roles
        for (const roleData of roles) {
          const upsertedRole = await tx.role.upsert({
            where: { name: roleData.name },
            update: {
              description: roleData.description,
              color: roleData.color,
              hierarchyLevel: roleData.hierarchyLevel,
              isActive: roleData.isActive,
            },
            create: {
              name: roleData.name,
              description: ROLE_DESCRIPTIONS[roleData.name],
              color: ROLE_COLORS[roleData.name],
              hierarchyLevel: roleHierarchy[roleData.name],
              isActive: true,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          });
          this.logger.log(`Role ${roleData.name} upserted successfully`);

          // Delete existing RolePermission entries for this role
          await tx.rolePermission.deleteMany({
            where: { roleId: upsertedRole.id },
          });

          // Create new RolePermission entries
          for (const permissionId of roleData.permissionIds) {
            await tx.rolePermission.create({
              data: {
                roleId: upsertedRole.id,
                permissionId,
                assignedAt: new Date(),
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            });
          }
        }
      });

      this.logger.log('Default roles initialized successfully');
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      this.logger.error(`Failed to initialize roles: ${errorMessage}`);
      throw error;
    }
  }

  private async createDefaultPermissions(
    tx: PrismaClient | Prisma.TransactionClient, // Corrected to use PrismaClient directly
  ): Promise<PrismaPermission[]> {
    const defaultPermissions = [
      {
        name: 'manage_users',
        resource: 'users',
        action: 'manage',
        description: 'Create, edit, and delete users',
        category: 'users',
      },
      {
        name: 'manage_content',
        resource: 'content',
        action: 'manage',
        description: 'Create and edit course content',
        category: 'content',
      },
      {
        name: 'manage_courses',
        resource: 'courses',
        action: 'manage',
        description: 'Create and manage courses',
        category: 'courses',
      },
      {
        name: 'view_analytics',
        resource: 'analytics',
        action: 'read',
        description: 'Access to analytics and reports',
        category: 'analytics',
      },
      {
        name: 'manage_settings',
        resource: 'settings',
        action: 'manage',
        description: 'Modify system settings',
        category: 'settings',
      },
      {
        name: 'manage_roles',
        resource: 'roles',
        action: 'manage',
        description: 'Create and modify user roles',
        category: 'roles',
      },
      {
        name: 'create_content',
        resource: 'content',
        action: 'create',
        description: 'Create new content',
        category: 'content',
      },
      {
        name: 'manage_students',
        resource: 'students',
        action: 'manage',
        description: 'Manage student accounts and progress',
        category: 'users',
      },
      {
        name: 'access_courses',
        resource: 'courses',
        action: 'read',
        description: 'Access course materials',
        category: 'courses',
      },
      {
        name: 'manage_study_groups',
        resource: 'groups',
        action: 'manage',
        description: 'Create and manage study groups',
        category: 'groups',
      },
      {
        name: 'join_study_groups',
        resource: 'groups',
        action: 'read',
        description: 'Join existing study groups',
        category: 'groups',
      },
      {
        name: 'create_study_group',
        resource: 'groups',
        action: 'create',
        description: 'Create new study groups',
        category: 'groups',
      },
      {
        name: 'manage_own_study_groups',
        resource: 'groups',
        action: 'manage_own',
        description: 'Manage study groups created by the user',
        category: 'groups',
      },
      {
        name: 'view_progress',
        resource: 'analytics',
        action: 'read',
        description: 'View personal progress',
        category: 'analytics',
      },
      {
        name: 'approve_content',
        resource: 'content',
        action: 'update',
        description: 'Approve user-created content',
        category: 'content',
      },
      {
        name: 'view_public_courses',
        resource: 'courses',
        action: 'read',
        description: 'Browse public course catalog',
        category: 'courses',
      },
      {
        name: 'view_course_previews',
        resource: 'courses',
        action: 'read',
        description: 'Access course preview content',
        category: 'courses',
      },
      {
        name: 'view_public_content',
        resource: 'content',
        action: 'read',
        description: 'View publicly available content',
        category: 'content',
      },

      {
        name: 'take_assessments',
        resource: 'assessments',
        action: 'create',
        description: 'Take quizzes and assessments',
        category: 'assessments',
      },
      {
        name: 'view_personal_analytics',
        resource: 'analytics',
        action: 'read',
        description: 'View personal learning analytics',
        category: 'analytics',
      },
      {
        name: 'manage_profile',
        resource: 'profile',
        action: 'manage',
        description: 'Manage personal profile and settings',
        category: 'users',
      },
      {
        name: 'moderate_content',
        resource: 'content',
        action: 'update',
        description: 'Moderate user-generated content',
        category: 'content',
      },
      {
        name: 'view_community_analytics',
        resource: 'analytics',
        action: 'read',
        description: 'View community and group analytics',
        category: 'analytics',
      },
      {
        name: 'manage_assessments',
        resource: 'assessments',
        action: 'manage',
        description: 'Create and manage assessments',
        category: 'assessments',
      },
      {
        name: 'view_content_analytics',
        resource: 'analytics',
        action: 'read',
        description: 'View content performance analytics',
        category: 'analytics',
      },
      {
        name: 'manage_system',
        resource: 'system',
        action: 'manage',
        description: 'System administration and configuration',
        category: 'system',
      },
      {
        name: 'view_audit_logs',
        resource: 'audit',
        action: 'read',
        description: 'Access system audit logs',
        category: 'system',
      },
      {
        name: 'read_users',
        resource: 'users',
        action: 'read',
        description: 'View all user profiles',
        category: 'users',
      },
      {
        name: 'read_own_profile',
        resource: 'profile',
        action: 'read',
        description: 'View own user profile',
        category: 'users',
      },
    ];

    const permissions: PrismaPermission[] = [];
    for (const permData of defaultPermissions) {
      try {
        const permission = await tx.permission.upsert({
          where: { name: permData.name },
          update: { ...permData, updatedAt: new Date() },
          create: { ...permData, createdAt: new Date(), updatedAt: new Date() },
        });
        this.logger.log(
          `Created/Updated permission: ${permission.name} (ID: ${permission.id})`,
        );
        permissions.push(permission);
      } catch (error) {
        const errorMessage = getErrorMessage(error);
        this.logger.error(
          `Failed to create permission ${permData.name}: ${errorMessage}`,
        );
        throw error;
      }
    }
    this.logger.log(`Total permissions created: ${permissions.length}`);
    return permissions;
  }

  getDefaultRegistrationRole(): Role {
    return Role.student;
  }
}
