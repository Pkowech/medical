export interface PathModule {
  id: string;
  title: string;
  description: string;
  type: 'course' | 'assessment' | 'clinicalCase' | 'resource' | 'milestone' | 'custom';
  resourceId?: string;
  estimatedHours?: number;
  isRequired: boolean;
  unlockConditions?: string[];
  order: number;
}

export interface PathPhase {
  id: string;
  title: string;
  description: string;
  order: number;
  estimatedWeeks: number;
  modules: PathModule[];
}

export interface Milestone {
  id: string;
  title: string;
  description: string;
  type: string;
  order: number;
  isRequired: boolean;
  rewards?: {
    points?: number;
    badgeId?: string;
    certificate?: { templateId: string; title?: string; description?: string };
  };
}

export interface LearningPath {
  id: string;
  title: string;
  description: string;
  category: string;
  difficulty: string;
  status: string;
  estimatedDurationWeeks: number;
  estimatedHoursPerWeek: number;
  tags: string[];
  learningObjectives: string[];
  analytics: {
    totalEnrollments: number;
    completionRate: number;
    userRatings: {
      average: number;
      count: number;
    };
  };
  createdBy: {
    id: string;
    firstName: string;
    lastName: string;
  };
  courses: any[];
  milestones: Milestone[];
  specialization?: string;
  pathStructure?: {
    phases: PathPhase[];
  };
}

export interface ModuleProgress {
  moduleId: string;
  phaseId: string;
  status: 'notStarted' | 'inProgress' | 'completed' | 'skipped';
  progressPercentage: number;
  timeSpentMinutes: number;
  bestScore?: number;
}

export interface PhaseProgress {
  phaseId: string;
  status: 'notStarted' | 'inProgress' | 'completed';
  progressPercentage: number;
  modulesCompleted: string[];
  currentModuleId?: string;
}

export interface LearningPathProgress {
  id: string;
  overallProgressPercentage: number;
  status: string;
  startedAt: string;
  lastAccessedAt: string;
  learningPath: LearningPath;
  milestonesAchieved: {
    milestoneId: string;
    achievedAt: string;
  }[];
  currentPhaseIndex: number;
  currentModuleIndex: number;
  phaseProgress: PhaseProgress[];
  moduleProgress: ModuleProgress[];
}

export interface PathItemRecommendation {
  id: string;
  title: string;
  description: string;
  type: 'video' | 'article' | 'quiz';
  metadata: Record<string, any>;
}

export interface PathAnalytics {
  pathId: string;
  title: string;
  totalEnrollments: number;
  activeEnrollments: number;
  completedEnrollments: number;
  completionRate: number;
  averageCompletionTimeDays: number;
  averageProgressPercentage: number;
  dropoutRate: number;
  userSatisfaction: {
    averageRating: number;
    totalRatings: number;
  };
  engagementMetrics: {
    averageSessionDuration: number;
    sessionsPerWeek: number;
    streakData: {
      averageStreak: number;
      maxStreak: number;
    };
  };
  milestoneAnalytics: {
    milestoneId: string;
    title: string;
    achievementRate: number;
    averageTimeToAchieve: number;
  }[];
  bottlenecks: {
    phaseId: string;
    phaseTitle: string;
    averageTimeSpent: number;
    dropoutRate: number;
  }[];
}

// UserInsights moved to analyticsInterface.ts

export interface LearningPathAnalyticsProps {
  pathId?: string;
  showUserInsights?: boolean;
}

// StatCardProps removed - moved to uiInterface.ts