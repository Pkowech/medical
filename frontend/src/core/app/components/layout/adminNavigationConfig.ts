import {
  AlertCircle,
  BarChart3,
  Clock,
  GraduationCap,
  LayoutDashboard,
  LockKeyhole,
  Settings,
  Shield,
  Users,
} from 'lucide-react';

const adminNavigationConfig = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    href: '/admin',
    icon: LayoutDashboard,
  },
  {
    id: 'student-dashboard',
    label: 'Student Dashboard',
    href: '/dashboard',
    icon: GraduationCap,
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

export default adminNavigationConfig;
