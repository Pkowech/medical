import {
  Users,
  Settings,
  BarChart3,
  FileText,
  Shield,
  User,
  Clock,
  AlertCircle,
} from 'lucide-react';

import { NavigationItem } from '@/shared/types/navigationInterface';

/**
 * Admin-specific navigation items
 * Displayed in admin layout sidebar
 * These items are only visible to admin users
 */
const adminNavigationConfig: NavigationItem[] = [
  {
    id: 'dashboard',
    label: 'Admin Dashboard',
    href: '/admin',
    icon: BarChart3,
    children: [
      {
        id: 'analytics',
        label: 'Analytics',
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
    id: 'users',
    label: 'User Management',
    href: '/admin/users',
    icon: Users,
  },
  {
    id: 'settings',
    label: 'System Settings',
    href: '/admin/settings',
    icon: Settings,
  },
  {
    id: 'content',
    label: 'Content Management',
    href: '/admin/content',
    icon: FileText,
  },
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
  {
    id: 'profile',
    label: 'Profile',
    href: '/profile',
    icon: User,
  },
];

export default adminNavigationConfig;
