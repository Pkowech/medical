import {
  AlertCircle,
  BarChart3,
  Clock,
  FileText,
  LayoutDashboard,
  Library,
  LockKeyhole,
  Settings,
  Shield,
  Users,
} from 'lucide-react';
import type { NavigationItem } from '@/shared/types/navigationInterface';

const adminNavigationConfig: NavigationItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    href: '/admin',
    icon: LayoutDashboard,
  },
  {
    id: 'management',
    label: 'Management',
    icon: Users,
    children: [
      {
        id: 'users',
        label: 'Users',
        href: '/admin/users',
        icon: Users,
      },
      {
        id: 'content',
        label: 'Courses & Content',
        href: '/admin/content',
        icon: Library,
      },
      {
        id: 'upload-materials',
        label: 'Upload Materials',
        href: '/admin/materials/upload',
        icon: FileText,
      },
      {
        id: 'quiz-authoring',
        label: 'Quiz Authoring',
        href: '/admin/assessment/quizzes',
        icon: FileText,
      },
    ],
  },
  {
    id: 'insights',
    label: 'Insights',
    icon: BarChart3,
    children: [
      {
        id: 'analytics',
        label: 'System Analytics',
        href: '/admin/analytics',
        icon: BarChart3,
      },
      {
        id: 'performance',
        label: 'Performance',
        href: '/admin/performance',
        icon: AlertCircle,
      },
    ],
  },
  {
    id: 'security',
    label: 'Access & Security',
    icon: LockKeyhole,
    children: [
      {
        id: 'roles',
        label: 'Roles & Permissions',
        href: '/admin/roles',
        icon: Shield,
      },
      {
        id: 'audit-logs',
        label: 'Audit Logs',
        href: '/admin/audit-logs',
        icon: Clock,
      },
    ],
  },
  {
    id: 'settings',
    label: 'Settings',
    href: '/admin/settings',
    icon: Settings,
  },
];

export const instructorAssessmentNavigationConfig: NavigationItem[] = [
  {
    id: 'quiz-authoring',
    label: 'Quiz Authoring',
    href: '/admin/assessment/quizzes',
    icon: FileText,
  },
];

export default adminNavigationConfig;
