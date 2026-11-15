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
    const inheritedRoles = (Object.entries(roleHierarchy) as [Role, number][])
      .filter(([, level]) => level < roleHierarchy[roleName])
      .map(([r]) => r);

    return this.getPermissionNamesForRoles([roleName, ...inheritedRoles]);
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
      select: { role: { select: { name: true } } },
    });

    if (!userRoles || userRoles.length === 0) {
      return [];
    }

    const initialRoleNames = Array.from(
      new Set(userRoles.map((ur) => ur.role.name)),
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

    const uniquePermissions = await this.getPermissionNamesForRoles(
      Array.from(neededRoleNames),
    );

    await this.cacheManager.set(cacheKey, uniquePermissions, 3600); // Cache for 1 hour

    return uniquePermissions;
  }

  private async getPermissionNamesForRoles(
    roleNames: Role[],
  ): Promise<string[]> {
    if (roleNames.length === 0) {
      return [];
    }

    const permissions = await this.prisma.permission.findMany({
      where: {
        roles: {
          some: { role: { name: { in: roleNames } } },
        },
      },
      select: { name: true },
    });

    return permissions.map(({ name }) => name);
  }
}
