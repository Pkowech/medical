import {
  Role,
  roleHierarchy,
} from '../../modules/auth/constants/role.constants';
import { RoleName } from '@prisma/client';

/**
 * Check if a role has sufficient privileges
 */
export function hasRolePrivilege(role: string, requiredRole: string): boolean {
  return (
    (roleHierarchy[role as RoleName] ?? 0) >=
    (roleHierarchy[requiredRole as RoleName] ?? 0)
  );
}

/**
 * Check if a role can access a specific resource with given action
 */
export function canAccessResource(
  role: string,
  resource: string,
  action: 'create' | 'read' | 'update' | 'delete' | 'manage',
): boolean {
  // Define resource access rules
  const resourceAccess: Record<string, Record<string, string>> = {
    courses: {
      create: Role.instructor,
      read: Role.student,
      update: Role.instructor,
      delete: Role.admin,
      manage: Role.instructor,
    },
    content: {
      create: Role.instructor,
      read: Role.student,
      update: Role.instructor,
      delete: Role.admin,
      manage: Role.instructor,
    },
    users: {
      create: Role.admin,
      read: Role.moderator,
      update: Role.admin,
      delete: Role.admin,
      manage: Role.admin,
    },
    analytics: {
      create: Role.student,
      read: Role.student,
      update: Role.instructor,
      delete: Role.admin,
      manage: Role.admin,
    },
    assessments: {
      create: Role.student,
      read: Role.student,
      update: Role.instructor,
      delete: Role.instructor,
      manage: Role.instructor,
    },
    groups: {
      create: Role.student,
      read: Role.student,
      update: Role.moderator,
      delete: Role.moderator,
      manage: Role.moderator,
    },
  };

  const requiredRole = resourceAccess[resource]?.[action];
  if (!requiredRole) {
    return false; // Resource/action combination not defined
  }

  return hasRolePrivilege(role, requiredRole);
}

/**
 * Normalize any input (string/object) into a valid role string
 */
export function getUserPrimaryRole(user: unknown): string | undefined {
  if (!user || typeof user !== 'object') {
    return undefined;
  }

  const userObj = user as Record<string, unknown>;
  let roleValue: string | undefined;

  // Prefer the explicitly set primary role if valid
  if (typeof userObj.role === 'string') {
    roleValue = userObj.role;
  } else if (
    Array.isArray(userObj.roles) &&
    (userObj.roles as unknown[]).length > 0
  ) {
    // Fallback to first role in array if primary role not set
    const first = (userObj.roles as unknown[])[0];
    if (
      first &&
      typeof first === 'object' &&
      'name' in first &&
      typeof (first as Record<string, unknown>).name === 'string'
    ) {
      roleValue = (first as Record<string, unknown>).name as string;
    } else if (typeof first === 'string') {
      roleValue = first;
    }
  } else if (typeof user === 'string') {
    roleValue = user;
  }

  if (!roleValue) {
    return undefined;
  }

  const normalized = String(roleValue).toLowerCase();

  switch (normalized) {
    case 'student':
      return Role.student;
    case 'moderator':
      return Role.moderator;
    case 'creator':
    case 'content_creator':
    case 'contentcreator':
    case 'instructor':
      return Role.instructor;
    case 'admin':
      return Role.admin;
    // Legacy role mappings
    case 'attending':
      return Role.moderator;
    case 'teacher':
      return Role.instructor;
    default:
      return undefined;
  }
}

/**
 * Convert a role string back to canonical string (for API responses/logging)
 */
export function roleToString(role: string | undefined): string | undefined {
  if (!role) {
    return undefined;
  }

  switch (role) {
    case Role.student:
      return 'student';
    case Role.moderator:
      return 'moderator';
    case Role.instructor:
      return 'instructor';
    case Role.admin:
      return 'admin';
    default:
      return undefined;
  }
}

/**
 * Get the default role for new user registration
 */
export function getDefaultRole(): string {
  return Role.student;
}

/**
 * Check if a role is a guest role (deprecated)
 */
export function isGuestRole(_role: string): boolean {
  return false;
}

/**
 * Check if a user requires authentication (always true now)
 */
export function requiresAuthentication(_role: string): boolean {
  return true;
}

/**
 * Get role-specific limitations and capabilities
 */
export function getRoleCapabilities(role: string): {
  canCreateContent: boolean;
  canModerate: boolean;
  canViewAnalytics: boolean;
  canManageUsers: boolean;
  maxCourseEnrollments: number;
  maxStudyGroups: number;
  sessionDuration: number; // in seconds
} {
  switch (role) {
    case Role.student:
      return {
        canCreateContent: false,
        canModerate: false,
        canViewAnalytics: true,
        canManageUsers: false,
        maxCourseEnrollments: 10,
        maxStudyGroups: 5,
        sessionDuration: 86400,
      };
    case Role.moderator:
      return {
        canCreateContent: false,
        canModerate: true,
        canViewAnalytics: true,
        canManageUsers: false,
        maxCourseEnrollments: 50,
        maxStudyGroups: 20,
        sessionDuration: 86400,
      };
    case Role.instructor:
      return {
        canCreateContent: true,
        canModerate: false,
        canViewAnalytics: true,
        canManageUsers: false,
        maxCourseEnrollments: 100,
        maxStudyGroups: 30,
        sessionDuration: 86400,
      };
    case Role.admin:
      return {
        canCreateContent: true,
        canModerate: true,
        canViewAnalytics: true,
        canManageUsers: true,
        maxCourseEnrollments: -1,
        maxStudyGroups: -1,
        sessionDuration: 43200,
      };
    default:
      return {
        canCreateContent: false,
        canModerate: false,
        canViewAnalytics: false,
        canManageUsers: false,
        maxCourseEnrollments: 0,
        maxStudyGroups: 0,
        sessionDuration: 3600,
      };
  }
}
