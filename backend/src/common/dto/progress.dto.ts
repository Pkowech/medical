import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsIn,
  Min,
  Max,
  IsBoolean,
  IsDate,
  IsObject,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  Course,
  LearningPath,
  ProgressStatus,
  CourseDifficulty,
  Progress,
  Prisma,
  LearningPathMilestone,
  Quiz,
} from '@prisma/client';
import { PathStructureDto } from '../dto/learning-paths.dto';
import { EngagementMetrics, PerformanceMetrics, ProgressTrend } from './base';

// ================================
// CREATE & UPDATE DTOs
// ================================

export class CreateProgressDto {
  @ApiProperty({ description: 'User ID' })
  @IsString()
  @IsNotEmpty()
  userId!: string;

  @ApiProperty({ description: 'Course ID' })
  @IsString()
  courseId!: string;

  @ApiPropertyOptional({ description: 'Unit ID' })
  @IsOptional()
  @IsString()
  unitId?: string;

  @ApiPropertyOptional({ description: 'Material ID' })
  @IsOptional()
  @IsString()
  materialId?: string;

  @ApiPropertyOptional({
    enum: Object.values(ProgressStatus),
    description: 'Progress status',
  })
  @IsOptional()
  @IsIn(Object.values(ProgressStatus))
  status?: ProgressStatus;

  @ApiPropertyOptional({ description: 'Progress percentage (0-100)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  progressPercentage?: number;

  @ApiPropertyOptional({ description: 'Time spent in minutes' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  timeSpent?: number;
}

export class UpdateProgressDto {
  @ApiProperty({ description: 'Course ID' })
  @IsString()
  courseId!: string;

  @ApiPropertyOptional({ description: 'Unit ID' })
  @IsOptional()
  @IsString()
  unitId?: string;

  @ApiPropertyOptional({ description: 'Material ID' })
  @IsOptional()
  @IsString()
  materialId?: string;

  @ApiPropertyOptional({
    enum: Object.values(ProgressStatus),
    description: 'Progress status',
  })
  @IsOptional()
  @IsIn(Object.values(ProgressStatus))
  status?: ProgressStatus;

  @ApiPropertyOptional({ description: 'Progress percentage (0-100)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  progressPercentage?: number;

  @ApiPropertyOptional({ description: 'Time spent in minutes' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  timeSpent?: number;

  @ApiPropertyOptional({
    type: 'number',
    description:
      'Client-side timestamp in milliseconds (for conflict resolution)',
  })
  @IsOptional()
  @IsNumber()
  clientTimestamp?: number;
}

export class ProgressUpdateDto extends UpdateProgressDto {
  @ApiPropertyOptional({ description: 'Topic ID' })
  @IsOptional()
  @IsString()
  topicId?: string;
}

// ================================
// RESPONSE DTOs
// ================================

export class LearningProgressDto {
  @ApiProperty({ description: 'Course ID' })
  @IsString()
  courseId!: string;

  @ApiProperty({ description: 'Course title' })
  @IsString()
  courseTitle!: string;

  @ApiProperty({ description: 'Progress percentage (0-100)' })
  @IsNumber()
  @Min(0)
  @Max(100)
  progressPercentage!: number;

  @ApiProperty({ description: 'Units completed' })
  @IsNumber()
  @Min(0)
  unitsCompleted!: number;

  @ApiProperty({ description: 'Total units' })
  @IsNumber()
  @Min(1)
  totalUnits!: number;

  @ApiProperty({ description: 'Last activity date' })
  @IsDate()
  @Type(() => Date)
  lastActivity!: Date;

  @ApiPropertyOptional({ description: 'Estimated time to completion in hours' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  estimatedTimeToCompletion?: number;
}

export class ProgressLearningStatsDto {
  @ApiProperty({ description: 'Total study time in minutes' })
  @IsNumber()
  @Min(0)
  totalStudyTime!: number;

  @ApiProperty({ description: 'Average session duration in minutes' })
  @IsNumber()
  @Min(0)
  averageSessionDuration!: number;

  @ApiProperty({ description: 'Sessions this week' })
  @IsNumber()
  @Min(0)
  sessionsThisWeek!: number;

  @ApiProperty({ description: 'Current learning streak in days' })
  @IsNumber()
  @Min(0)
  streakDays!: number;

  @ApiProperty({ description: 'Courses in progress' })
  @IsNumber()
  @Min(0)
  coursesInProgress!: number;

  @ApiProperty({ description: 'Courses completed' })
  @IsNumber()
  @Min(0)
  coursesCompleted!: number;

  @ApiProperty({ description: 'Average quiz score' })
  @IsNumber()
  @Min(0)
  @Max(100)
  averageQuizScore!: number;

  @ApiProperty({ description: 'Achievements earned count' })
  @IsNumber()
  @Min(0)
  achievementsCount!: number;
}

export class ProgressDataDto implements ProgressData {
  @ApiPropertyOptional({ description: 'Progress percentage (0-100)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  progressPercentage?: number;

  @ApiPropertyOptional({ description: 'Time spent in minutes' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  timeSpentMinutes?: number;

  @ApiPropertyOptional({ description: 'Current status' })
  @IsOptional()
  @IsIn(['notStarted', 'inProgress', 'completed', 'failed'])
  status?: ProgressData['status'];

  @ApiProperty({ description: 'Whether completed' })
  @IsBoolean()
  completed!: boolean;

  @ApiPropertyOptional({ description: 'Score achieved' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  score?: number;

  @ApiPropertyOptional({ description: 'Whether passed' })
  @IsOptional()
  @IsBoolean()
  passed?: boolean;

  @ApiPropertyOptional({ description: 'Additional metadata' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Session ID' })
  @IsOptional()
  @IsString()
  sessionId?: string;

  @ApiPropertyOptional({ description: 'Timestamp' })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  timestamp?: Date;
}

export class ProgressUpdateDataDto {
  @ApiProperty({ description: 'Course ID' })
  @IsString()
  courseId!: string;

  @ApiPropertyOptional({ description: 'Learning path ID' })
  @IsOptional()
  @IsString()
  learningPathId?: string;

  @ApiProperty({ description: 'Progress value (0-100)' })
  @IsNumber()
  @Min(0)
  @Max(100)
  progress!: number;

  @ApiPropertyOptional({ description: 'Time spent in minutes' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  timeSpent?: number;

  @ApiProperty({ description: 'Current status' })
  @IsIn(Object.values(ProgressStatus))
  status!: ProgressStatus;

  @ApiProperty({ description: 'Whether completed' })
  @IsBoolean()
  completed!: boolean;

  @ApiPropertyOptional({ description: 'Completion date' })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  completedAt?: Date;

  @ApiPropertyOptional({ description: 'Additional metadata' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  userId!: string;
  progressData!: ProgressData;
}

export class TimeDistributionDto {
  @ApiProperty({ description: 'Module ID' })
  @IsString()
  moduleId!: string;

  @ApiProperty({ description: 'Time spent in minutes' })
  @IsNumber()
  @Min(0)
  timeSpentMinutes!: number;
}

export class ProgressAnalyticsDto {
  @ApiProperty({ description: 'Total paths started' })
  @IsNumber()
  @Min(0)
  totalPathsStarted!: number;

  @ApiProperty({ description: 'Paths completed' })
  @IsNumber()
  @Min(0)
  pathsCompleted!: number;

  @ApiProperty({ description: 'Average completion time in days' })
  @IsNumber()
  @Min(0)
  averageCompletionTime!: number;

  @ApiProperty({ description: 'Current streak in days' })
  @IsNumber()
  @Min(0)
  currentStreakDays!: number;

  @ApiProperty({ description: 'Completion rate percentage' })
  @IsNumber()
  @Min(0)
  @Max(100)
  completionRate!: number;

  @ApiProperty({ description: 'Time distribution across modules' })
  @IsArray()
  timeDistribution!: TimeDistributionDto[];
}

// ================================
// PROGRESS INTERFACES (Aligned with Schema)
// ================================

export type ProgressType = 'course' | 'learningPath' | 'module' | 'assessment';

export class UnitProgressDto {
  @ApiProperty()
  @IsString()
  id!: string;

  @ApiProperty()
  @IsString()
  userId!: string;

  @ApiProperty()
  @IsString()
  unitId!: string;

  @ApiProperty({ enum: ProgressStatus })
  status!: ProgressStatus;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  @Max(100)
  progressPercentage!: number;

  @ApiProperty()
  @IsNumber()
  timeSpent!: number;

  @ApiPropertyOptional()
  startedAt?: Date;

  @ApiPropertyOptional()
  completedAt?: Date;

  @ApiProperty()
  lastAccessedAt!: Date;
}
export type UnitProgress = UnitProgressDto;

export class CourseProgressDto {
  @ApiProperty()
  @IsString()
  id!: string;

  @ApiProperty()
  @IsString()
  userId!: string;

  @ApiProperty()
  @IsString()
  courseId!: string;

  @ApiProperty({ enum: ProgressStatus })
  status!: ProgressStatus;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  @Max(100)
  progressPercentage!: number;

  @ApiProperty()
  @IsNumber()
  completedUnits!: number;

  @ApiProperty()
  @IsNumber()
  timeSpent!: number;

  @ApiPropertyOptional()
  startedAt?: Date;

  @ApiPropertyOptional()
  completedAt?: Date;

  @ApiProperty()
  lastAccessedAt!: Date;

  @ApiPropertyOptional()
  title?: string;

  @ApiPropertyOptional()
  courseName?: string;
}
export type CourseProgress = CourseProgressDto;

export interface UserProgressDetails extends CourseProgress {
  unitProgress: (UnitProgress & {
    unit: { id: string; title: string; order: number };
  })[];
  topicProgress: Progress[]; // From Prisma
}

export interface CourseProgressWithCourse extends CourseProgress {
  course: Course;
}

export class LearningPathProgressDto {
  @ApiProperty()
  @IsString()
  id!: string;

  @ApiProperty()
  @IsString()
  userId!: string;

  @ApiProperty()
  @IsString()
  learningPathId!: string;

  @ApiProperty({ enum: ProgressStatus })
  status!: ProgressStatus;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  @Max(100)
  overallProgressPercentage!: number;

  @ApiProperty()
  @IsNumber()
  completedCourses!: number;

  @ApiProperty()
  @IsNumber()
  totalCourses!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  currentCourseId?: string;

  @ApiPropertyOptional()
  startedAt?: Date;

  @ApiPropertyOptional()
  completedAt?: Date;

  @ApiProperty()
  lastAccessedAt!: Date;

  @ApiPropertyOptional({ type: Object })
  milestonesAchieved?: any;
}
export type LearningPathProgress = LearningPathProgressDto;

export class TopicProgressDto {
  @ApiProperty()
  @IsString()
  topicId!: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  @Max(100)
  progressPercentage!: number;

  @ApiProperty({ enum: ProgressStatus })
  status!: ProgressStatus;

  @ApiPropertyOptional()
  completedAt?: Date;

  @ApiPropertyOptional({
    description: 'Whether the material has been updated since last viewed',
  })
  @IsOptional()
  @IsBoolean()
  isStale?: boolean;

  @ApiPropertyOptional({
    description: 'The version of the material this progress was recorded on',
  })
  @IsOptional()
  @IsNumber()
  materialVersion?: number;
}
export type TopicProgress = TopicProgressDto;

export class AssessmentProgressDto {
  @ApiProperty()
  @IsString()
  id!: string;

  @ApiProperty()
  @IsString()
  userId!: string;

  @ApiProperty()
  @IsString()
  assessmentId!: string;

  @ApiProperty({ enum: ProgressStatus })
  status!: ProgressStatus;

  @ApiPropertyOptional()
  @IsNumber()
  score?: number;

  @ApiPropertyOptional()
  @IsNumber()
  timeTaken?: number;

  @ApiPropertyOptional()
  completedAt?: Date;
}
export type AssessmentProgress = AssessmentProgressDto;

// ProgressTrend is now imported from './base' to avoid duplication
// Re-export for backward compatibility
export { ProgressTrend };

/**
 * Generic progress data interface
 */
export interface ProgressData {
  completedItems?: number;
  totalItems?: number;
  percentage?: number;
  score?: number;
  timeSpent?: number;
  progressPercentage?: number;
  timeSpentMinutes?: number;
  completed?: boolean;
  passed?: boolean;
  status?: 'notStarted' | 'inProgress' | 'completed' | 'failed';
  timestamp?: Date;
  metadata?: Record<string, any>;
}

/**
 * Interface for phase progress (learning paths)
 */
export interface PhaseProgress {
  phaseId: string;
  title: string;
  status: 'notStarted' | 'inProgress' | 'completed';
  progressPercentage: number;
  modulesCompleted: string[];
  modules: { id: string; status: string }[];
  completed: boolean;
  completedAt?: Date;
  startedAt?: Date;
}

/**
 * Interface for module progress updates
 */
export interface ModuleProgressUpdate extends ProgressData {
  moduleId: string;
  phaseId: string;
}

/**
 * Interface for module progress tracking
 */
export interface ModuleProgress {
  moduleId: string;
  phaseId: string;
  status: 'notStarted' | 'inProgress' | 'completed' | 'failed' | 'skipped';
  progressPercentage?: number;
  timeSpentMinutes?: number;
  score?: number;
  best_score?: number;
  notes?: string;
  attempts?: number;
  lastAttemptAt?: string;
  completedItems?: number;
  totalItems?: number;
  percentage?: number;
}

/**
 * Interface for progress update data
 */
export interface ProgressUpdateData {
  userId: string;
  courseId?: string;
  unitId?: string;
  materialId?: string;
  topicId?: string;
  learningPathId?: string;
  progressData: ProgressData;
  completed: boolean;
  completedAt?: Date;
  status: ProgressStatus;
  metadata?: Record<string, any>;
  progress: number;
  timeSpent: number;
  isStale?: boolean;
  materialVersion?: number;
}

export interface ProgressTracking {
  autoTracking: boolean;
  manualUpdates: boolean;
  dataSources: string[];
  updateFrequency: 'real_time' | 'daily' | 'weekly';
}

/**
 * Interface for user course progress summary
 */
export interface UserCourseProgress {
  courseId: string;
  title: string | undefined;
  description: string | null | undefined;
  difficulty: CourseDifficulty | undefined;
  progress: number;
  status: ProgressStatus;
  timeSpent: number;
  completedAt: Date | null;
  lastAccessedAt: Date;
}

/**
 * Interface for user learning path progress summary
 */
export interface UserLearningPathProgress {
  pathId: string;
  title: string | undefined;
  description: string | null | undefined;
  difficulty: CourseDifficulty | undefined;
  progress: number;
  status: ProgressStatus;
  timeSpent: number;
  completedAt: Date | null;
  lastAccessedAt: Date | null;
  estimatedDuration: number | null | undefined;
  streakDays: number;
  milestonesAchieved: any;
}

export interface UserLearningStatus {
  userId: string;
  courses: UserCourseProgress[];
  learningPaths: UserLearningPathProgress[];
  lastUpdated: string | bigint;
}

export type ValidatedCourse = Pick<
  Course,
  'id' | 'name' | 'status' | 'createdAt' | 'updatedAt'
>;

export type ValidatedLearningPath = Pick<
  LearningPath,
  'id' | 'title' | 'difficulty' | 'estimatedHours' | 'estimatedDurationWeeks'
>;

export interface PeerProgress {
  userId: string;
  courseId?: string;
  name?: string;
  avatar?: string | null;
  progress: number | { percent: number; lastActive: Date | null | any };
  lastUpdated?: Date | bigint;
  metadata?: Record<string, any>;
}

/**
 * Minimal Prisma client interface for type safety
 */
export interface PrismaClientLike {
  unit: Prisma.UnitDelegate<any>;
  progress: Prisma.ProgressDelegate<any>;
  material: Prisma.MaterialDelegate<any>;
  courseEnrollment: Prisma.CourseEnrollmentDelegate<any>;
  userActivity: Prisma.UserActivityDelegate<any>;
}

export class UserEnrollmentDto {
  @ApiProperty()
  @IsString()
  courseId!: string;

  @ApiPropertyOptional()
  @IsString()
  courseTitle?: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  @Max(100)
  progressPercentage!: number;

  @ApiProperty()
  @IsDate()
  @Type(() => Date)
  lastAccessedAt!: Date;

  @ApiProperty()
  @IsBoolean()
  isCompleted!: boolean;
}
export type UserEnrollment = UserEnrollmentDto;

export class UserStatsDto {
  @ApiProperty()
  @IsString()
  userId!: string;

  @ApiProperty()
  @IsNumber()
  totalCourses!: number;

  @ApiProperty()
  @IsNumber()
  completedCourses!: number;

  @ApiProperty()
  @IsNumber()
  inProgressCourses!: number;

  @ApiProperty()
  @IsNumber()
  totalLearningPaths!: number;

  @ApiProperty()
  @IsNumber()
  completedLearningPaths!: number;

  @ApiProperty()
  @IsNumber()
  totalStudyTime!: number;

  @ApiProperty()
  @IsNumber()
  averageCourseProgress!: number;

  @ApiProperty()
  @IsNumber()
  averagePathProgress!: number;

  @ApiProperty()
  @IsNumber()
  sessionsThisWeek!: number;

  @ApiProperty()
  @IsNumber()
  averageSessionDuration!: number;

  @ApiProperty({ description: 'Current learning streak in days' })
  @IsNumber()
  streakDays!: number;

  @ApiPropertyOptional({
    description: 'Backward compatibility: current streak in days',
  })
  @IsOptional()
  @IsNumber()
  streak?: number;

  @ApiProperty()
  @ValidateNested()
  @Type(() => EngagementMetrics)
  engagementMetrics!: EngagementMetrics;

  @ApiProperty()
  @ValidateNested()
  @Type(() => PerformanceMetrics)
  performanceMetrics!: PerformanceMetrics;

  @ApiProperty({ type: [ProgressTrend] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProgressTrend)
  progressTrends!: ProgressTrend[];
}
export type UserStats = UserStatsDto;

export class OverallProgressDto {
  @ApiProperty({ type: [UserEnrollmentDto] })
  @IsArray()
  enrollments!: UserEnrollmentDto[];

  @ApiPropertyOptional({ type: () => UserStatsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => UserStatsDto)
  stats?: UserStatsDto;
}
export type OverallProgress = OverallProgressDto;

export interface LearningPathSummaryDto {
  id: string;
  title: string;
  pathStructure: PathStructureDto;
}

export type PathProgressWithLearningPath = LearningPathProgress & {
  learningPath: LearningPathSummaryDto;
  progressPercentage: number;
  completedCourses: number;
  totalCourses: number;
  moduleProgress?: Record<string, ModuleProgress>;
  phaseProgress?: Record<string, PhaseProgress>;
};

export type PathProgressWithMilestones = LearningPathProgress & {
  learningPath: LearningPath & {
    milestones: LearningPathMilestone[];
  };
  progressPercentage: number;
  completedCourses: number;
  totalCourses: number;
  moduleProgress?: Record<string, ModuleProgress>;
  phaseProgress?: Record<string, PhaseProgress>;
};

export interface UserPreferences {
  maxAutoEnrollments: number;
  autoEnrollmentEnabled: boolean;
  learningPreferences: Prisma.JsonValue;
}

export interface ExtendedMilestone extends LearningPathMilestone {
  requiredPercentage?: number;
}

export interface MilestoneAchieved {
  milestone_id: string;
  achieved_at: Date;
  notes?: string;
}

export interface LearningVelocityDto {
  modules_per_week: number;
  hours_per_week: number;
  consistency_score: number;
}

export interface LearningPathAnalytics {
  study_sessions: any[];
  performance_trends: any[];
  preferences: any;
  learning_velocity: LearningVelocityDto;
}

/**
 * Generic progress response interface used across the application
 * for tracking progress in courses, learning paths, modules, and assessments
 */
export interface ProgressResponse {
  currentValue: number;
  targetValue: number;
  percentageComplete: number;
  type: ProgressType;
  data?: Record<string, unknown>;
}

// LearningActivityDetails is defined in analytics.dto.ts - removed duplicate
