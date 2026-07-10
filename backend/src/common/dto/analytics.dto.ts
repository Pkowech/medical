import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  CategoryBreakdownDto,
  EngagementMetrics,
  PerformanceMetrics,
  ProgressTrend,
} from './base';
import {
  IsOptional,
  IsString,
  IsArray,
  IsObject,
  IsDateString,
  IsNumber,
  Min,
  Max,
  IsEnum,
  IsBoolean,
  IsDate,
  ValidateNested,
} from 'class-validator';
import { TimeRange } from '@prisma/client';

export class UnitProgressDto {
  @ApiProperty()
  @IsString()
  unitId!: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  @Max(100)
  progressPercentage!: number;

  @ApiProperty()
  @IsBoolean()
  isCompleted!: boolean;

  @ApiProperty()
  @IsNumber()
  timeSpent!: number;

  @ApiProperty({ type: Date, nullable: true })
  @IsDate()
  @IsOptional()
  lastAccessedAt?: Date | null;

  @ApiProperty()
  @IsNumber()
  materialsCompleted!: number;

  @ApiProperty()
  @IsNumber()
  totalMaterials!: number;
}

export class EngagementMetricsDto {
  @ApiProperty()
  @IsNumber()
  dailyActiveStreak!: number;

  @ApiProperty()
  @IsNumber()
  weeklyEngagementScore!: number;

  @ApiProperty({ type: [String] })
  @IsArray()
  preferredStudyTimes!: string[];

  @ApiProperty()
  @IsNumber()
  consistencyScore!: number;
}

export class GetRecommendationsDto {
  @IsString()
  userId!: string;

  @IsOptional()
  @IsString()
  context?: 'course' | 'assessment' | 'learningPath';

  @IsOptional()
  @IsNumber()
  limit?: number = 10;
}

export class AnalyticsQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({ enum: TimeRange })
  @IsOptional()
  @IsEnum(TimeRange)
  period?: TimeRange;
}

export class PerformanceAnalyticsDto {
  @ApiProperty()
  @IsString()
  userId!: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  @Max(100)
  overallScore!: number;

  @ApiProperty()
  @IsNumber()
  totalAttempts!: number;

  @ApiProperty()
  @IsNumber()
  correctAnswers!: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  quizId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  averageScore?: number;

  @ApiProperty({ type: [Number], required: false })
  @IsOptional()
  @IsArray()
  recentScores?: number[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  questionsAttempted?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  timeTaken?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  timeSpent?: number;

  @ApiProperty()
  @IsArray()
  @IsString({ each: true })
  weakAreas!: string[];

  @ApiProperty()
  @IsObject()
  progressTrend!: Record<string, number>;

  @ApiProperty()
  @IsNumber()
  averageTimePerQuestion!: number;

  @ApiProperty()
  @IsNumber()
  timePerQuestion!: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsObject()
  topicScores?: Record<string, number>;

  @ApiProperty({ type: Object, required: false })
  @IsOptional()
  @IsObject()
  difficultyBreakdown?: Record<string, number>;

  @ApiProperty({ type: Object, required: false })
  @IsOptional()
  @IsObject()
  categoryBreakdown?: Record<string, CategoryBreakdownDto>;

  @ApiProperty({ type: [Object], required: false })
  @IsOptional()
  @IsArray()
  learningTrends?: { date: string; score: number }[];

  @ApiProperty({ type: [String], required: false })
  @IsOptional()
  @IsArray()
  strengths?: string[];

  @ApiProperty({ type: [String], required: false })
  @IsOptional()
  @IsArray()
  weaknesses?: string[];

  @ApiProperty({ type: [String], required: false })
  @IsOptional()
  @IsArray()
  nextSteps?: string[];

  // Optional recommendations provided by recommendation service
  @ApiProperty({ type: [String], required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  recommendations?: string[];
}

// Interfaces below do not need definite assignment assertions
export interface SystemAnalytics {
  totalUsers?: number;
  totalCourses?: number;
  totalPaths?: number;
  activeLearners?: number;
  averageCompletionRate?: number;
  monthlyActiveUsers?: number;
  dailyActiveUsers?: number;
  weeklyActiveUsers?: number;
  activeUsers?: number;
  averageEngagementScore?: number;
  totalStudyTime?: number;
  topCourses?: any[];
  topLearningPaths?: any[];
}

export interface PathAnalytics {
  pathId: string;
  title: string;
  enrolledUsers: number;
  activeUsers: number;
  averageCompletionTime: number;
  completionRate: number;
  popularPhases: Array<{ phaseId: string; title: string }>;
  commonDropoffPoints: Array<{ phaseId: string; title: string }>;
}

export interface Performance {
  score: number;
  status: string;
  timestamp: Date;
}

export interface StudyGroupStats {
  averageCompletion: number;
  averageStreak: number;
  totalStudyTime: number;
  memberCount: number;
}

export interface UserProgressStats {
  completionPercentage: number;
  timeSpent: number;
  streakDays: number;
}

export interface PeerAverageStats {
  completionPercentage: number;
  timeSpent: number;
  streakDays: number;
}

export interface PeerStats {
  userProgress: UserProgressStats;
  peerAverages: PeerAverageStats;
  percentile: number;
}

export interface StudyEvent {
  userId: string;
  eventType: string;
  courseId?: string;
  pathId?: string;
  metadata: Record<string, any>;
  createdAt: Date;
}

export class StreakDataInfo {
  @ApiProperty()
  currentStreak!: number;
  @ApiProperty()
  longestStreak!: number;
}

export class UpcomingDeadlineInfo {
  @ApiProperty()
  goalId!: string;
  @ApiProperty()
  title!: string;
  @ApiProperty()
  targetDate!: string;
  @ApiProperty()
  daysRemaining!: number;
}

export class GoalAnalytics {
  @ApiProperty()
  userId!: string;
  @ApiProperty()
  totalGoals!: number;
  @ApiProperty()
  activeGoals!: number;
  @ApiProperty()
  completedGoals!: number;
  @ApiProperty()
  overdueGoals!: number;
  @ApiProperty()
  completionRate!: number;
  @ApiProperty()
  averageCompletionTimeDays!: number;
  @ApiPropertyOptional()
  goalsByCategory!: Record<string, number>;
  @ApiPropertyOptional()
  goalsByPriority!: Record<string, number>;
  @ApiProperty({ type: () => StreakDataInfo })
  @Type(() => StreakDataInfo)
  streakData!: StreakDataInfo;
  @ApiProperty({ type: () => String, isArray: true })
  streakGoalIds!: string[];
  @ApiProperty({ type: () => UpcomingDeadlineInfo, isArray: true })
  @Type(() => UpcomingDeadlineInfo)
  upcomingDeadlines!: UpcomingDeadlineInfo[];
}

export class CourseStats {
  @ApiProperty()
  totalCourses!: number;
  @ApiProperty()
  completedCourses!: number;
  @ApiProperty()
  totalStudyTimeMinutes!: number;
  @ApiProperty()
  averageCourseProgress!: number;
}

export class LearningPathStats {
  @ApiProperty()
  totalLearningPaths!: number;
  @ApiProperty()
  completedLearningPaths!: number;
  @ApiProperty()
  totalStudyTimeMinutes!: number;
  @ApiProperty()
  averagePathProgress!: number;
}

export class UserLearningSummaryInfo {
  @ApiProperty()
  totalStudyTime!: number;
  @ApiProperty()
  averageSessionLength!: number;
  @ApiProperty()
  averageScore!: number;
  @ApiProperty()
  currentStreak!: number;
  @ApiProperty()
  longestStreak!: number;
  @ApiProperty({ type: () => String, isArray: true })
  strongestSubjects!: string[];
  @ApiProperty({ type: () => String, isArray: true })
  weakestSubjects!: string[];
  @ApiPropertyOptional()
  lastActivityDate?: string | null;
}

export class LearningAnalyticsDto {
  @ApiProperty()
  @IsString()
  userId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  totalCourses?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  completedCourses?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  totalLearningPaths?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  completedLearningPaths?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  totalStudyTimeMinutes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  averageCourseProgress?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  averagePathProgress?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  totalCoursesEnrolled?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  totalCoursesCompleted?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  totalTimeSpent?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  averageCompletionRate?: number;

  @ApiPropertyOptional({ type: () => String, isArray: true })
  @IsOptional()
  @IsArray()
  strongestSubjects?: string[];

  @ApiPropertyOptional({ type: () => String, isArray: true })
  @IsOptional()
  @IsArray()
  weakestSubjects?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  learningStreak?: number;

  @ApiPropertyOptional()
  @IsOptional()
  lastActivityDate?: string | Date | null;

  @ApiPropertyOptional({ type: () => UserLearningSummaryInfo })
  @IsOptional()
  @Type(() => UserLearningSummaryInfo)
  userLearningSummary?: UserLearningSummaryInfo;

  @ApiProperty({ type: () => GoalAnalytics })
  @Type(() => GoalAnalytics)
  goalAnalytics!: GoalAnalytics;

  @ApiPropertyOptional({ type: () => CourseStats })
  @IsOptional()
  @Type(() => CourseStats)
  courseStats?: CourseStats;

  @ApiPropertyOptional({ type: () => LearningPathStats })
  @IsOptional()
  @Type(() => LearningPathStats)
  pathStats?: LearningPathStats;

  @ApiPropertyOptional({ type: () => EngagementMetrics })
  @IsOptional()
  @Type(() => EngagementMetrics)
  engagementMetrics?: EngagementMetrics;

  @ApiPropertyOptional({ type: () => PerformanceMetrics })
  @IsOptional()
  @Type(() => PerformanceMetrics)
  performanceMetrics?: PerformanceMetrics;

  @ApiProperty({ type: () => ProgressTrend, isArray: true })
  @IsArray()
  @Type(() => ProgressTrend)
  progressTrends!: ProgressTrend[];
}

export class UserInsightsDto {
  @ApiProperty()
  userId!: string;

  @ApiProperty({ type: [String] })
  recommendedNextSteps!: string[];

  @ApiProperty({ type: [String] })
  strengths!: string[];

  @ApiProperty({ type: [String] })
  areasForImprovement!: string[];

  @ApiProperty()
  learningVelocity!: number;

  @ApiProperty()
  estimatedCompletionDate!: string;
}
export type UserInsights = UserInsightsDto;

export class StudyActivityDto {
  @ApiProperty()
  type!: string;

  @ApiProperty()
  duration!: number;

  @ApiPropertyOptional()
  score?: number;

  @ApiPropertyOptional()
  @Type(() => Date)
  timestamp?: Date;

  @ApiPropertyOptional({ type: Object })
  metadata?: any;
}
export type StudyActivity = StudyActivityDto;

/**
 * Common Analytics Entities
 */
export class LearningHistoryItemDto {
  @ApiPropertyOptional()
  score?: number;

  @ApiPropertyOptional()
  duration?: number;

  @ApiProperty()
  category!: string;

  @ApiProperty()
  timestamp!: string | Date;

  @ApiPropertyOptional()
  difficulty?: number;

  @ApiPropertyOptional()
  engagement?: number;

  @ApiPropertyOptional()
  type?: string;

  @ApiPropertyOptional()
  interactionScore?: number;
}
export type LearningHistoryItem = LearningHistoryItemDto;

export class RecommendationItemDto {
  @ApiPropertyOptional()
  materialId?: string;

  @ApiProperty()
  score!: number;

  @ApiPropertyOptional()
  reason?: string;
}

// Cleaned up massive redundancies from interface definitions.
// Using authoritative DTO classes from this file or base-response.dto.ts.

export class PerformancePredictionResponseDto {
  @ApiProperty()
  @IsNumber()
  predictedScore!: number;

  @ApiProperty()
  @IsArray()
  confidenceInterval!: [number, number];

  @ApiPropertyOptional()
  @IsString()
  riskLevel?: string;

  @ApiProperty()
  @IsNumber()
  successProbability!: number;
}

export class QuizScoreDto {
  @ApiProperty()
  @IsString()
  quizId!: string;

  @ApiProperty()
  @IsNumber()
  score!: number;

  @ApiProperty()
  @IsDate()
  date!: Date;
}
export type QuizScore = QuizScoreDto;

export class LearningActivityDetailsDto {
  @ApiProperty()
  @IsString()
  activityId!: string;

  @ApiPropertyOptional()
  @IsString()
  type?: string;

  @ApiProperty()
  @IsNumber()
  duration!: number;

  @ApiPropertyOptional()
  @IsNumber()
  timeSpent?: number;

  @ApiPropertyOptional()
  @IsNumber()
  score?: number;

  @ApiProperty()
  @IsDate()
  timestamp!: Date;

  @ApiPropertyOptional({ type: Object })
  metadata?: any;
}
export type LearningActivityDetails = LearningActivityDetailsDto;


// Cleaned up massive redundancies from interface definitions.
// Using authoritative DTO classes from this file or base-response.dto.ts.

/**
 * DTOs for client-side performance metrics
 */
export class PerformanceMetricDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty()
  @IsNumber()
  value!: number;

  @ApiProperty()
  @IsNumber()
  timestamp!: number;

  @ApiPropertyOptional()
  @IsOptional()
  tags?: Record<string, string>;
}

export class PageLoadMetricDto {
  @ApiProperty()
  @IsString()
  url!: string;

  @ApiProperty()
  @IsNumber()
  loadTime!: number;

  @ApiProperty()
  @IsNumber()
  domContentLoaded!: number;

  @ApiProperty()
  @IsNumber()
  firstContentfulPaint!: number;

  @ApiProperty()
  @IsNumber()
  largestContentfulPaint!: number;

  @ApiProperty()
  @IsNumber()
  timeToInteractive!: number;

  @ApiProperty()
  @IsNumber()
  timestamp!: number;
}

export class ApiPerformanceMetricDto {
  @ApiProperty()
  @IsString()
  endpoint!: string;

  @ApiProperty()
  @IsString()
  method!: string;

  @ApiProperty()
  @IsNumber()
  duration!: number;

  @ApiProperty()
  @IsNumber()
  status!: number;

  @ApiProperty()
  @IsNumber()
  timestamp!: number;
}

export class FlushPerformanceDto {
  @ApiPropertyOptional({ type: [PerformanceMetricDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PerformanceMetricDto)
  metrics?: PerformanceMetricDto[];

  @ApiPropertyOptional({ type: [PageLoadMetricDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PageLoadMetricDto)
  pageLoadMetrics?: PageLoadMetricDto[];

  @ApiPropertyOptional({ type: [ApiPerformanceMetricDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ApiPerformanceMetricDto)
  apiMetrics?: ApiPerformanceMetricDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  resourceMetrics?: any[];
}
