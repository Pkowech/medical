import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsBoolean,
  IsOptional,
  IsDate,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * FlashcardResult DTO
 * Represents the result of a flashcard/quiz attempt
 */
export class FlashcardResultDto {
  @ApiProperty({ description: 'Result ID' })
  @IsString()
  id!: string;

  @ApiProperty({ description: 'Student/User ID' })
  @IsString()
  userId!: string;

  @ApiProperty({ description: 'Unit ID' })
  @IsString()
  unitId!: string;

  @ApiPropertyOptional({ description: 'Quiz ID (if linked to quiz)' })
  @IsString()
  @IsOptional()
  quizId?: string;

  @ApiProperty({ description: 'Score achieved' })
  @IsNumber()
  score!: number;

  @ApiProperty({ description: 'Whether the attempt was passed' })
  @IsBoolean()
  passed!: boolean;

  @ApiProperty({
    description: 'Timestamp of attempt',
    type: String,
    format: 'date-time',
  })
  @Type(() => Date)
  @IsDate()
  attemptedAt!: Date;
}

export class CreateFlashcardResultDto {
  @ApiProperty({ description: 'Student/User ID' })
  @IsString()
  userId!: string;

  @ApiProperty({ description: 'Unit ID' })
  @IsString()
  unitId!: string;

  @ApiPropertyOptional({ description: 'Quiz ID' })
  @IsString()
  @IsOptional()
  quizId?: string;

  @ApiProperty({ description: 'Score' })
  @IsNumber()
  score!: number;

  @ApiProperty({ description: 'Passed' })
  @IsBoolean()
  passed!: boolean;
}

export class UpdateFlashcardResultDto {
  @ApiPropertyOptional({ description: 'Score' })
  @IsNumber()
  @IsOptional()
  score?: number;

  @ApiPropertyOptional({ description: 'Passed' })
  @IsBoolean()
  @IsOptional()
  passed?: boolean;
}
