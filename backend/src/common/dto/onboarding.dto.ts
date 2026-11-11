import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsBoolean,
  IsOptional,
  IsNumber,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsInt,
  MaxLength,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CAREER_STAGES } from '#common/constants/career-stages';

export class OnboardingStepDto {
  @ApiProperty({ example: 'discipline' })
  @IsString()
  step!: string;

  @ApiProperty({ example: true })
  @IsBoolean()
  completed!: boolean;
}

export class OnboardingResponseDto {
  @ApiProperty({ type: () => OnboardingStepDto, isArray: true })
  @Type(() => OnboardingStepDto)
  steps!: OnboardingStepDto[];

  @ApiProperty({ example: 100 })
  @IsNumber()
  progress!: number;
}

export class CompleteOnboardingDto {
  @ApiProperty({
    example: 'pharmacy',
    description: 'Healthcare field: medicine, nursing, pharmacy, dentistry, allied_health, etc.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  healthcareField!: string;

  @ApiProperty({
    example: 'student',
    description: 'Career stage: student, postgraduate, professional',
  })
  @IsString()
  @IsIn(CAREER_STAGES)
  careerStage!: string;

  @ApiPropertyOptional({ example: 4, description: 'Current study or training year (1 to 6)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(6)
  studyYear?: number;

  @ApiPropertyOptional({ example: 2, description: 'Years in professional practice' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(50)
  yearOfExperience?: number;

  @ApiPropertyOptional({
    example: 'Clinical Pharmacy',
    description: 'Specialization or sub-track (e.g., Clinical Pharmacy, Pediatrics, Critical Care)',
  })
  @IsOptional()
  @MaxLength(120)
  @IsString()
  specialization?: string;

  @ApiPropertyOptional({
    example: 'Kenyatta University',
    description: 'Institution, school, or hospital',
  })
  @IsOptional()
  @MaxLength(120)
  @IsString()
  institution?: string;

  @ApiPropertyOptional({
    example: 'Pharmacy & Poisons Board Stage II',
    description: 'Target exam, board certification, or primary milestone',
  })
  @IsOptional()
  @MaxLength(120)
  @IsString()
  targetExam?: string;

  @ApiPropertyOptional({
    example: ['Neurological Disorders', 'Pharmacotherapy', 'Ward Rounds'],
    description: 'Priority learning or focus topics',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  focusTopics?: string[];

  @ApiPropertyOptional({
    example: 60,
    description: 'Daily study goal in minutes',
  })
  @IsOptional()
  @IsNumber()
  @Min(5)
  @Max(720)
  dailyGoalMinutes?: number;
}

export class OnboardingStatusResponseDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  isCompleted!: boolean;

  @ApiProperty({ example: 100 })
  @IsNumber()
  completionPercentage!: number;

  @ApiPropertyOptional()
  profile?: {
    healthcareField?: string | null;
    careerStage?: string | null;
    studyYear?: number | null;
    yearOfExperience?: number | null;
    specialization?: string | null;
    institution?: string | null;
    targetExam?: string | null;
    dailyGoalMinutes?: number | null;
    focusTopics?: string[];
  };

  @ApiPropertyOptional({ isArray: true })
  suggestedStarterPaths?: Array<{
    id: string;
    title: string;
    description: string | null;
    difficulty: string;
    estimatedDurationWeeks: number | null;
    estimatedHoursPerWeek: number | null;
    specialization: string | null;
    targetCareerStages: string[];
    pathType: string;
    category: { name: string } | null;
  }>;
}
