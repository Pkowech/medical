// src/modules/assessment/dto/unit-quiz.dto.ts
import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsNumber,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateUnitQuizDto {
  @ApiProperty({ description: 'Unit ID' })
  @IsString()
  @IsNotEmpty()
  unitId!: string;

  @ApiProperty({ description: 'Quiz title' })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiPropertyOptional({ description: 'Quiz description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Time limit in minutes' })
  @IsOptional()
  @IsNumber()
  @Min(5)
  timeLimitMinutes?: number;

  @ApiPropertyOptional({ description: 'Required to pass unit' })
  @IsOptional()
  isRequired?: boolean;
}

export class UnitQuizResponseDto {
  @ApiProperty({ description: 'Quiz ID' })
  id!: string;

  @ApiProperty({ description: 'Quiz title' })
  title!: string;

  @ApiProperty({ description: 'Unit ID' })
  unitId!: string;

  @ApiProperty({ description: 'Number of questions' })
  questionCount!: number;

  @ApiProperty({ description: 'Time limit in minutes' })
  timeLimitMinutes!: number;

  @ApiProperty({ description: 'User completion status' })
  isCompleted!: boolean;

  @ApiProperty({ description: 'User best score' })
  bestScore?: number;

  @ApiProperty({ description: 'Attempts made' })
  attemptsCount!: number;

  @ApiProperty({ description: 'Maximum attempts allowed' })
  maxAttempts!: number;
}
