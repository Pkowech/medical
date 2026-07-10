// src/common/guards/roles.guard.ts
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  Role,
  roleHierarchy,
} from '../../modules/auth/constants/role.constants';
import { RoleName } from '@prisma/client';
import { getUserPrimaryRole } from '../utils/role.util';
import { rolesKey, resourceKey, actionKey } from '../constants/auth.constants';

@Injectable()
export class RoleGuard implements CanActivate {
  private readonly logger = new Logger(RoleGuard.name);
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(rolesKey, [
      context.getHandler(),
      context.getClass(),
    ]);

    const resource = this.reflector.getAllAndOverride<string>(resourceKey, [
      context.getHandler(),
      context.getClass(),
    ]);

    const action = this.reflector.getAllAndOverride<string>(actionKey, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true; // No role restriction
    }

    const request = context.switchToHttp().getRequest();
    const { user } = request;

    // Check for authenticated user
    if (!user || !user.role) {
      throw new UnauthorizedException('Authentication required');
    }

    const userRole = getUserPrimaryRole(user);
    if (!userRole) {
      throw new ForbiddenException('Invalid or missing role');
    }

    // Check role hierarchy
    const userLevel = roleHierarchy[userRole as RoleName] ?? 0;
    const minRequiredLevel = Math.min(
      ...requiredRoles.map((role) => roleHierarchy[role as RoleName] ?? 999),
    );

    if (userLevel >= minRequiredLevel) {
      // Additional resource-based permission check if specified
      if (resource && action) {
        const hasResourceAccess = this.checkResourcePermission(
          userRole,
          resource,
          action,
        );
        if (!hasResourceAccess) {
          throw new ForbiddenException(
            `Insufficient permissions for ${action} on ${resource}`,
          );
        }
      }
      return true;
    }

    this.logger.warn(
      `Access denied. Required roles: ${requiredRoles.join(', ')}. Current: ${userRole}`,
    );
    throw new ForbiddenException(
      `Requires role: ${requiredRoles.join(', ')} (current: ${userRole})`,
    );
  }

  /**
   * Check resource-specific permissions
   */
  private checkResourcePermission(
    userRole: string,
    resource: string,
    action: string,
  ): boolean {
    // Define resource access matrix
    const resourcePermissions: Record<string, Record<string, string[]>> = {
      // Admin resource: restrict high-level management endpoints
      admin: {
        create: [Role.admin],
        read: [Role.admin],
        update: [Role.admin],
        delete: [Role.admin],
        manage: [Role.admin],
      },
      courses: {
        create: [Role.instructor, Role.admin],
        read: [Role.student, Role.moderator, Role.instructor, Role.admin],
        update: [Role.instructor, Role.admin],
        delete: [Role.admin],
        manage: [Role.instructor, Role.admin],
      },
      content: {
        create: [Role.instructor, Role.admin],
        read: [Role.student, Role.moderator, Role.instructor, Role.admin],
        update: [Role.instructor, Role.admin],
        delete: [Role.admin],
        manage: [Role.instructor, Role.admin],
      },
      users: {
        create: [Role.admin],
        read: [Role.moderator, Role.instructor, Role.admin],
        update: [Role.admin],
        delete: [Role.admin],
        manage: [Role.admin],
      },
      analytics: {
        read: [Role.student, Role.moderator, Role.instructor, Role.admin],
        manage: [Role.admin],
      },
      assessments: {
        create: [Role.student, Role.moderator, Role.instructor, Role.admin],
        read: [Role.student, Role.moderator, Role.instructor, Role.admin],
        update: [Role.instructor, Role.admin],
        delete: [Role.instructor, Role.admin],
        manage: [Role.instructor, Role.admin],
      },
      groups: {
        create: [Role.student, Role.moderator, Role.instructor, Role.admin],
        read: [Role.student, Role.moderator, Role.instructor, Role.admin],
        update: [Role.moderator, Role.instructor, Role.admin],
        delete: [Role.moderator, Role.instructor, Role.admin],
        manage: [Role.moderator, Role.instructor, Role.admin],
      },
    };

    const allowedRoles = resourcePermissions[resource]?.[action];
    if (!allowedRoles) {
      return false; // Resource/action combination not defined
    }

    return allowedRoles.includes(userRole);
  }
}
