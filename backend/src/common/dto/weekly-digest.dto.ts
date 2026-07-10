// src/modules/communication/dto/weekly-digest.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsDateString } from 'class-validator';

export class WeekPeriodDto {
  @ApiProperty({ description: 'Week start date', format: 'date' })
  start!: string;

  @ApiProperty({ description: 'Week end date', format: 'date' })
  end!: string;
}

export class AchievementItemDto {
  @ApiProperty({ description: 'Achievement type' })
  type!: string;

  @ApiProperty({ description: 'Achievement description' })
  description!: string;

  @ApiPropertyOptional({ description: 'Points earned' })
  points?: number;
}

export class StudyStatsDto {
  @ApiProperty({ description: 'Total study time in minutes' })
  totalTime!: number;

  @ApiProperty({ description: 'Number of courses studied' })
  coursesStudied!: number;

  @ApiProperty({ description: 'Number of assessments completed' })
  assessmentsCompleted!: number;

  @ApiProperty({ description: 'Average score' })
  averageScore!: number;
}
export type StudyStats = StudyStatsDto;

export class RecommendationItemDto {
  @ApiProperty({ description: 'Recommendation title' })
  title!: string;

  @ApiProperty({ description: 'Recommendation description' })
  description!: string;

  @ApiProperty({ description: 'Recommendation URL' })
  url!: string;
}

export class DeadlineItemDto {
  @ApiProperty({ description: 'Deadline title' })
  title!: string;

  @ApiProperty({ description: 'Due date' })
  dueDate!: string;

  @ApiProperty({ description: 'Deadline type' })
  type!: string;
}

export class GenerateWeeklyDigestDto {
  @ApiProperty({ description: 'User ID' })
  @IsString()
  userId!: string;

  @ApiPropertyOptional({ description: 'Week start date (ISO string)' })
  @IsOptional()
  @IsDateString()
  weekStartDate?: string;
}

export class WeeklyDigestResponseDto {
  @ApiProperty({ description: 'User ID' })
  userId!: string;

  @ApiProperty({
    description: 'Week period',
    type: () => WeekPeriodDto,
  })
  weekPeriod!: WeekPeriodDto;

  @ApiProperty({
    description: 'Achievements earned this week',
    type: () => [AchievementItemDto],
  })
  achievements!: AchievementItemDto[];

  @ApiProperty({
    description: 'Study statistics for the week',
    type: () => StudyStatsDto,
  })
  studyStats!: StudyStatsDto;

  @ApiProperty({
    description: 'Personalized recommendations',
    type: () => [RecommendationItemDto],
  })
  recommendations!: RecommendationItemDto[];

  @ApiProperty({
    description: 'Upcoming deadlines',
    type: () => [DeadlineItemDto],
  })
  upcomingDeadlines!: DeadlineItemDto[];
}
