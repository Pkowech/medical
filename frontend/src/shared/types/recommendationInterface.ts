import { LearningPath } from './learningInterface';

/**
 * Recommendation Score - used for path recommendation scoring
 * Represents a scored recommendation for a learning path candidate
 */
export interface RecommendationScore {
  pathId: string;
  score: number;
  reasons: string[];
  confidence: number;
  estimatedCompletionTime?: number;
  learningPath?: LearningPath;
}

/**
 * Trending Path - represents popular learning paths
 * Based on enrollment, completion, and user ratings
 */
export interface TrendingPath {
  id?: string;
  pathId?: string;
  title?: string;
  description?: string;
  difficulty?: string;
  category?: string;
  analytics?: {
    userRatings?: { average?: number; count?: number };
    totalEnrollments?: number;
    completionRate?: number;
  };
  estimatedDurationWeeks?: number;
  popularity?: number;
}

/**
 * Adaptive Learning Configuration
 * Personalized learning preferences and tracking settings
 */
export interface AdaptiveLearningConfig {
  userId: string;
  learningPathId: string;
  preferences: {
    studyTime: number; // in minutes
    preferredLearningStyles: ('visual' | 'auditory' | 'kinesthetic')[];
    difficultyLevel: 'beginner' | 'intermediate' | 'advanced';
  };
  progressTracking: {
    enabled: boolean;
    milestones: {
      id: string;
      title: string;
      description: string;
      targetDate: string; // ISO 8601 format
    }[];
  };
  contentRecommendations: {
    enabled: boolean;
    criteria: {
      topics: string[];
      difficultyLevel: 'beginner' | 'intermediate' | 'advanced';
    };
  };
}
