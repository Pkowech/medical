import { BaseEntity } from '@/shared/types/systemInterface';

/**
 * Core Analytics Types
 */

// Base analytics interface
export interface BaseAnalytics {
  timestamp?: string;
  period?: 'daily' | 'weekly' | 'monthly';
}

/**
 * User Analytics Types
 */

// Core user analytics metrics
export interface UserAnalyticsMetrics {
  quizzesTaken: number;
  flashcardsReviewed: number;
  materialsCovered: number;
  studyTime: number; // in minutes
  completedItems: number;
  accuracy: number; // percentage as decimal
  streak: number;
  points: number;
}

// Comprehensive user analytics
export interface UserAnalytics extends BaseAnalytics {
  userId: string;
  learningVelocity: number; // learning speed metric (0-100)
  averageScore: number;
  completionRate: number; // percentage as decimal
  timeSpent: number; // in seconds
  weakAreas: string[]; // topic identifiers
  strongAreas: string[]; // topic identifiers
  lastActive: string; // ISO 8601 timestamp
  metrics: UserAnalyticsMetrics;
  totalStudyHours?: number;
  coursesCompleted?: number;
  assessmentsTaken?: number;
  currentModules?: string[];
  progressOverTime?: Array<{ date: string; progress: number }>;
  moduleCompletion?: Array<{ moduleName: string; completion: number }>;
  assessmentScores?: Array<{ assessmentName: string; score: number }>;
  timeSpentPerTopic?: Array<{ topic: string; time: number }>;
}

/**
 * Learning Path Analytics
 */

export interface LearningRecommendation {
  id: string;
  title: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedDuration: number;
  matchScore: number;
  prerequisites: string[];
  tags: string[];
  estimatedTime?: string | number;
}

export interface LearningPathAnalytics extends BaseAnalytics {
  pathId: string;
  enrollments: number;
  completions: number;
  averageTimeToComplete: number; // in days
  dropoffPoints: Array<{
    moduleId: string;
    dropoffCount: number;
    averageTimeSpent: number; // in minutes
  }>;
  successRate: number; // percentage as decimal
}

/**
 * Assessment Analytics
 */

export interface AssessmentPrediction {
  assessmentId: string;
  assessmentName: string;
  predictedScore: number;
  confidence: number;
  recommendation: string;
  recommendedPreparation: string[];
  difficultyAreas: string[];
  timeToReady: number;
}

export interface AssessmentAnalytics extends BaseAnalytics {
  assessmentId: string;
  title: string;
  score: number;
  maxScore: number;
  completionDate: string;
  timeTakenSeconds: number;
  performanceByCategory: Array<{
    category: string;
    score: number;
  }>;
  percentile: number;
  areasForImprovement: string[];
}

export interface GetUserAnalyticsResponse {
  success: boolean;
  data: UserAnalytics;
}

export interface ConsolidatedAnalytics {
  coursesCompleted: number;
  averageScore: number;
  totalStudyHours: number;
  achievementsUnlocked: number;
  peerRanking: string;
  learningEfficiency: number;
  overview: {
    totalUsers: number;
    activeUsers: number;
    completionRate: number;
    averageScore: number;
  };
  trends: {
    date: string;
    users: number;
    completions: number;
    averageScore: number;
  }[];
  topPerformers: {
    userId: string;
    name: string;
    score: number;
    completions: number;
  }[];
  learningPatterns?: unknown;
  performancePredictions?: unknown;
  studyRecommendations?: AISuggestion[] | unknown;
  updatedAt?: number;
}

export interface UserInsights {
  learningPattern?: 'visual' | 'auditory' | 'kinesthetic' | 'mixed';
  optimalStudyTime?: string;
  recommendedBreakFrequency?: number;
  motivationFactors?: string[];
  riskFactors?: string[];
  engagementScore?: number;
  userId?: string;
  learningVelocity?: number;
  goalAchievementRate?: number;
  strongestCategories?: string[];
  improvementAreas?: string[];
  recommendedNextSteps?: string[];
  strengths?: string[];
  areasForImprovement?: string[];
  estimatedCompletionDate?: string;
}

/**
 * Analytics activity record
 */
export interface AnalyticsActivity {
  id: string;
  type: string;
  title: string;
  date: string;
}

export interface AnalyticsMetrics {
  studyTime: {
    daily: number;
    weekly: number;
    monthly: number;
  };
  quizPerformance: {
    avgScore: number;
    totalQuizzes: number;
    improvement: number;
  };
  learningRate: {
    currentSpeed: number;
    trend: 'increasing' | 'stable' | 'decreasing';
  };
  weakAreas: {
    topic: string;
    score: number;
  }[];
  strengths: {
    topic: string;
    score: number;
  }[];
  progressOverTime: {
    labels: string[];
    datasets: {
      label: string;
      data: number[];
      borderColor?: string;
      backgroundColor?: string;
    }[];
  };
  quizScores: {
    labels: string[];
    datasets: {
      label: string;
      data: number[];
      backgroundColor?: string;
    }[];
  };
}

export interface AuditLogEntry extends BaseEntity {
  action: string;
  actorId: string;
  actorName?: string;
  targetId?: string;
  timestamp: string;
  details?: Record<string, unknown>;
}

export interface AggregateUserActivity {
  signups: { date: string; count: number }[];
  logins: { date: string; count: number }[];
  courseCompletions: { date: string; count: number }[];
}

export interface SystemAnalytics {
  totalUsers: number;
  activeUsers: number; // For compatibility
  activeLearners?: number; // Real field from backend
  totalCourses: number;
  completedCourses?: number;
  totalEnrollments: number;
  totalAssessments?: number;
  totalPaths?: number;
  averageCompletionRate?: number;
  overallCompletionRate?: number;
  userActivity?: AggregateUserActivity;
  lastUpdated?: number;
}

export interface PerformanceData {
  userId: string;
  overallScore: number;
  categoryBreakdown: {
    category: string;
    score: number;
    questionsAnswered: number;
    averageTime: number;
    strengths: string[];
    weaknesses: string[];
  }[];
  learningTrends: {
    date: string;
    score: number;
    category: string;
  }[];
  knowledgeGaps: {
    topic: string;
    severity: 'low' | 'medium' | 'high';
    recommendedActions: string[];
  }[];
  studyRecommendations: {
    priority: 'high' | 'medium' | 'low';
    topic: string;
    estimatedStudyTime: number;
    resources: string[];
  }[];
  nextSteps: string[];
}

/**
 * Lightweight service-related types used by UI components.
 * These mirror expected shapes from backend APIs and replace ad-hoc mock type files.
 */

// NOTE: A simpler, UI-friendly AssessmentAnalytics and PerformanceInsight are declared
// later in this file to match component expectations (assessmentName, score, areasForImprovement, etc.).

export interface AISuggestion {
  id?: string;
  title?: string;
  description?: string;
  type?: string;
  link?: string;
  priority?: 'High' | 'Medium' | 'Low';
  rationale?: string;
  relatedTopics?: string[];
  estimatedTime?: number | string;
}

export interface PerformanceInsight {
  category?: string;
  strength?: string;
  weakness?: string;
  recommendation?: string;
}

export interface UserPoints {
  totalPoints: number;
  pointsEarnedToday?: number;
}

// Peer benchmarking UI types (moved from hooks)
export interface PeerBenchmark {
  userId: string;
  username: string;
  score: number;
  rank: number;
  percentile: number;
  totalParticipants: number;
}

export interface BenchmarkStats {
  userRank: number;
  userPercentile: number;
  averageScore: number;
  topScore: number;
  totalParticipants: number;
  userScore: number;
}

// Simple/UI-friendly shapes used in admin and other UI components
export interface SimpleUser {
  id: string;
  name?: string;
  email?: string;
}

export interface SimpleCourse extends BaseEntity {
  title: string;
  description?: string;
  category?: string;
  instructor?: string | SimpleUser;
  durationHours?: number;
  price?: number;
  isPublished?: boolean;
}

// named exports only (no default)
// Types for analytics data matching backend response structures
// Unused duplicate interface removed

export interface PerformanceMetrics {
  userId: string;
  period: 'daily' | 'weekly' | 'monthly';
  averageScore?: number;
  assessmentsCompleted?: number;
  timeSpentLearningHours?: number;
  improvementRate?: number;

  metrics: {
    studyTime: number; // in minutes
    completedItems: number;
    accuracy: number; // percentage as decimal
    streak: number;
    points: number;
  };
  trends: {
    date: string; // YYYY-MM-DD
    value: number;
  }[];
}

// Response types for analytics endpoints

export interface GetLearningPathAnalyticsResponse {
  success: boolean;
  data: LearningPathAnalytics;
  timestamp: string;
}

// Peer benchmarking types (moved from services)
export interface PeerStats {
  averageScore: number;
  percentile: number;
  completionRate: number;
  studyTime: number;
  rank: number;
  totalPeers: number;
}

export interface TrendData {
  period: string;
  userScore: number;
  peerAverage: number;
}

export interface PeerGroup {
  id: string;
  name: string;
  memberCount: number;
  averageScore: number;
}

// Performance monitor metric interfaces (moved from services/performanceMonitor)
export interface PerformanceMetric {
  name: string;
  value: number;
  timestamp: number;
  tags?: Record<string, string>;
}

export interface PageLoadMetric {
  url: string;
  loadTime: number;
  domContentLoaded: number;
  firstContentfulPaint: number;
  largestContentfulPaint: number;
  timeToInteractive: number;
  timestamp: number;
}

export interface ApiPerformanceMetric {
  endpoint: string;
  method: string;
  duration: number;
  status: number;
  timestamp: number;
}

export interface ResourceMetric {
  name: string;
  type: 'script' | 'style' | 'image' | 'font' | 'other';
  size: number;
  loadTime: number;
  timestamp: number;
}

// Lightweight analytics types used across the analytics module.
// Detailed peer comparison metrics
export interface DetailedComparison {
  category: string;
  userScore: number;
  peerAverage: number;
  topPerformers: number;
  percentile: number;
}
