import { Role } from '@/shared/enums/role.enum';

export const navigationPermissions = {
  [Role.admin]: [
    'dashboard',
    'courses',
    'learning-paths',
    'study-planner',
    'progress-tracking',
    'community',
    'admin-dashboard',
    'instructor-dashboard',
    'profile',
  ],
  [Role.instructor]: [
    'dashboard',
    'courses',
    'learning-paths',
    'study-planner',
    'progress-tracking',
    'community',
    'instructor-dashboard',
    'profile',
  ],
  [Role.student]: [
    'dashboard',
    'courses',
    'learning-paths',
    'study-planner',
    'progress-tracking',
    'community',
    'profile',
  ],
  [Role.moderator]: [
    'dashboard',
    'courses',
    'learning-paths',
    'study-planner',
    'progress-tracking',
    'community',
    'profile',
  ],
  [Role.guest]: ['courses', 'community'],
};
