export interface PageMetadata {
  title: string;
  description: string;
}

interface RouteMetadata extends PageMetadata {
  path: string;
}

export const pageMetadata: RouteMetadata[] = [
  {
    path: '/',
    title: 'MedTrack Hub - Intelligent Medical Education',
    description:
      'Explore medical courses, quizzes, flashcards, study planning, and progress tracking in one learning platform.',
  },
  {
    path: '/about',
    title: 'About',
    description:
      'Learn about MedTrack Hub and its tools for medical courses, practice, study planning, and progress tracking.',
  },
  {
    path: '/accessibility',
    title: 'Accessibility',
    description:
      'Read about accessibility improvements at MedTrack Hub and how to report a barrier or request content in another format.',
  },
  {
    path: '/contact',
    title: 'Contact',
    description:
      'Contact MedTrack Hub by email with questions, feedback, or privacy requests.',
  },
  {
    path: '/cookie-policy',
    title: 'Cookie and Device Storage Notice',
    description:
      'Learn how MedTrack Hub uses cookies and browser storage for sign-in, preferences, offline learning, and analytics.',
  },
  {
    path: '/features',
    title: 'Medical Learning Features',
    description:
      'Explore available medical courses, quizzes, flashcards, study planning, progress tracking, study groups, and offline learning tools.',
  },
  {
    path: '/features/progress-tracking',
    title: 'Progress Tracking',
    description:
      'Explore how MedTrack Hub helps learners review course progress, study activity, and learning goals.',
  },
  {
    path: '/features/:slug',
    title: 'Feature Details',
    description: 'Explore a medical learning feature available in MedTrack Hub.',
  },
  {
    path: '/pricing',
    title: 'Pricing',
    description: 'Explore the learning tools available with MedTrack Hub.',
  },
  {
    path: '/privacy',
    title: 'Privacy Notice',
    description:
      'How MedTrack Hub handles personal data under Kenya’s Data Protection Act, 2019.',
  },
  {
    path: '/terms',
    title: 'Terms of Use',
    description:
      'Read the terms for using MedTrack Hub courses, assessments, flashcards, study planning, and other learning tools.',
  },
  {
    path: '/login',
    title: 'Sign In',
    description: 'Sign in to your MedTrack Hub learning account.',
  },
  {
    path: '/register',
    title: 'Create an Account',
    description: 'Create a MedTrack Hub account to access medical learning tools.',
  },
  {
    path: '/forgot-password',
    title: 'Forgot Password',
    description: 'Request instructions to reset your MedTrack Hub account password.',
  },
  {
    path: '/reset-password',
    title: 'Reset Password',
    description: 'Choose a new password for your MedTrack Hub account.',
  },
  {
    path: '/verify-email',
    title: 'Verify Email',
    description: 'Verify the email address associated with your MedTrack Hub account.',
  },
  {
    path: '/resend-verification',
    title: 'Resend Verification Email',
    description: 'Request a new verification email for your MedTrack Hub account.',
  },
  {
    path: '/finish-setup',
    title: 'Complete Your Profile',
    description: 'Finish setting up your MedTrack Hub account profile.',
  },
  {
    path: '/google-consent',
    title: 'Google Account Consent',
    description: 'Review Google account access before continuing to MedTrack Hub.',
  },
  {
    path: '/mfa-setup',
    title: 'Secure Your Account',
    description: 'Set up multi-factor authentication to secure your MedTrack Hub account.',
  },
  {
    path: '/error',
    title: 'Sign-In Error',
    description: 'Resolve an issue encountered while signing in to MedTrack Hub.',
  },
  {
    path: '/dashboard',
    title: 'Dashboard',
    description: 'View your learning activity, goals, and next steps.',
  },
  {
    path: '/analytics',
    title: 'Learning Analytics',
    description: 'Review learning activity, outcomes, and progress analytics.',
  },
  {
    path: '/assessment',
    title: 'Assessments',
    description: 'Browse and manage your medical learning assessments.',
  },
  {
    path: '/assessment/:assessmentId',
    title: 'Assessment',
    description: 'View and complete this medical learning assessment.',
  },
  {
    path: '/chat',
    title: 'Study Assistant',
    description: 'Ask questions and get support for your medical studies.',
  },
  {
    path: '/clinical-cases',
    title: 'Clinical Cases',
    description: 'Explore clinical cases to apply your medical knowledge.',
  },
  {
    path: '/clinical-cases/:caseId',
    title: 'Clinical Case',
    description:
      'Review this case and work through its clinical learning material.',
  },
  {
    path: '/community',
    title: 'Community',
    description: 'Connect with other learners in the MedTrack Hub community.',
  },
  {
    path: '/community/discussions',
    title: 'Discussions',
    description: 'Read and join medical learning discussions.',
  },
  {
    path: '/courses',
    title: 'Courses',
    description: 'Browse available medical courses and learning materials.',
  },
  {
    path: '/courses/:courseId',
    title: 'Course Details',
    description: 'Explore course content, units, and learning resources.',
  },
  {
    path: '/courses/:courseId/units/:unitId',
    title: 'Course Unit',
    description: 'Study the lessons and materials in this course unit.',
  },
  {
    path: '/courses/:courseId/units/:unitId/topics/:topicId',
    title: 'Course Topic',
    description: 'Review this course topic and its learning resources.',
  },
  {
    path: '/flashcards',
    title: 'Flashcard Decks',
    description: 'Browse flashcard decks and review medical topics.',
  },
  {
    path: '/flashcards/:id',
    title: 'Flashcard Review',
    description: 'Review flashcards and reinforce your medical knowledge.',
  },
  {
    path: '/gamification',
    title: 'Gamification',
    description: 'View your learning achievements, points, and activity.',
  },
  {
    path: '/instructor',
    title: 'Instructor Dashboard',
    description: 'Manage teaching activities and course resources.',
  },
  {
    path: '/learning-paths',
    title: 'Learning Paths',
    description: 'Explore structured learning paths for your studies.',
  },
  {
    path: '/learning-paths/:id',
    title: 'Learning Path',
    description: 'View the modules and progress in this learning path.',
  },
  {
    path: '/notifications',
    title: 'Notifications',
    description: 'Review updates and notifications for your account.',
  },
  {
    path: '/offline',
    title: 'Offline Learning',
    description: 'Manage saved learning materials and offline activity.',
  },
  {
    path: '/onboarding',
    title: 'Welcome',
    description: 'Set up your learning profile and study preferences.',
  },
  {
    path: '/profile',
    title: 'Profile',
    description: 'View your account profile and learning information.',
  },
  {
    path: '/profile/achievements',
    title: 'Achievements',
    description: 'Review milestones and achievements from your learning.',
  },
  {
    path: '/profile/edit',
    title: 'Edit Profile',
    description: 'Update your account profile and personal preferences.',
  },
  {
    path: '/profile/sessions',
    title: 'Active Sessions',
    description: 'Review and manage active sessions for your account.',
  },
  {
    path: '/progress',
    title: 'Learning Progress',
    description: 'Track your course progress, study activity, and goals.',
  },
  {
    path: '/quiz',
    title: 'Quizzes',
    description: 'Browse quizzes and practice medical topics.',
  },
  {
    path: '/quiz/history',
    title: 'Quiz History',
    description: 'Review your previous quiz attempts and results.',
  },
  {
    path: '/quiz/results',
    title: 'Quiz Results',
    description: 'Review your quiz performance and recent results.',
  },
  {
    path: '/quiz/unit/:unitId',
    title: 'Unit Quiz',
    description: 'Practice with questions from this course unit.',
  },
  {
    path: '/quiz/:unitId',
    title: 'Quiz Session',
    description: 'Complete this medical learning quiz.',
  },
  {
    path: '/rewards',
    title: 'Rewards',
    description: 'View rewards earned through your learning activity.',
  },
  {
    path: '/search',
    title: 'Search',
    description: 'Search courses, learning materials, and community content.',
  },
  {
    path: '/security',
    title: 'Account Security',
    description: 'Review and manage security settings for your account.',
  },
  {
    path: '/settings',
    title: 'Settings',
    description: 'Manage your account and application preferences.',
  },
  {
    path: '/study-groups',
    title: 'Study Groups',
    description: 'Find and manage groups for collaborative learning.',
  },
  {
    path: '/study-planner',
    title: 'Study Planner',
    description: 'Organize study sessions, materials, and learning goals.',
  },
  {
    path: '/study-planner/goals',
    title: 'Learning Goals',
    description: 'Set and review your study and learning goals.',
  },
  {
    path: '/study-planner/materials',
    title: 'Study Materials',
    description: 'Browse and organize your study materials.',
  },
  {
    path: '/study-planner/materials/upload',
    title: 'Upload Study Material',
    description: 'Add a study resource to your materials library.',
  },
  {
    path: '/study-planner/materials/:id',
    title: 'Study Material',
    description: 'View this study resource and its details.',
  },
  {
    path: '/study-planner/schedule',
    title: 'Academic Schedule',
    description:
      'Manage your timetable, lectures, study sessions, and exam deadlines.',
  },
  {
    path: '/unit/:unitId',
    title: 'Course Unit',
    description: 'Study this unit and its learning materials.',
  },
  {
    path: '/admin',
    title: 'Admin Control Center',
    description: 'Manage platform users, courses, and administration.',
  },
  {
    path: '/admin/analytics',
    title: 'System Analytics',
    description: 'Review usage and performance analytics for the platform.',
  },
  {
    path: '/admin/audit-logs',
    title: 'Audit Logs',
    description: 'Review administrative and security audit events.',
  },
  {
    path: '/admin/content',
    title: 'Content Management',
    description: 'Manage learning content published on the platform.',
  },
  {
    path: '/admin/materials/upload',
    title: 'Materials Library',
    description: 'Upload and manage shared learning materials.',
  },
  {
    path: '/admin/performance',
    title: 'Platform Performance',
    description: 'Monitor platform performance and operational metrics.',
  },
  {
    path: '/admin/roles',
    title: 'Roles and Permissions',
    description: 'Manage platform roles and access permissions.',
  },
  {
    path: '/admin/settings',
    title: 'System Settings',
    description: 'Configure platform-wide settings.',
  },
  {
    path: '/admin/users',
    title: 'User Management',
    description: 'Manage user accounts and access.',
  },
  {
    path: '/unauthorized',
    title: 'Access Denied',
    description: 'Your account does not have access to this page.',
  },
];

export const getPageMetadata = (pathname: string): PageMetadata => {
  const segments = pathname.split('/').filter(Boolean);
  const route = pageMetadata.find(({ path }) => {
    const patternSegments = path.split('/').filter(Boolean);
    return (
      patternSegments.length === segments.length &&
      patternSegments.every(
        (segment, index) => segment.startsWith(':') || segment === segments[index],
      )
    );
  });

  if (route) return { title: route.title, description: route.description };

  const lastSegment = segments.at(-1);
  return {
    title:
      lastSegment
        ?.replace(/[-_]/g, ' ')
        .replace(/\b\w/g, character => character.toUpperCase()) ?? 'Dashboard',
    description: 'Explore your medical learning and account information.',
  };
};

export const applyPageMetadata = ({ title, description }: PageMetadata): void => {
  document.title = title.toLowerCase().endsWith('medtrack hub')
    ? title
    : `${title} | MedTrack Hub`;

  let descriptionElement = document.querySelector<HTMLMetaElement>(
    'meta[name="description"]',
  );
  if (!descriptionElement) {
    descriptionElement = document.createElement('meta');
    descriptionElement.name = 'description';
    document.head.appendChild(descriptionElement);
  }
  descriptionElement.content = description;
};
