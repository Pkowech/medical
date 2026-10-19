import { Brain, Activity, BookOpen, Target, WifiOff } from 'lucide-react';

export const features = [
  {
    icon: Brain,
    title: 'Quiz and flashcard practice',
    description:
      'Practice with available quizzes and use flashcards to review medical topics.',
    details: ['Quiz practice', 'Flashcard review', 'Available course content'],
  },
  {
    icon: Activity,
    title: 'Study progress',
    description:
      'Review course progress, study activity, and learning goals from your dashboard.',
    details: ['Course progress', 'Study activity', 'Learning goals'],
  },
  {
    icon: BookOpen,
    title: 'Medical course catalog',
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
    title: 'Study planning',
    description:
      'Plan study time and organize goals alongside your course learning.',
    details: ['Study schedules', 'Learning goals', 'Course-focused planning'],
  },
  {
    icon: WifiOff,
    title: 'Offline study and progress syncing',
    description:
      'Download complete topics while online to read saved PDFs and practice quizzes offline. Supported quiz and progress updates queue on this device and sync when connectivity returns.',
    details: [
      'Download complete topics for offline study',
      'Saved PDFs and practice quizzes stay available offline',
      'Supported updates sync when you reconnect',
    ],
  },
];
