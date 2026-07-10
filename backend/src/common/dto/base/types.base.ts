import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class QuestionOptionDto {
  @ApiProperty()
  @IsString()
  id!: string;

  @ApiProperty()
  @IsString()
  text!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isCorrect?: boolean;
}

export class EngagementMetrics {
  @ApiProperty()
  userId!: string;

  @ApiPropertyOptional()
  assessmentId?: string;

  @ApiPropertyOptional()
  timeSpent?: number;

  @ApiPropertyOptional()
  interactions?: Array<{
    questionId: string;
    type: 'view' | 'attempt' | 'hint';
    timestamp: Date;
  }>;

  @ApiProperty()
  dailyActiveStreak!: number;

  @ApiProperty()
  weeklyActiveStreak!: number;

  @ApiPropertyOptional()
  lastActivityDate!: string | Date | null;

  @ApiProperty()
  sessionCount!: number;

  @ApiProperty()
  averageSessionDuration!: number;

  @ApiProperty()
  mostActiveTimeOfDay!: string;

  @ApiProperty()
  mostActiveDayOfWeek!: string;

  @ApiPropertyOptional()
  weeklyEngagementScore?: number;

  @ApiPropertyOptional({ type: [String] })
  preferredStudyTimes?: string[];

  @ApiPropertyOptional()
  consistencyScore?: number;

  @ApiPropertyOptional()
  totalSessions?: number;
}

export class PerformanceMetrics {
  @ApiPropertyOptional()
  userId?: string;

  @ApiPropertyOptional()
  assessmentId?: string;

  @ApiPropertyOptional()
  overallScore?: number;

  @ApiPropertyOptional()
  averageScore?: number;

  @ApiPropertyOptional()
  averageAssessmentScore?: number;

  @ApiPropertyOptional()
  passRate?: number;

  @ApiPropertyOptional()
  totalAssessments?: number;

  @ApiPropertyOptional()
  completedAssessments?: number;

  @ApiPropertyOptional()
  averageTimePerQuestion?: number;

  @ApiPropertyOptional({ type: [String] })
  strongestTopics?: string[];

  @ApiPropertyOptional({ type: [String] })
  weakestTopics?: string[];

  @ApiPropertyOptional({ type: [String] })
  weaknessAreas?: string[];

  @ApiPropertyOptional({ type: [String] })
  strengthAreas?: string[];

  @ApiPropertyOptional()
  improvementRate?: number;

  @ApiPropertyOptional()
  skillMasteryProgress?: number | Record<string, number>;

  @ApiPropertyOptional()
  completionRate?: number;

  @ApiPropertyOptional({ type: [String] })
  strengths?: string[];

  @ApiPropertyOptional({ type: [String] })
  improvementAreas?: string[];
}

export class CategoryBreakdownDto {
  @ApiProperty()
  category!: string;

  @ApiProperty()
  correct!: number;

  @ApiProperty()
  total!: number;

  @ApiProperty()
  percentage!: number;

  // Additional optional properties for service compatibility
  @ApiProperty({ required: false })
  score?: number;
  @ApiProperty({ required: false })
  totalQuestions?: number;
  @ApiProperty({ required: false })
  correctAnswers?: number;
}

/**
 * Class for tracking progress trend over time
 * Shared across analytics.dto.ts and progress.dto.ts
 */
export class ProgressTrend {
  @ApiPropertyOptional()
  date?: Date;

  @ApiPropertyOptional()
  timestamp?: Date;

  @ApiPropertyOptional()
  userId?: string;

  @ApiPropertyOptional()
  courseId?: string;

  @ApiPropertyOptional()
  pathId?: string;

  @ApiPropertyOptional()
  coursesCompleted?: number;

  @ApiPropertyOptional()
  pathsCompleted?: number;

  @ApiPropertyOptional()
  studyTimeMinutes?: number;

  @ApiPropertyOptional()
  assessmentScore?: number | null;

  @ApiPropertyOptional()
  metric?: string;

  @ApiPropertyOptional()
  value?: number;

  @ApiPropertyOptional()
  type?: string;

  @ApiPropertyOptional()
  metadata?: Record<string, any>;
}
