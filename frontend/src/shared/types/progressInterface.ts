/**
 * Progress, Statistics, and Achievement Types
 * Consolidated single source of truth for all progress-related domain models
 * Aligns frontend Progress types with backend Prisma Progress model
 */

/**
 * ProgressStatus enum - matches backend ProgressStatus
 */
export enum ProgressStatus {
  NotStarted = 'notStarted',
  InProgress = 'inProgress',
  Completed = 'completed',
  Paused = 'paused',
  Failed = 'failed',
}

/**
 * Progress Level - discriminator for which entity this progress tracks
 */
export type ProgressLevel = 'COURSE' | 'UNIT' | 'TOPIC' | 'MATERIAL';

/**
 * Unified Backend Progress Model
 * Single source of truth for all progress across course, unit, topic, and material levels
 * Aligned with backend Prisma Progress model with ALL fields
 * Backend discriminates level using which foreign key (courseId, unitId, topicId, materialId) is populated
 */
export interface Progress {
  id: string;
  userId: string;

  // **Foreign Keys - use to discriminate progress level**
  topicId?: string;
  materialId?: string;
  unitId?: string;
  courseId?: string;

  // **Progress Status & Metrics**
  status: ProgressStatus | string;
  progressPercentage: number; // 0-100
  completionPercentage: number; // 0-100 (alternative tracking)
  timeSpent: number; // minutes
  isCompleted: boolean;

  // **Streaks & Engagement**
  streakDays: number;

  // **Learning tracking**
  quizScores?: Record<string, number>;

  // **Dates**
  startedAt?: string; // ISO 8601
  completedAt?: string; // ISO 8601
  lastAccessedAt: string; // ISO 8601
  lastStudiedAt?: string; // ISO 8601
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  lastUpdated?: number; // Milliseconds since epoch for offline conflict resolution

  // **Spaced Repetition Fields (SM-2 algorithm)** - CRITICAL for spaced repetition feature
  easeFactor: number; // Ease factor (2.5 default, 1.3 minimum)
  interval: number; // Days between reviews
  nextReviewDate: string; // ISO 8601 - when item should be reviewed again
  lastReviewedAt?: string; // ISO 8601

  // **Version Management**
  materialVersion?: number;
  isStale?: boolean; // Indicates if material has been updated since last review

  // **Related Data (from JOIN operations)**
  material?: any; // Material details if joined
  topic?: any; // Topic details if joined
  unit?: any; // Unit details if joined
  course?: any; // Course details if joined
  user?: any; // User details if joined
}

/**
 * @deprecated Progress interface replaces CourseProgress
 * Course-level progress - now use Progress with courseId populated
 */
export interface CourseProgress {
  id: string;
  title: string;
  progressPercentage: number;
  completed: boolean;
  lastUpdated?: number;
  lastAccessedAt?: string;
  unitId?: string;
  nextTopicId?: string;
}

/**
 * @deprecated Progress interface replaces UnitProgress
 * Unit/Module-level progress - now use Progress with unitId populated
 */
export interface UnitProgress {
  id: string;
  name: string;
  courseId: string;
  progressPercentage: number;
}

/**
 * @deprecated Progress interface replaces TopicProgress
 * Topic-level progress - now use Progress with topicId populated
 */
export interface TopicProgress {
  topicId: string;
  title?: string;
  isCompleted: boolean;
  masteryUnlocked?: boolean;
  failedAttempts?: number;
  progressPercentage?: number;
}

/**
 * Detailed course progress breakdown
 * Includes per-unit and per-topic progress data
 */
export interface DetailedCourseProgress {
  courseId: string;
  courseName?: string;
  totalProgress: number;
  unitProgress: Array<UnitProgress & { completed?: boolean }>;
  topicProgress: TopicProgress[];
  lastUpdated?: string;
}

/**
 * Progress statistics for a user
 * Aggregated statistics derived from user's learning progress
 */
export interface ProgressStats {
  overallProgress: number;
  coursesCompleted: number;
  totalCourses: number;
  streak: number;
  lastActivity: string | null;
  totalSessions?: number;
  totalTime?: number;
  averageScore?: number;
  progressTrends?: any[];
  performanceMetrics?: any;
  engagementMetrics?: any;
}

/**
 * Study session statistics
 * DEPRECATED: Use ProgressStats instead - both define the same aggregated metrics
 * Kept for backward compatibility only
 */
export interface StudyStats {
  totalSessions: number;
  totalTime: number;
  averageScore: number;
  currentStreak: number;
  topicsStudied: string[];
  courseProgress: CourseProgressData[];
  unitProgress: UnitProgress[];
}

/**
 * Unit progress data for dashboard/display
 */
export type UnitProgressData = UnitProgress;

/**
 * Course progress data for dashboard/display
 */
export interface CourseProgressData {
  id: string;
  name: string;
  progressPercentage: number;
}

/**
 * Individual activity record
 * Represents a specific learning activity (quiz, study session, etc.)
 */
export interface ProgressActivity {
  id: string;
  type: string;
  title: string;
  date: string;
  durationMinutes?: number;
  score?: number;
  lastUpdated?: number; // Timestamp for offline sync ordering
  syncStatus?: 'pending' | 'synced' | 'error';
}

/** @deprecated Use ProgressActivity instead */
export type Activity = ProgressActivity;

/**
 * User achievement/badge
 */
export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  dateEarned: string;
}

/**
 * Course display data with progress information
 */
export interface CourseDisplayData {
  id: string;
  name: string;
  progressPercentage: number;
  color: string;
  lastUpdated?: number;
  lastAccessedAt?: string;
}

/**
 * Recent activity record for display
 */
export interface RecentActivity {
  id: string;
  title: string;
  date: string;
  score?: number;
  type: 'quiz' | 'study' | 'completion' | 'material';
  lastUpdated?: number;
  syncStatus?: 'pending' | 'synced' | 'error';
}

/**
 * Badge/achievement
 */
export interface Badge {
  id: string;
  name: string;
  iconUrl: string;
  earned: boolean;
}

/**
 * Study group information
 */
export interface StudyGroup {
  id: string;
  name: string;
  description?: string;
  members: number;
  membersCount?: number;
  nextSession: string;
  time?: string;
  online?: boolean;
  createdAt?: string;
}

/**
 * Flashcard card with FSRS scheduling
 */
export interface FlashcardCard {
  id: string;
  front: string;
  back: string;
  stability: number;
  difficulty: number;
  retrievability?: number;
  elapsedDays: number;
  scheduledDays: number;
  reps: number;
  lapses: number;
  state: 'new' | 'learning' | 'review' | 'relearning';
  due: Date;
  isDue: boolean;
  isNew: boolean;
  isLearning: boolean;
  isReview: boolean;
  isRelearning: boolean;
}

/**
 * Flashcard deck information with progress tracking
 */
export interface FlashcardDeck {
  id: string;
  name: string;
  due: number;
  total: number;
  progressPercentage: number;
  color: string;
}

/**
 * Flashcard study statistics
 */
export interface FlashcardStatistics {
  accuracy: number;
  sessions: number;
  avgTimePerCard: string;
}

/**
 * Flashcard overall statistics
 */
export interface FlashcardStats {
  due: number;
  mastered: number;
  learning: number;
  decks?: FlashcardDeck[];
  cards?: FlashcardCard[];
  stats?: FlashcardStatistics;
}

/**
 * Dashboard notification
 */
export interface DashboardNotification {
  id: string;
  message: string;
  type: 'info' | 'reminder';
  read: boolean;
}

/**
 * Upcoming deadline
 */
export interface Deadline {
  id: string;
  title: string;
  date: string;
  type: 'exam' | 'assignment' | 'quiz' | 'goal' | 'schedule';
  priority: 'high' | 'medium' | 'low';
  course: string;
  courseId?: string;
  daysLeft: number;
}

/**
 * Extended recent activity
 */
export interface RecentActivityExtended extends RecentActivity {
  improvement?: string;
  duration?: string;
  description?: string;
}

/**
 * Extended course display data
 */
export interface CourseDisplayDataExtended extends CourseDisplayData {
  dueDate?: string;
  nextTopic?: string;
  timeLeft?: string;
}

/**
 * Performance trend over time
 */
export interface PerformanceTrend {
  month: string;
  score: number;
  hours: number;
}

/**
 * Weekly study progress
 */
export interface WeeklyProgress {
  day: string;
  hours: number;
  target: number;
}

/**
 * Recommended study material
 */
export interface RecommendedStudy {
  id: string;
  title: string;
  reason: string;
  priority: 'high' | 'medium' | 'low';
  estimatedTime: string;
}

/**
 * Peer comparison statistics
 */
export interface PeerComparison {
  yourAverage: number;
  cohortAverage: number;
  topPerformer: number;
  rank: number;
  totalStudents: number;
}

/**
 * AI-generated insight
 */
export interface AIInsight {
  text: string;
  icon: unknown;
}

export interface Specialization {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  courseCount: number;
}

/**
 * Comprehensive progress data
 * Master interface combining all progress-related information
 */
export interface ProgressData {
  overallProgress: number;
  coursesCompleted?: number;
  totalCourses?: number;
  streak?: number;
  lastActivity?: string | null;
  courseProgress?: CourseProgress[];
  recentActivities?: ProgressActivity[];
  stats?: ProgressStats;
  lessonKey?: string;
  completed?: boolean;
  achievements?: Achievement[];
  courseData?: CourseDisplayDataExtended[];
  recentActivity?: RecentActivityExtended[];
  badges?: Badge[];
  studyGroups?: StudyGroup[];
  flashcards?: FlashcardStats;
  notifications?: DashboardNotification[];
  upcomingDeadlines?: Deadline[];
  recommendedStudy?: RecommendedStudy[];
  performanceTrends?: PerformanceTrend[];
  weeklyProgress?: WeeklyProgress[];
  peerComparison?: PeerComparison;
  aiInsights?: AIInsight[];
  studySessions?: any[];
  pathProgress?: any[];
  unitProgress?: any[];
  featuredSpecializations?: Specialization[];
}

/**
 * --- Internal/Backend Response Types for Mapping ---
 * Help with normalizing various backend response formats
 */

export type UnknownRecord = Record<string, unknown>;

export interface RawActivity extends UnknownRecord {
  date?: string;
  createdAt?: string;
  timestamp?: string;
  title?: string;
  name?: string;
  description?: string;
  type?: string;
  kind?: string;
  durationMinutes?: number;
  duration?: number;
  metadata?: UnknownRecord;
  session?: UnknownRecord;
  score?: number;
  id?: string;
  _id?: string;
}

export interface RawCourseProgress extends UnknownRecord {
  id?: string;
  courseId?: string;
  title?: string;
  courseName?: string;
  progress?: number;
  progressPercentage?: number;
  completed?: boolean;
  status?: string;
}

export type QuizScores = Record<string, number>;

export interface StudySessionSummary {
  id?: string;
  courseId?: string;
  durationMinutes?: number;
  startTime?: string;
  endTime?: string;
  [key: string]: unknown;
}

export interface StudyStatistics {
  totalSessions?: number;
  totalDurationMinutes?: number;
  averageScore?: number;
  [key: string]: unknown;
}

export type LearningPathProgressSummary = UnknownRecord;
export type UnitProgressSummary = UnknownRecord;

export type RecommendedPathSummary = RecommendedStudy | (UnknownRecord & { id?: string });

export interface ExtendedProgressStats extends ProgressStats {
  averageScore?: number;
}


/**
 * Flashcard card with FSRS scheduling
 * Free Spaced Repetition Scheduler algorithm
 */
export interface FlashcardCard {
  id: string;
  front: string;
  back: string;
  stability: number;
  difficulty: number;
  retrievability?: number;
  elapsedDays: number;
  scheduledDays: number;
  reps: number;
  lapses: number;
  state: 'new' | 'learning' | 'review' | 'relearning';
  due: Date;
  isDue: boolean;
  isNew: boolean;
  isLearning: boolean;
  isReview: boolean;
  isRelearning: boolean;
}

/**
 * Flashcard deck information with progress tracking
 */
export interface FlashcardDeck {
  id: string;
  name: string;
  due: number;
  total: number;
  progressPercentage: number;
  color: string;
}

/**
 * Flashcard study statistics
 */
export interface FlashcardStatistics {
  accuracy: number;
  sessions: number;
  avgTimePerCard: string;
}




