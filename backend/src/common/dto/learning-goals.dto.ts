import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsEnum,
  IsObject,
  IsArray,
  IsDate,
  IsNumber,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  GoalType,
  GoalCategory,
  GoalPriority,
  GoalStatus,
  LearningGoal,
  ExamType,
} from '@prisma/client';

export class TargetCriteriaDto {
  @ApiProperty({
    enum: ['numeric', 'percentage', 'boolean', 'completion', 'score'],
    description: 'Type of target criteria',
  })
  @IsString()
  type!: 'numeric' | 'percentage' | 'boolean' | 'completion' | 'score';

  @ApiProperty({ description: 'Target value to achieve' })
  targetValue!: number | boolean | string;

  @ApiPropertyOptional({ description: 'Unit of measurement' })
  @IsOptional()
  @IsString()
  unit?: string;

  @ApiPropertyOptional({ description: 'Current value towards the target' })
  @IsOptional()
  @IsNumber()
  currentValue?: number;

  @ApiPropertyOptional({ description: 'Method of measurement' })
  @IsOptional()
  @IsString()
  measurementMethod?: string;
}

export class SmartCriteriaDto {
  @ApiProperty({ description: 'Specific goal description' })
  @IsString()
  specific!: string;

  @ApiProperty({ description: 'Measurable criteria' })
  @IsString()
  measurable!: string;

  @ApiProperty({ description: 'Achievable description' })
  @IsString()
  achievable!: string;

  @ApiProperty({ description: 'Relevant criteria' })
  @IsString()
  relevant!: string;

  @ApiProperty({ description: 'Time-bound criteria' })
  @IsString()
  timeBound!: string;
}

export class BaseGoalDto {
  @ApiProperty({ description: 'Goal title' })
  @IsString()
  title!: string;

  @ApiPropertyOptional({ description: 'Goal description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: GoalType })
  @IsEnum(GoalType)
  type!: GoalType;

  @ApiProperty({ enum: GoalCategory })
  @IsEnum(GoalCategory)
  category!: GoalCategory;

  @ApiProperty({ enum: GoalPriority })
  @IsEnum(GoalPriority)
  priority!: GoalPriority;

  @ApiProperty({ description: 'Target completion date' })
  @IsDate()
  @Type(() => Date)
  targetDate!: Date;
}

export class MilestoneDto {
  @ApiPropertyOptional({ description: 'Milestone ID' })
  @IsOptional()
  @IsString()
  id?: string;

  @ApiProperty({ description: 'Milestone title' })
  @IsString()
  title!: string;

  @ApiPropertyOptional({ description: 'Milestone description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Target date for milestone' })
  @IsDate()
  @Type(() => Date)
  targetDate!: Date;

  @ApiProperty({ description: 'Target value for milestone' })
  @IsNumber()
  targetValue!: number;

  @ApiPropertyOptional({ description: 'Whether milestone is completed' })
  @IsOptional()
  @IsBoolean()
  completed?: boolean;

  @ApiPropertyOptional({ description: 'Completion date' })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  completedAt?: Date;

  @ApiProperty({ description: 'Milestone order' })
  @IsNumber()
  order!: number;
}

export interface Milestone extends MilestoneDto {
  id: string;
  completed: boolean;
}

export interface LearningGoalWithMilestones extends LearningGoal {
  milestones: Milestone[];
}

export class ReminderSettingsDto {
  @ApiProperty({ description: 'Whether reminders are enabled' })
  @IsBoolean()
  enabled!: boolean;

  @ApiProperty({
    enum: ['daily', 'weekly', 'custom'],
    description: 'Reminder frequency',
  })
  @IsEnum(['daily', 'weekly', 'custom'])
  frequency!: 'daily' | 'weekly' | 'custom';

  @ApiPropertyOptional({ description: 'Days of week for reminders' })
  @IsOptional()
  @IsArray()
  daysOfWeek?: number[];

  @ApiPropertyOptional({
    description: 'Custom reminder schedule',
    type: 'array',
  })
  @IsOptional()
  @IsArray()
  customSchedule?: Array<{ date: Date; time: string }>;
}

export class ProgressTrackingDto {
  @ApiProperty({ description: 'Enable automatic tracking' })
  @IsBoolean()
  autoTracking!: boolean;

  @ApiProperty({ description: 'Allow manual updates' })
  @IsBoolean()
  manualUpdates!: boolean;

  @ApiProperty({ description: 'Data sources for tracking' })
  @IsArray()
  @IsString({ each: true })
  dataSources!: string[];

  @ApiProperty({
    enum: ['real_time', 'daily', 'weekly', 'manual'],
    description: 'Update frequency',
  })
  @IsEnum(['real_time', 'daily', 'weekly', 'manual'])
  updateFrequency!: 'real_time' | 'daily' | 'weekly' | 'manual';
}

export class CreateLearningGoalDto extends BaseGoalDto {
  @ApiPropertyOptional({
    description: 'Additional metadata',
    type: 'object',
    additionalProperties: true,
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  @ApiProperty({ enum: GoalStatus, description: 'Goal status' })
  @IsEnum(GoalStatus)
  status!: GoalStatus;

  @ApiProperty({ description: 'Target criteria for goal' })
  @IsObject()
  targetCriteria!: TargetCriteriaDto;

  @ApiProperty({ description: 'Goal start date' })
  @IsDate()
  @Type(() => Date)
  startDate!: Date;

  @ApiPropertyOptional({ description: 'Completion date' })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  completedAt?: Date;

  @ApiPropertyOptional({ description: 'Associated learning path ID' })
  @IsOptional()
  @IsString()
  learningPathId?: string;

  @ApiPropertyOptional({ description: 'Associated course ID' })
  @IsOptional()
  @IsString()
  courseId?: string;

  @ApiPropertyOptional({ description: 'Associated topic ID' })
  @IsOptional()
  @IsString()
  topicId?: string;

  @ApiPropertyOptional({ description: 'Associated material ID' })
  @IsOptional()
  @IsString()
  materialId?: string;

  @ApiPropertyOptional({ description: 'Related resource IDs' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  relatedResources?: string[];

  @ApiPropertyOptional({ description: 'SMART criteria breakdown' })
  @IsOptional()
  @IsObject()
  smartCriteria?: SmartCriteriaDto;

  @ApiPropertyOptional({ description: 'Goal milestones' })
  @IsOptional()
  @IsArray()
  milestones?: MilestoneDto[];

  @ApiPropertyOptional({ description: 'Reminder settings' })
  @IsOptional()
  @IsObject()
  reminderSettings?: ReminderSettingsDto;

  @ApiPropertyOptional({ description: 'Progress tracking settings' })
  @IsOptional()
  @IsObject()
  progressTracking?: ProgressTrackingDto;

  @ApiPropertyOptional({
    description: 'Initial or override progress percentage for the goal',
  })
  @IsOptional()
  @IsNumber()
  progressPercentage?: number;

  @ApiPropertyOptional({ description: 'ID of goal this goal depends on' })
  @IsOptional()
  @IsString()
  dependsOnGoalId?: string | null;

  @ApiPropertyOptional({ description: 'Reason for blocking this goal' })
  @IsOptional()
  @IsString()
  blockedReason?: string | null;
}

export class UpdateLearningGoalDto extends PartialType(CreateLearningGoalDto) {}

export class GoalFiltersDto {
  @ApiPropertyOptional({ enum: GoalStatus, description: 'Filter by status' })
  @IsOptional()
  @IsEnum(GoalStatus)
  status?: GoalStatus;

  @ApiPropertyOptional({
    enum: GoalCategory,
    description: 'Filter by category',
  })
  @IsOptional()
  @IsEnum(GoalCategory)
  category?: GoalCategory;

  @ApiPropertyOptional({ enum: GoalType, description: 'Filter by type' })
  @IsOptional()
  @IsEnum(GoalType)
  type?: GoalType;

  @ApiPropertyOptional({
    enum: GoalPriority,
    description: 'Filter by priority',
  })
  @IsOptional()
  @IsEnum(GoalPriority)
  priority?: GoalPriority;

  @ApiPropertyOptional({ description: 'Filter goals due soon' })
  @IsOptional()
  @IsBoolean()
  dueSoon?: boolean;

  @ApiPropertyOptional({
    description: 'Filter upcoming goals (targets in the future)',
  })
  @IsOptional()
  @IsBoolean()
  upcoming?: boolean;

  @ApiPropertyOptional({ description: 'Filter overdue goals' })
  @IsOptional()
  @IsBoolean()
  overdue?: boolean;

  @ApiPropertyOptional({ description: 'Search query' })
  @IsOptional()
  @IsString()
  search?: string;
}

export class ProgressUpdateDataDto {
  @ApiProperty({ description: 'Goal ID' })
  @IsString()
  goalId!: string;

  @ApiProperty({ description: 'Progress value' })
  @IsNumber()
  progressValue!: number;

  @ApiPropertyOptional({ description: 'Update notes' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'Evidence files or URLs' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  evidence?: string[];

  @ApiProperty({ description: 'Update timestamp' })
  @IsDate()
  @Type(() => Date)
  timestamp!: Date;
}

export class LearningGoalDto {
  @ApiProperty({ description: 'Goal ID' })
  id!: string;

  @ApiProperty({ description: 'Goal title' })
  title!: string;

  @ApiProperty({ description: 'Goal description' })
  description!: string;

  @ApiProperty({ enum: GoalType, description: 'Type of goal' })
  type!: GoalType;

  @ApiProperty({ enum: GoalStatus, description: 'Current status' })
  status!: GoalStatus;

  @ApiProperty({ description: 'Target value (e.g., hours, score, courses)' })
  targetValue!: number;

  @ApiProperty({ description: 'Current progress value' })
  currentValue!: number;

  @ApiProperty({ description: 'Progress percentage' })
  progressPercentage!: number;

  @ApiProperty({ description: 'Goal deadline' })
  deadline!: Date;

  @ApiProperty({ description: 'Creation date' })
  createdAt!: Date;

  @ApiPropertyOptional({ description: 'Completion date' })
  completedAt?: Date;

  @ApiPropertyOptional({ description: 'Associated course ID' })
  courseId?: string;

  @ApiPropertyOptional({
    description: 'ID of goal this goal depends on (GOAL-005)',
  })
  dependsOnGoalId?: string | null;

  @ApiPropertyOptional({ description: 'Reason this goal is currently blocked' })
  blockedReason?: string | null;

  @ApiPropertyOptional({ description: 'Reward for completion' })
  reward?: {
    type: string;
    value: number;
    description: string;
  };
}

export class LearningGoalsResponseDto {
  @ApiProperty({ description: 'Learning goals data' })
  data!: {
    userId: string;
    activeGoals: LearningGoalDto[];
    completedGoals: LearningGoalDto[];
    upcomingDeadlines: LearningGoalDto[];
    totalGoalsSet: number;
    totalGoalsCompleted: number;
    completionRate: number;
  };
}

export class LearningGoalResponseDto {
  @ApiProperty({ description: 'Goal ID' })
  id!: string;

  @ApiProperty({ description: 'Goal title' })
  title!: string;

  @ApiPropertyOptional({ description: 'Goal description' })
  description?: string;

  @ApiProperty({ description: 'Goal type' })
  type!: string;

  @ApiProperty({ description: 'Target date' })
  targetDate!: string;

  @ApiPropertyOptional({ description: 'Target value' })
  targetValue?: number;

  @ApiProperty({ description: 'Current value' })
  currentValue!: number;

  @ApiProperty({ description: 'Progress percentage' })
  progress!: number;

  @ApiProperty({ description: 'Is completed' })
  isCompleted!: boolean;

  @ApiPropertyOptional({ description: 'Completion date' })
  completedAt?: string;

  @ApiProperty({ description: 'Creation date' })
  createdAt!: string;

  @ApiPropertyOptional({
    description: 'ID of goal this goal depends on (GOAL-005)',
  })
  dependsOnGoalId?: string | null;

  @ApiPropertyOptional({
    description:
      'Human-readable reason this goal is blocked, e.g. \"Blocked by: Foundation Skills goal\"',
  })
  blockedReason?: string | null;
}

export class GoalAnalyticsResponseDto {
  @ApiProperty({ description: 'Total goals count' })
  totalGoals!: number;

  @ApiProperty({ description: 'Active goals count' })
  activeGoals!: number;

  @ApiProperty({ description: 'Completed goals count' })
  completedGoals!: number;

  @ApiProperty({ description: 'Overdue goals count' })
  overdueGoals!: number;

  @ApiProperty({ description: 'Completion rate percentage' })
  completionRate!: number;

  @ApiProperty({ description: 'Average completion time in days' })
  averageCompletionTimeDays!: number;

  @ApiProperty({ description: 'Goals by category' })
  goalsByCategory!: { [key: string]: number };

  @ApiProperty({ description: 'Goals by priority' })
  goalsByPriority!: { [key: string]: number };

  @ApiProperty({ description: 'Streak data' })
  streakData!: {
    currentStreak: number;
    longestStreak: number;
  };
}

export enum GoalRecommendationSource {
  AI_TUTOR = 'ai_tutor',
  PEER_TRENDS = 'peer_trends',
  PERFORMANCE_ANALYTICS = 'performance_analytics',
  COURSE_CONTENT = 'course_content',
}

export class RecommendedGoalDto {
  @ApiProperty({ description: 'Recommended goal title' })
  @IsString()
  title!: string;

  @ApiProperty({ description: 'Recommended goal description' })
  @IsString()
  description!: string;

  @ApiProperty({ enum: GoalCategory, description: 'Goal category' })
  @IsEnum(GoalCategory)
  category!: GoalCategory;

  @ApiProperty({ enum: GoalType, description: 'Goal type' })
  @IsEnum(GoalType)
  type!: GoalType;

  @ApiProperty({
    description: 'Reasoning for the recommendation',
  })
  @IsString()
  recommendationReason!: string;

  @ApiProperty({
    enum: GoalRecommendationSource,
    description: 'Source of the recommendation',
  })
  @IsEnum(GoalRecommendationSource)
  recommendationSource!: GoalRecommendationSource;

  @ApiPropertyOptional({
    description: 'Associated course or learning path ID',
  })
  @IsOptional()
  @IsString()
  relatedId?: string;

  @ApiPropertyOptional({ description: 'Exam stake score (0-1)' })
  @IsOptional()
  @IsNumber()
  examStake?: number;

  @ApiPropertyOptional({ enum: ExamType, description: 'Target exam type' })
  @IsOptional()
  @IsEnum(ExamType)
  examType?: ExamType;
}

export class RecommendedGoalsResponseDto {
  @ApiProperty({
    type: () => RecommendedGoalDto,
    isArray: true,
    description: 'List of recommended goals',
  })
  recommendations!: RecommendedGoalDto[];
}

export interface Milestone extends MilestoneDto {
  id: string;
  completed: boolean;
}

export interface LearningGoalWithMilestones {
  // LearningGoal properties
  id: string;
  userId: string;
  courseId: string | null;
  title: string;
  description: string | null;
  targetDate: Date | null;
  progress: number;
  type: string | null;
  completedAt: Date | null;
  startDate: Date | null;
  category: string | null;
  metadata: any | null;
  priority: number | null;
  streakCount: number | null;
  createdAt: Date;
  updatedAt: Date;
  status: any; // ProgressStatus
  estimatedRemainingHours: number | null;
  escalationLevel: number;
  lastEscalatedAt: Date | null;
  milestones: Milestone[];
  LearningGoalProgress?: any[];
}
