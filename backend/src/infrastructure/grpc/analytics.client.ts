import { Observable } from 'rxjs';
import type { GetDetailedLearningAnalyticsResponse } from '../../generated/grpc/analytics';

export interface AnalyticsService {
  updateBkt(data: {
    userId: string;
    skillId: string;
    isCorrect: boolean;
  }): Observable<any>;

  getUserFeatureVector(data: { userId: string }): Observable<{
    user_id: string;
    features: number[];
    featureMap: Record<string, number>;
  }>;

  getUserAbility(data: { userId: string }): Observable<{
    user_id: string;
    estimated_ability: number;
    p_known_by_skill: Record<string, number>;
  }>;

  getDueCards(data: { userId: string }): Observable<{
    cards: Array<{
      card_id: string;
      topic_id: string;
      question: string;
      due: string;
    }>;
  }>;

  getFocusRecommendations(data: {
    userId: string;
    limit: number;
  }): Observable<{
    areas: Array<{
      topic: string;
      card_count: number;
      pass_rate: number;
    }>;
  }>;

  calculateCourseProgress(data: {
    userId: string;
    courseId: string;
  }): Observable<any>;

  getGoalAnalytics(data: { userId: string; goals: any[] }): Observable<{
    goalAnalytics?: {
      userId: string;
      totalGoals: number;
      activeGoals: number;
      completedGoals: number;
      overdueGoals: number;
      completionRate: number;
      averageCompletionTimeDays: number;
      goalsByCategory: Record<string, number>;
      goalsByPriority: Record<string, number>;
      currentStreak: number;
      longestStreak: number;
      streakGoalIds: string[];
      upcomingDeadlines: Array<{
        goalId: string;
        title: string;
        targetDate: string;
        daysRemaining: number;
      }>;
    };
  }>;

  getCourseStatistics(data: { userId: string }): Observable<{
    course_stats: {
      total_courses: number;
      completed_courses: number;
      total_study_time_minutes: number;
      average_course_progress: number;
    };
  }>;

  getRecommendations(data: { userId: string }): Observable<{
    items: Array<{
      id: string;
      title: string;
      description: string;
      type: string;
      score: number;
      reason: string;
    }>;
  }>;

  getUserLearningSummary(data: { userId: string }): Observable<{
    total_study_time: number;
    average_session_length: number;
    average_score: number;
    current_streak: number;
    longest_streak: number;
    strongest_subjects: string[];
    weakest_subjects: string[];
  }>;

  predictPerformance(data: { userId: string; skillId: string }): Observable<{
    score: number;
  }>;

  getEngagementMetrics(data: { userId: string }): Observable<{
    user_id: string;
    time_spent: number;
    completion_rate: number;
    activity_frequency: number;
    daily_active_streak: number;
    weekly_active_streak: number;
    session_count: number;
    average_session_duration: number;
  }>;

  getLearningPathStatistics(data: { userId: string }): Observable<{
    path_stats: {
      total_learning_paths: number;
      completed_learning_paths: number;
      total_study_time_minutes: number;
      average_path_progress: number;
    };
  }>;

  updateBktSkillMetrics(data: Record<string, unknown>): Observable<{
    success: boolean;
    message: string;
  }>;

  batchTrackEvents(data: {
    userId: string;
    events: Array<{
      eventType: string;
      timestamp: string;
      sessionId: string | null;
      duration: number;
    }>;
  }): Observable<{
    success: boolean;
    processed: number;
  }>;

  getUserDataForProfile(data: { userId: string }): Observable<any>;

  getDetailedLearningAnalytics(
    data: { userId: string },
  ): Observable<GetDetailedLearningAnalyticsResponse>;

  getCollaborativeRecommendations(data: {
    userId: string;
    limit: number;
  }): Observable<{
    items: Array<{
      item_id: string;
      score: number;
      reason: string;
    }>;
  }>;

  generateStudyRecommendations(data: {
    userId: string;
    knowledgeGaps: string[];
  }): Observable<{
    recommendations: Array<{
      recommendation: string;
      priority: string;
      estimated_time_hours: number;
      resource_id: string;
    }>;
  }>;

  getTrendingPaths(data: { limit: number }): Observable<{
    paths: Array<{
      path_id: string;
      popularity: number;
    }>;
  }>;

  getPathRecommendations(data: { userId: string; limit: number }): Observable<{
    recommendations: Array<{
      path_id: string;
      score: number;
      reasons: string[];
      confidence: number;
    }>;
  }>;

  getRelatedResources(data: {
    resourceId: string;
    limit?: number;
  }): Observable<{
    resources: Array<{
      id: string;
      title: string;
      type: string;
      score: number;
    }>;
  }>;

  generateNextSteps(data: { userId: string }): Observable<{
    steps: Array<{
      step: string;
      reason: string;
      estimated_duration_minutes: number;
    }>;
  }>;

  predictBkt(data: {
    userId: string;
    skillId: string;
    featureVector: number[];
  }): Observable<{
    p_known: number;
    p_next_correct: number;
  }>;

  predictBurnModel(data: { userId: string; features: number[] }): Observable<{
    retention_score: number;
    model_version: string;
  }>;

  updateQuestionStatistics(data: {
    questionId: string;
    isCorrect: boolean;
    responseTimeMs: number;
  }): Observable<any>;

  getNextAdaptiveQuestion(data: { userId: string }): Observable<{
    question_id: string;
    recommended_difficulty: number;
  }>;

  getSpacedRepetitionStats(data: { userId: string }): Observable<{
    total_cards: number;
    due_today: number;
    mastered_cards: number;
    learning_cards: number;
    relearning_cards: number;
    avg_ease_factor: number;
    avg_interval_days: number;
    recent_pass_rate: number;
  }>;

  analyzeQuestionDifficulty(data: {
    userId: string;
    question: any;
  }): Observable<{
    difficulty_score: number;
    suggestion: string;
  }>;

  getQuizAttemptHistory(data: {
    userId: string;
    limit?: number;
    offset?: number;
  }): Observable<{
    attempts: any[];
  }>;

  getPathAnalytics(data: { pathId: string }): Observable<any>;

  predictSuccessRate(data: {
    userId: string;
    features: number[];
  }): Observable<any>;

  extractQuizzes(data: {
    materialId: string;
    filePath: string;
  }): Observable<{
    success: boolean;
    questions_count: number;
    message: string;
  }>;
}
