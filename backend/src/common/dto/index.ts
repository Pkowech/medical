// Core DTOs
export { PaginationDto } from './pagination.dto';
export {
  BaseResponseDto,
  BaseUserResponseDto,
  SystemAnalyticsResponseDto,
  PredictionResponseDto,
  RecommendationResponseDto,
  FlashcardStatsResponseDto,
  SpacedRepetitionStatsResponseDto,
  PathAnalyticsResponseDto,
  StudyPatternsResponseDto,
} from './base-response.dto';

// User (consolidated - single source of truth)
export {
  CreateUserDto,
  UpdateUserDto,
  UpdateUserFeaturesDto,
  UserFeaturesResponseDto,
  UserStatsDto,
  UserAnalyticsResponseDto,
  UserActivityDto,
  UserResponseDto,
  UserListResponseDto,
  UserProfileResponseDto,
  AuthenticatedUser,
  AuthenticatedRequest,
  RegisterDto,
  LoginDto,
  AuthUserDto,
  UserRolesDto,
  AuthResponse,
} from './user.dto';
export * from './roles.dto';

// Analytics & AI
export {
  AnalyticsQueryDto,
  PerformanceAnalyticsDto,
  EngagementMetricsDto,
  GetRecommendationsDto,
  UnitProgressDto,
  Performance,
  StudyGroupStats,
  PeerStats,
  StudyActivity,
  GoalAnalytics,
  CourseStats,
  SystemAnalytics,
  UserInsights,
  LearningPathStats,
  QuizScore,
  LearningActivityDetails,
  PerformancePredictionResponseDto,
  LearningAnalyticsDto,
  PerformanceMetricDto,
  PageLoadMetricDto,
  ApiPerformanceMetricDto,
  FlushPerformanceDto,
} from './analytics.dto';

// Learning & Education
export {
  LearningResponseDto,
  LearningModuleStatsDto,
  LearningRecommendation,
  PathStructure,
  Phase,
  Module,
} from './learning.dto';
export * from './course.dto';
export {
  TargetCriteriaDto,
  SmartCriteriaDto,
  MilestoneDto,
  ReminderSettingsDto,
} from './learning-goals.dto';
export * from './learning-paths.dto';
export * from './unit.dto';
export * from './material.dto';
export {
  ProgressUpdateDto,
  ProgressDataDto,
  PhaseProgress,
  UnitProgress,
  CourseProgress,
  UserProgressDetails,
  CourseProgressWithCourse,
  LearningPathProgress,
  ProgressTrend,
  ProgressData,
  ProgressTracking,
  OverallProgress,
  ModuleProgress,
  PeerProgress,
  ExtendedMilestone,
  ModuleProgressUpdate,
  PathProgressWithLearningPath,
  PathProgressWithMilestones,
  PrismaClientLike,
  UserCourseProgress,
  UserLearningPathProgress,
  UserLearningStatus,
  ValidatedCourse,
  ValidatedLearningPath,
  ProgressResponse,
  UserStats,
} from './progress.dto';
export * from './cpd.dto';

// Assessment & Quizzes
export {
  CreateAssessmentDto,
  StartAssessmentDto,
  SubmitAnswerDto,
  AssessmentPredictionDto,
  AssessmentHistoryDto,
  ResourceDto,
  UserPerformanceProfileDto,
  AdaptiveQuizConfig,
  AdaptiveQuizSession,
  DetailedFeedback,
} from './assessment.dto';

export { QuestionOptionDto } from './base';

export * from './question-bank.dto';
export * from './forum.dto';
export * from './weekly-digest.dto';
export * from './assessment-progress.dto';
export {
  CreateFlashcardDto,
  FlashcardItemDto,
  RecordFlashcardResponseDto,
  FlashcardReviewDto,
  FlashcardReviewResponseDto,
  AdaptiveQuizQuestionDto,
} from './flashcard.dto';
export * from './unit-quiz.dto';

// Clinical Cases
export * from './clinical-case.dto';

// Security
export * from './security.dto';
// Admin & System
export * from './admin-dashboard.dto';

// Communication & Engagement
export * from './message.dto';
export * from './notification.dto';
export * from './engagement.dto';

// Security & Audit

// Features & Gamification
export * from './gamification.dto';

export * from './spaced-repetition.dto';

// Student Interactions & Results
export {
  StudentInteractionDto,
  CreateStudentInteractionDto,
  UpdateStudentInteractionDto,
} from './student-interaction.dto';

export {
  FlashcardResultDto,
  CreateFlashcardResultDto,
  UpdateFlashcardResultDto,
} from './flashcard-result.dto';

// File & Media
export * from './file.dto';

// Feedback & Reviews
export * from './feedback.dto';

// Search & Discovery
export * from './search.dto';

// Onboarding
export * from './onboarding.dto';

// System Roles & Permissions
export * from './study-groups.dto';
export * from './discussion.dto';

export * from './study-session.dto';
export * from './recommendation.dto';
export * from './chat.dto';
export * from './learning-history.dto';
