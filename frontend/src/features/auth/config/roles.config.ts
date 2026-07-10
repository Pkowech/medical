import { UserRole } from '@/shared/types/authInterface';

export interface RoleConfig {
  label: string;
  description: string;
  features: string[];
  color: string;
}

export const ROLE_CONFIGS: Record<UserRole, RoleConfig> = {
  guest: {
    label: 'guest',
    description: 'Limited access for unauthenticated visitors',
    features: ['Browse public content'],
    color: 'gray',
  },
  student: {
    label: 'Medical Student',
    description: 'Access to all learning resources and progress tracking',
    features: [
      'Kenyan medical school curriculum access',
      'Clinical case studies and MOH protocols',
      'OSCE preparation materials',
      'Progress tracking and analytics',
      'Study group participation',
    ],
    color: 'blue',
  },
  moderator: {
    label: 'Community Moderator',
    description: 'Community moderation and support',
    features: [
      'Community moderation',
      'User support and guidance',
      'Content review and approval',
      'Discussion management',
      'Student assistance',
    ],
    color: 'orange',
  },
  instructor: {
    label: 'Medical Educator',
    description: 'Create and manage medical education content',
    features: [
      'Create clinical cases and study materials',
      'Upload MOH protocol summaries',
      'Contribute to medical terminology database',
      'Access content analytics',
      'Mentor student groups',
    ],
    color: 'green',
  },
  admin: {
    label: 'Platform Administrator',
    description: 'Full platform management access',
    features: [
      'User and role management',
      'Content moderation and approval',
      'System configuration',
      'Analytics and reporting',
      'Security management',
    ],
    color: 'purple',
  },
};

export const getRoleLabel = (role: UserRole): string => {
  return ROLE_CONFIGS[role]?.label || role;
};

export const getRoleColor = (role: UserRole): string => {
  return ROLE_CONFIGS[role]?.color || 'gray';
};

export const getRoleDescription = (role: UserRole): string => {
  return ROLE_CONFIGS[role]?.description || '';
};

export const getRoleFeatures = (role: UserRole): string[] => {
  return ROLE_CONFIGS[role]?.features || [];
};
