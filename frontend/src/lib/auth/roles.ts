export enum Permission {
  // User Permissions
  VIEW_PROFILE = 'VIEW_PROFILE',
  EDIT_PROFILE = 'EDIT_PROFILE',

  // Course Permissions
  VIEW_COURSES = 'VIEW_COURSES',
  ENROLL_COURSES = 'ENROLL_COURSES',
  CREATE_COURSES = 'CREATE_COURSES',
  EDIT_COURSES = 'EDIT_COURSES',
  DELETE_COURSES = 'DELETE_COURSES',

  // Admin Permissions
  MANAGE_USERS = 'MANAGE_USERS',
  VIEW_SETTINGS = 'VIEW_SETTINGS',
  EDIT_SETTINGS = 'EDIT_SETTINGS',
}

// Import Role from shared enums to ensure consistency across the app
export { Role } from '@/shared/enums/role.enum';

// Import Role type to use in mappings
import { Role } from '@/shared/enums/role.enum';

export const ROLES_PERMISSIONS: Record<Role, Permission[]> = {
  [Role.guest]: [Permission.VIEW_COURSES],
  [Role.student]: [
    Permission.VIEW_PROFILE,
    Permission.EDIT_PROFILE,
    Permission.VIEW_COURSES,
    Permission.ENROLL_COURSES,
  ],
  [Role.moderator]: [
    Permission.VIEW_PROFILE,
    Permission.EDIT_PROFILE,
    Permission.VIEW_COURSES,
    Permission.ENROLL_COURSES,
    Permission.EDIT_COURSES, // Can moderate course content
  ],
  [Role.instructor]: [
    Permission.VIEW_PROFILE,
    Permission.EDIT_PROFILE,
    Permission.VIEW_COURSES,
    Permission.CREATE_COURSES,
    Permission.EDIT_COURSES,
  ],
  [Role.admin]: [
    Permission.VIEW_PROFILE,
    Permission.EDIT_PROFILE,
    Permission.VIEW_COURSES,
    Permission.CREATE_COURSES,
    Permission.EDIT_COURSES,
    Permission.DELETE_COURSES,
    Permission.MANAGE_USERS,
    Permission.VIEW_SETTINGS,
    Permission.EDIT_SETTINGS,
  ],
};

export const hasPermission = (userRole: Role, requiredPermission: Permission): boolean => {
  const userPermissions = ROLES_PERMISSIONS[userRole] || [];
  return userPermissions.includes(requiredPermission);
};

export const hasAllPermissions = (userRole: Role, requiredPermissions: Permission[]): boolean => {
  const userPermissions = ROLES_PERMISSIONS[userRole] || [];
  return requiredPermissions.every(p => userPermissions.includes(p));
};

export const hasAnyPermission = (userRole: Role, requiredPermissions: Permission[]): boolean => {
  const userPermissions = ROLES_PERMISSIONS[userRole] || [];
  return requiredPermissions.some(p => userPermissions.includes(p));
};

export const getRolePermissions = (role: Role): Permission[] => {
  return ROLES_PERMISSIONS[role] || [];
};

export const DEFAULT_ROLE_PERMISSIONS = ROLES_PERMISSIONS;
