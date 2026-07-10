import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '#infrastructure/prisma/prisma.service';
import { Role, Permission } from '@prisma/client';
import { Role as RoleEnum } from '../constants/role.constants';

interface RoleWithPermissions extends Role {
  permissions: Permission[];
}

@Injectable()
export class RolesService {
  private readonly logger = new Logger(RolesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findRoleByName(name: RoleEnum): Promise<Role> {
    const role = await this.prisma.role.findUnique({
      where: { name },
    });

    if (!role) {
      throw new NotFoundException(`Role with name "${name}" not found.`);
    }

    return role;
  }

  async findOrCreateRole(name: RoleEnum): Promise<Role> {
    return this.prisma.role.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  /**
   * Get user roles with permissions using optimized single query
   * Reduces N+1 query problem from 5-6 queries to 1 query
   */
  async getUserRolesWithPermissions(
    userId: string,
  ): Promise<RoleWithPermissions[]> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          userRoles: {
            select: {
              role: {
                include: {
                  permissions: {
                    include: {
                      permission: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!user) {
        this.logger.warn(`User not found: ${userId}`);
        return [];
      }

      return user.userRoles.map((ur) => ({
        ...ur.role,
        permissions: ur.role.permissions.map((rp) => rp.permission),
      }));
    } catch (error) {
      this.logger.error(
        `Error fetching roles with permissions for user ${userId}:`,
        error,
      );
      return [];
    }
  }

  /**
   * Get flat list of permission names for a user
   * Optimized for authorization checks
   */
  async getUserPermissionNames(userId: string): Promise<string[]> {
    try {
      const roles = await this.getUserRolesWithPermissions(userId);
      const permissions = new Set<string>();

      roles.forEach((role) => {
        role.permissions.forEach((permission) => {
          permissions.add(permission.name);
        });
      });

      return Array.from(permissions);
    } catch (error) {
      this.logger.error(
        `Error fetching permission names for user ${userId}:`,
        error,
      );
      return [];
    }
  }
}
