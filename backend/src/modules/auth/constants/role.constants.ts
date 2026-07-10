import { RoleName } from '@prisma/client';

export const Role = RoleName;
export type Role = RoleName;

/**
 * Role hierarchy levels
 * Lower number means lower permissions
 */
export const roleHierarchy: Record<RoleName, number> = {
  [RoleName.student]: 1,
  [RoleName.moderator]: 2,
  [RoleName.instructor]: 3,
  [RoleName.admin]: 4,
};

/**
 * Map role names to descriptions
 */
export const ROLE_DESCRIPTIONS: Record<RoleName, string> = {
  [RoleName.student]: 'Basic access to courses and study materials',
  [RoleName.moderator]: 'Community moderation and support',
  [RoleName.instructor]: 'Content creation + student features',
  [RoleName.admin]: 'Full system access',
};

/**
 * Map role names to visual colors
 */
export const ROLE_COLORS: Record<RoleName, string> = {
  [RoleName.student]: 'yellow',
  [RoleName.moderator]: 'green',
  [RoleName.instructor]: 'blue',
  [RoleName.admin]: 'purple',
};
