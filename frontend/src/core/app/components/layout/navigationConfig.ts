import {
  LayoutDashboard,
  GraduationCap,
  Route,
  Brain,
  FileText,
  Calendar,
  Target,
  Trophy,
  Users,
  User,
  BarChart,
  Shield,
  MessageSquare,
  Clock,
  HelpCircle,
} from 'lucide-react';

import { NavigationItem } from '@/shared/types/navigationInterface';

const navigationConfig: NavigationItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    id: 'courses',
    label: 'Courses',
    href: '/courses',
    icon: GraduationCap,
  },
  {
    id: 'learning-paths',
    label: 'Learning Paths',
    href: '/learning-paths',
    icon: Route,
  },
  {
    id: 'ai-tutor',
    label: 'AI Tutor',
    href: '/ai-tutor',
    icon: Brain,
    badge: 'New',
  },
  {
    id: 'study-planner',
    label: 'Study Planner',
    href: '/study-planner',
    icon: Calendar,
    children: [
      {
        id: 'schedule',
        label: 'Schedule',
        href: '/study-planner/schedule',
        icon: Clock,
      },
      {
        id: 'goals',
        label: 'Goals',
        href: '/study-planner/goals',
        icon: Target,
      },
      {
        id: 'materials',
        label: 'Study Materials',
        href: '/study-planner/materials',
        icon: FileText,
      },
    ],
  },
  {
    id: 'progress-tracking',
    label: 'Progress',
    href: '/progress',
    icon: BarChart,
  },
  {
    id: 'certifications',
    label: 'Certifications',
    href: '/certifications',
    icon: Trophy,
  },
  {
    id: 'community',
    label: 'Community',
    href: '/community',
    icon: Users,
    children: [
      {
        id: 'discussions',
        label: 'Discussions',
        href: '/community/discussions',
        icon: MessageSquare,
      },
      {
        id: 'study-groups',
        label: 'Study Groups',
        href: '/study-groups',
        icon: Users,
      },
    ],
  },
  {
    id: 'instructor-dashboard',
    label: 'Instructor',
    href: '/instructor',
    icon: GraduationCap,
  },
  {
    id: 'admin-dashboard',
    label: 'Admin',
    href: '/admin',
    icon: Shield,
  },
  {
    id: 'community-moderation',
    label: 'Moderation',
    href: '/moderation',
    icon: Shield,
  },
  {
    id: 'profile',
    label: 'Profile',
    href: '/profile',
    icon: User,
  },
  {
    id: 'help',
    label: 'Help & Support',
    href: '/help',
    icon: HelpCircle,
  },
];

export default navigationConfig;
