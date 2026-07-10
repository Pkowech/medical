import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';
import { Role } from '#modules/auth/constants/role.constants';
import { JwtAuthGuard } from '#modules/auth/guards/jwt-auth.guard';
import { RoleGuard } from '#common/guards/roles.guard';
import {
  rolesKey,
  resourceKey,
  actionKey,
} from '#common/constants/auth.constants';

export interface RoleAndPermission {
  roles: Role[];
  resource?: string;
  action?: string;
}

/**
 * Enhanced role decorator with optional authentication
 */
export function RequireRole(roleConfig: Role | Role[] | RoleAndPermission) {
  if (Array.isArray(roleConfig) || typeof roleConfig === 'string') {
    const roles = Array.isArray(roleConfig) ? roleConfig : [roleConfig];

    return applyDecorators(
      SetMetadata(rolesKey, roles),
      UseGuards(JwtAuthGuard, RoleGuard),
    );
  }

  const { roles, resource, action } = roleConfig;

  return applyDecorators(
    SetMetadata(rolesKey, roles),
    SetMetadata(resourceKey, resource),
    SetMetadata(actionKey, action),
    UseGuards(JwtAuthGuard, RoleGuard),
  );
}

/**
 * Decorator for student-and-above access (default registration role)
 */
export function RequireStudent() {
  return RequireRole([
    Role.student,
    Role.moderator,
    Role.instructor,
    Role.admin,
  ]);
}

/**
 * Decorator for authenticated users only
 */
export function RequireAuthenticated() {
  return RequireRole([
    Role.student,
    Role.moderator,
    Role.instructor,
    Role.admin,
  ]);
}
