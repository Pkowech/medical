import { Injectable, Inject } from '@nestjs/common';
import { PrismaService } from '#infrastructure/prisma/prisma.service';
import { Role, roleHierarchy } from '../constants/role.constants';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

@Injectable()
export class PermissionCalculationService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async getEffectivePermissionsForRole(roleName: Role): Promise<string[]> {
    // Batch fetch the target role plus any inherited roles in a single query
    const inheritedRoles = (Object.entries(roleHierarchy) as [Role, number][])
      .filter(([, level]) => level < roleHierarchy[roleName])
      .map(([r]) => r);

    const roleNames = [roleName, ...inheritedRoles];

    const roles = await this.prisma.role.findMany({
      where: { name: { in: roleNames } },
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
      },
    });

    if (!roles || roles.length === 0) {
      return [];
    }

    const perms = roles.flatMap((r) =>
      r.permissions.map((rp) => rp.permission.name),
    );
    return [...new Set(perms)];
  }

  async calculateUserPermissions(userId: string): Promise<string[]> {
    const cacheKey = `user_permissions:${userId}`;
    const cachedPermissions = await this.cacheManager.get<string[]>(cacheKey);

    if (cachedPermissions) {
      return cachedPermissions;
    }

    // Fetch user's roles first
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId },
      include: { role: true },
    });

    if (!userRoles || userRoles.length === 0) {
      return [];
    }

    const initialRoleNames = Array.from(
      new Set(userRoles.map((ur) => ur.role.name as Role)),
    );

    // Determine all roles we need to fetch including inherited roles
    const neededRoleNames = new Set<Role>(initialRoleNames);
    for (const rn of initialRoleNames) {
      const inherited = Object.entries(roleHierarchy)
        .filter(([, level]) => level < roleHierarchy[rn])
        .map(([r]) => r as Role);
      for (const ir of inherited) {
        neededRoleNames.add(ir);
      }
    }

    // Batch fetch all roles and their permissions
    const roles = await this.prisma.role.findMany({
      where: { name: { in: Array.from(neededRoleNames) } },
      include: { permissions: { include: { permission: true } } },
    });

    const allPermissions = roles.flatMap((r) =>
      r.permissions.map((rp) => rp.permission.name),
    );

    const uniquePermissions = [...new Set(allPermissions)];

    await this.cacheManager.set(cacheKey, uniquePermissions, 3600); // Cache for 1 hour

    return uniquePermissions;
  }
}
