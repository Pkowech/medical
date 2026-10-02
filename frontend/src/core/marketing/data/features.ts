import { Brain, Activity, BookOpen, Users, Target, WifiOff } from 'lucide-react';

export const features = [
  {
    icon: Brain,
    title: 'Precision AI Tutoring',
    description:
      'Adaptive quiz experiences and study recommendations help learners focus their review using available learning activity.',
    details: ['Adaptive quiz sessions', 'Study recommendations', 'Progress-informed review'],
  },
  {
    icon: Activity,
    title: 'Clinical Case Analytics',
    description:
      'Review available course and assessment analytics to follow learning progress and identify topics for further study.',
    details: ['Course and assessment progress', 'Performance trends', 'Study insights when data is available'],
  },
  {
    icon: BookOpen,
    title: 'Course and Case Library',
    description:
      'Explore the medical courses, lessons, and clinical cases currently available in the catalog. Content coverage varies by course.',
    details: [
      'Course modules and topics',
      'Clinical cases where available',
      'Catalog availability varies',
    ],
  },
  {
    icon: Target,
    title: 'Assessment and Progress Tracking',
    description:
      'Practice with quizzes and track course progress, study activity, and learning goals from your dashboard.',
    details: ['Quiz results and trends', 'Course completion tracking', 'Study goals and activity'],
  },
  {
    icon: Users,
    title: 'Peer Learning',
    description:
      'Use available community and study-group features to organize learning and connect with other learners.',
    details: ['Study groups', 'Group schedules', 'Community features'],
  },
  {
    icon: WifiOff,
    title: 'Offline Access',
    description:
      'The app shell and selected public assets may be available offline. Supported quiz and progress updates can queue in this browser and sync when connectivity returns.',
    details: [
      'Supported updates queue locally',
      'Queued updates sync when online',
      'Courses and PDFs are not downloadable for offline use yet',
    ],
  },
];
