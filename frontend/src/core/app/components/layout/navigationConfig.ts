import {
  LayoutDashboard,
  GraduationCap,
  Route,
  Brain,
  FileText,
  Calendar,
  Target,
  Users,
  User,
  BarChart,
  Search,
  Shield,
  MessageSquare,
  Clock,
  HardDriveDownload,
  Trophy,
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
    id: 'practice',
    label: 'Practice',
    icon: Brain,
    children: [
      {
        id: 'assessments',
        label: 'Assessments',
        href: '/assessment',
        icon: FileText,
      },
      {
        id: 'quizzes',
        label: 'Quizzes',
        href: '/quiz',
        icon: Target,
        children: [
          {
            id: 'quiz-history',
            label: 'Quiz History',
            href: '/quiz/history',
            icon: Clock,
          },
        ],
      },
      {
        id: 'flashcards',
        label: 'Flashcards',
        href: '/flashcards',
        icon: Brain,
      },
      {
        id: 'clinical-cases',
        label: 'Clinical Cases',
        href: '/clinical-cases',
        icon: GraduationCap,
      },
      {
        id: 'rapid-review',
        label: 'Rapid Review',
        href: '/rapid-review',
        icon: Clock,
      },
    ],
  },
  {
    id: 'search',
    label: 'Search',
    href: '/search',
    icon: Search,
  },
  {
    id: 'offline-downloads',
    label: 'Offline downloads',
    href: '/offline',
    icon: HardDriveDownload,
  },
  {
    id: 'learning-paths',
    label: 'Learning Paths',
    href: '/learning-paths',
    icon: Route,
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
    label: 'Progress & Analytics',
    href: '/progress',
    icon: BarChart,
    children: [
      {
        id: 'learning-analytics',
        label: 'Analytics',
        href: '/analytics',
        icon: BarChart,
      },
    ],
  },
  {
    id: 'achievements',
    label: 'Achievements',
    href: '/gamification',
    icon: Trophy,
    children: [
      {
        id: 'rewards',
        label: 'Rewards',
        href: '/rewards',
        icon: Trophy,
      },
      {
        id: 'profile-achievements',
        label: 'Milestones',
        href: '/profile/achievements',
        icon: Target,
      },
    ],
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
        id: 'messages',
        label: 'Messages',
        href: '/chat',
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
    id: 'profile',
    label: 'Profile',
    href: '/profile',
    icon: User,
  },
];

export default navigationConfig;
