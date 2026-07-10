import { SetMetadata } from '@nestjs/common';
import { Role } from '#modules/auth/constants/role.constants';

export const rolesKey = 'roles';

/**
 * Attach one or more required roles to a route.
 * Example: @Roles(Role.admin, Role.moderator)
 */
export const Roles = (...roles: Role[]) => SetMetadata(rolesKey, roles);
