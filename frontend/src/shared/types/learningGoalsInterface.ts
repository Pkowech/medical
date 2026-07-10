export interface LearningGoal {
  id: string;
  title: string;
  description: string;
  type: string;
  category: string;
  status: string;
  priority: string;
  targetCriteria: {
    type: string;
    targetValue: number | string;
    currentValue?: number | string;
    unit?: string;
  };
  startDate: string;
  targetDate: string;
  completedAt?: string;
  progressPercentage: number;
  streakCount: number;
  milestones?: {
    id: string;
    title: string;
    targetValue: number;
    completed: boolean;
    targetDate: string;
  }[];
  learningPath?: {
    id: string;
    title: string;
  };
  course?: {
    id: string;
    title: string;
  };
  dependsOnGoalId?: string;
  blockedReason?: string;
  dependsOn?: Partial<LearningGoal>;
  dependencies?: Partial<LearningGoal>[];
}

export interface GoalAnalytics {
  totalGoals: number;
  activeGoals: number;
  completedGoals: number;
  overdueGoals: number;
  completionRate: number;
  averageCompletionTimeDays: number;
  goalsByCategory: { [key: string]: number };
  goalsByPriority: { [key: string]: number };
  streakData: {
    currentStreak: number;
    longestStreak: number;
  };
  upcomingDeadlines: {
    goalId: string;
    title: string;
    targetDate: string;
    daysRemaining: number;
  }[];
}

// Define the types for the recommended goal and the response
export interface RecommendedGoal {
  title: string;
  description: string;
  category: string;
  type: string;
  recommendationReason: string;
  recommendationSource: string;
  relatedId?: string;
}

export interface RecommendedGoalsResponse {
  recommendations: RecommendedGoal[];
}

export interface GoalCreationWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onGoalCreated: () => void;
  initialData?: Partial<LearningGoal>;
}

export interface SMARTSuggestions {
  specific: string;
  measurable: string;
  achievable: string;
  relevant: string;
  timeBound: string;
}