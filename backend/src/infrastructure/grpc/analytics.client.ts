import { Observable } from 'rxjs';

export interface AnalyticsService {
  updateBkt(data: {
    user_id: string;
    skill_id: string;
    is_correct: boolean;
  }): Observable<any>;

  getUserFeatureVector(data: { user_id: string }): Observable<{
    user_id: string;
    features: number[];
    featureMap: Record<string, number>;
  }>;

  getUserAbility(data: { user_id: string }): Observable<{
    user_id: string;
    estimated_ability: number;
    p_known_by_skill: Record<string, number>;
  }>;

  getDueCards(data: { user_id: string }): Observable<{
    cards: Array<{
      card_id: string;
      topic_id: string;
      question: string;
      due: string;
    }>;
  }>;

  getFocusRecommendations(data: {
    user_id: string;
    limit: number;
  }): Observable<{
    areas: Array<{
      topic: string;
      card_count: number;
      pass_rate: number;
    }>;
  }>;

  calculateCourseProgress(data: {
    user_id: string;
    course_id: string;
  }): Observable<any>;

  getGoalAnalytics(data: { user_id: string; goals: any[] }): Observable<{
    goal_analytics: {
      user_id: string;
      total_goals: number;
      active_goals: number;
      completed_goals: number;
      overdue_goals: number;
      completion_rate: number;
      average_completion_time_days: number;
      goals_by_category: Record<string, number>;
      goals_by_priority: Record<string, number>;
      current_streak: number;
      longest_streak: number;
      streak_goal_ids: string[];
      upcoming_deadlines: Array<{
        goal_id: string;
        title: string;
        target_date: string;
        days_remaining: number;
      }>;
    };
  }>;

  getCourseStatistics(data: { user_id: string }): Observable<{
    course_stats: {
      total_courses: number;
      completed_courses: number;
      total_study_time_minutes: number;
      average_course_progress: number;
    };
  }>;

  getRecommendations(data: { user_id: string }): Observable<{
    items: Array<{
      id: string;
      title: string;
      description: string;
      type: string;
      score: number;
      reason: string;
    }>;
  }>;

  getUserLearningSummary(data: { user_id: string }): Observable<{
    total_study_time: number;
    average_session_length: number;
    average_score: number;
    current_streak: number;
    longest_streak: number;
    strongest_subjects: string[];
    weakest_subjects: string[];
  }>;

  predictPerformance(data: { user_id: string; skill_id: string }): Observable<{
    score: number;
  }>;

  getEngagementMetrics(data: { user_id: string }): Observable<{
    user_id: string;
    time_spent: number;
    completion_rate: number;
    activity_frequency: number;
    daily_active_streak: number;
    weekly_active_streak: number;
    session_count: number;
    average_session_duration: number;
  }>;

  getLearningPathStatistics(data: { user_id: string }): Observable<{
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
    user_id: string;
    events: Array<{
      event_type: string;
      timestamp: string;
      session_id: string | null;
      duration: number;
    }>;
  }): Observable<{
    success: boolean;
    processed: number;
  }>;

  getUserDataForProfile(data: { user_id: string }): Observable<any>;

  getDetailedLearningAnalytics(data: { user_id: string }): Observable<any>;

  getCollaborativeRecommendations(data: {
    user_id: string;
    limit: number;
  }): Observable<{
    items: Array<{
      item_id: string;
      score: number;
      reason: string;
    }>;
  }>;

  generateStudyRecommendations(data: {
    user_id: string;
    knowledge_gaps: string[];
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

  getPathRecommendations(data: { user_id: string; limit: number }): Observable<{
    recommendations: Array<{
      path_id: string;
      score: number;
      reasons: string[];
      confidence: number;
    }>;
  }>;

  getRelatedResources(data: {
    resource_id: string;
    limit?: number;
  }): Observable<{
    resources: Array<{
      id: string;
      title: string;
      type: string;
      score: number;
    }>;
  }>;

  generateNextSteps(data: { user_id: string }): Observable<{
    steps: Array<{
      step: string;
      reason: string;
      estimated_duration_minutes: number;
    }>;
  }>;

  predictBkt(data: {
    user_id: string;
    skill_id: string;
    feature_vector: number[];
  }): Observable<{
    p_known: number;
    p_next_correct: number;
  }>;

  predictBurnModel(data: { user_id: string; features: number[] }): Observable<{
    retention_score: number;
    model_version: string;
  }>;

  updateQuestionStatistics(data: {
    question_id: string;
    is_correct: boolean;
    response_time_ms: number;
  }): Observable<any>;

  getNextAdaptiveQuestion(data: { user_id: string }): Observable<{
    question_id: string;
    recommended_difficulty: number;
  }>;

  getSpacedRepetitionStats(data: { user_id: string }): Observable<{
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
    user_id: string;
    question: any;
  }): Observable<{
    difficulty_score: number;
    suggestion: string;
  }>;

  getQuizAttemptHistory(data: {
    user_id: string;
    limit?: number;
    offset?: number;
  }): Observable<{
    attempts: any[];
  }>;

  getPathAnalytics(data: { path_id: string }): Observable<any>;

  predictSuccessRate(data: {
    user_id: string;
    features: number[];
  }): Observable<any>;

  extractQuizzes(data: {
    material_id: string;
    file_path: string;
  }): Observable<{
    success: boolean;
    questions_count: number;
    message: string;
  }>;
}
