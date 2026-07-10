// This file serves as the single source of truth for all common interfaces.
// Consolidated in authInterface with backward compatibility via userInterface re-exports.

export * from './adminInterface';

// --- Base & API Responses ---
export type { ApiResponse, PaginatedResponse, PaginatedResult } from './base-responseInterface';

// --- Authentication & Authorization (All consolidated in authInterface) ---
export type {
  StatCardProps,
} from './uiInterface';

export type {
  User,
  UserRole,
  LoginResponse,
  RegisterResponse,
  AuthFormData,
  Permission,
  UserMinimal,
  LoginDTO,
  RegisterDTO,
  // Authentication Responses
  AuthSessionUser,
  AuthResponse,
  // API Response types
  UserResponse,
  UsersListResponse,
  UserSessionData,
  GetSessionsResponse,
} from './authInterface';

// Backward compatibility aliases
// --- User & Profile Types (Consolidated in profileInterface.ts) ---
export type {
  // Profile Statistics & Activity
  UserProfileStats,
  UserActivity,
  // Response Models
  UserProfileResponse,
  UserProfileDisplay,
  // Editing Models
  UserProfileForm,
  LocalUserProfile,
  ProfileUpdateRequest,
  // Validation & State
  ProfileValidationError,
  ProfileValidationState,
  ProfileCompletenessBreakdown,
  ProfileEditState,
  // Education & Professional
  Education,
  Certification,
  SocialLink,
  UserEducationProfile,
  // Context
  IProfileContext,
  // UI
  ProfileTab,
} from './profileInterface';

// --- System-Wide & Core Types ---
export type {
  // Core Entities
  BaseEntity,
  RoleEntity,
  PermissionEntity,
  Session,
  // API & HTTP
  ApiError,
  RequestConfig,
  RequestOptions,
  ApiClient,
  // UI & State
  Settings,
  ThemeMode,
  NavItem,
  // Other system types
  SystemAnalytics,
  SystemOverview,
  AuditLog,
  GetAuditLogsResponse,
} from './systemInterface';

// --- Feature-Specific Interfaces ---
export * from './courseInterface'; // Exports Course, Material, Lesson, etc.
export * from './learningGoalsInterface';
export * from './profileInterface'; // Exports UserProfileResponse, UserProfileForm, LocalUserProfile, etc.
export * from './learningInterface';
export * from './uiInterface';
export * from './CPDInterface';
export * from './analyticsInterface'; // Exports AnalyticsActivity, AggregateUserActivity
export * from './appStateInterface';
export * from './assessmentInterface'; // Exports Assessment-specific types.
export * from './recommendationInterface';
export * from './materialInterface'; // Material types (canonical source)
export * from './chatInterface';
export * from './navigationInterface';
export * from './notificationsInterface'; // Exports Notification
export * from './studyInterface';
export * from './studyGroupInterface';

// progressInterface - explicit exports to avoid naming conflicts
export type {
  CourseProgress,
  UnitProgress,
  TopicProgress,
  DetailedCourseProgress,
  ProgressStats,
  StudyStats,
  UnitProgressData,
  CourseProgressData,
  ProgressActivity,
  // Activity alias is exported from the file, but we use ProgressActivity here
  Achievement,
  CourseDisplayData,
  RecentActivity,
  Badge,
  StudyGroup,
  FlashcardCard,
  FlashcardDeck,
  FlashcardStatistics,
  FlashcardStats,
  DashboardNotification,
  Deadline,
  RecentActivityExtended,
  CourseDisplayDataExtended,
  PerformanceTrend,
  WeeklyProgress,
  RecommendedStudy,
  PeerComparison,
  AIInsight,
  ProgressData,
} from './progressInterface';

// Add aliases for Activity for backward compatibility
export type { ProgressActivity as Activity } from './progressInterface';
