import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, Min, Max } from 'class-validator';
import { PredictionType } from '@prisma/client';
import { BaseResponseDto, BaseUserResponseDto, ApiResponseDto } from './base';

export { BaseResponseDto, BaseUserResponseDto, ApiResponseDto };

// Extracted DTO classes for StudyPatternsResponseDto nested objects
export class StudyDurationMetricsDto {
  @ApiProperty({ description: 'Average study session duration (minutes)' })
  averageDuration!: number;

  @ApiProperty({ description: 'Longest session duration (minutes)' })
  longestSession!: number;

  @ApiProperty({ description: 'Shortest session duration (minutes)' })
  shortestSession!: number;
}

export class PreferredStudyTimesDto {
  @ApiProperty({ description: 'Morning study sessions count' })
  morning!: number;

  @ApiProperty({ description: 'Afternoon study sessions count' })
  afternoon!: number;

  @ApiProperty({ description: 'Evening study sessions count' })
  evening!: number;

  @ApiProperty({ description: 'Night study sessions count' })
  night!: number;
}

export class FlashcardStatsResponseDto {
  @ApiProperty()
  totalCards!: number;

  @ApiProperty()
  newCardsToday!: number;

  @ApiProperty()
  cardsToReview!: number;

  @ApiProperty()
  masteredCards!: number;

  @ApiProperty()
  averageRetention!: number;
}

export class SpacedRepetitionStatsResponseDto {
  @ApiProperty()
  dueCount!: number;

  @ApiProperty()
  overdueCount!: number;

  @ApiProperty()
  learningCount!: number;

  @ApiProperty()
  reviewCount!: number;
}

export class StudyPatternsResponseDto {
  @ApiProperty()
  userId!: string;

  @ApiProperty({ type: [String] })
  patterns!: string[];

  @ApiProperty({ description: 'Distinct active study days in the last 30 days' })
  consistency!: number;

  @ApiProperty({
    description: 'Study duration in minutes for each time-of-day bucket',
  })
  timeDistribution!: Record<string, number>;

  @ApiProperty({
    description: 'Study duration metrics',
    type: () => StudyDurationMetricsDto,
  })
  studyDuration!: StudyDurationMetricsDto;

  @ApiProperty({
    description: 'Completed study session counts by time of day',
    type: () => PreferredStudyTimesDto,
  })
  preferredStudyTimes!: PreferredStudyTimesDto;

  @ApiProperty()
  performanceByTopic!: Record<string, number>;

  @ApiProperty({ description: 'Share of active study days in the last 30 days (0-1)' })
  consistencyScore!: number;
}

export class PredictionResponseDto {
  @ApiProperty()
  userId!: string;

  @ApiProperty({ enum: Object.keys(PredictionType) })
  type!: string; // Using string to match the service usage if PredictionType is used as enum

  @ApiProperty()
  probability!: number;

  @ApiProperty()
  confidence!: number;

  @ApiProperty({ type: [String] })
  factors!: string[];

  @ApiProperty()
  predictedSuccessRate!: number;

  @ApiProperty()
  recommendedStudyTime!: number;

  @ApiProperty({ type: [String] })
  explanations!: string[];

  @ApiPropertyOptional()
  reasoning?: string;
}

export class RecommendationResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  type!: string;

  @ApiProperty()
  title!: string;

  @ApiPropertyOptional()
  url?: string;

  @ApiProperty()
  priority!: string;

  @ApiPropertyOptional()
  reason?: string;
}

// Analytics & Learning Recommendations removed as they are unused

// ProgressAnalyticsResponseDto removed as it's unused

// `UserAnalyticsResponseDto` moved to `user.dto.ts` to avoid circular runtime imports

export class SystemAnalyticsResponseDto {
  @ApiProperty()
  @IsNumber()
  totalUsers!: number;

  @ApiProperty()
  @IsNumber()
  totalCourses!: number;

  @ApiProperty()
  @IsNumber()
  activeLearners!: number;

  @ApiProperty()
  @IsNumber()
  completedCourses!: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  @Max(100)
  averageCompletionRate!: number;

  @ApiProperty()
  @IsNumber()
  totalPaths!: number;

  @ApiProperty()
  @IsNumber()
  totalEnrollments!: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  @Max(100)
  overallCompletionRate!: number;
}

export class PathAnalyticsResponseDto {
  @ApiProperty({ description: 'Learning path identifier' })
  pathId!: string;

  @ApiProperty({ description: 'Mean completion percentage across progress records' })
  averageCompletionRate!: number;

  @ApiProperty({ description: 'Mean completion time in seconds' })
  averageTimeToComplete!: number;
}
