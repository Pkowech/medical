import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsBoolean,
  IsOptional,
  IsNumber,
  IsArray,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

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
  healthcareField!: string;

  @ApiProperty({
    example: 'student',
    description: 'Career stage: student, resident_intern, licensed_professional, educator',
  })
  @IsString()
  careerStage!: string;

  @ApiPropertyOptional({ example: 4, description: 'Year of study (1 to 6)' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(6)
  studyYear?: number;

  @ApiPropertyOptional({ example: 2, description: 'Years of professional experience' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(60)
  yearOfExperience?: number;

  @ApiPropertyOptional({
    example: 'Clinical Pharmacy',
    description: 'Specialization or sub-track (e.g., Clinical Pharmacy, Pediatrics, Critical Care)',
  })
  @IsOptional()
  @IsString()
  specialization?: string;

  @ApiPropertyOptional({
    example: 'Kenyatta University',
    description: 'Institution, school, or hospital',
  })
  @IsOptional()
  @IsString()
  institution?: string;

  @ApiPropertyOptional({
    example: 'Pharmacy & Poisons Board Stage II',
    description: 'Target exam, board certification, or primary milestone',
  })
  @IsOptional()
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
    specialization: string | null;
  }>;
}
