import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsString, IsNumber, IsOptional, IsObject } from 'class-validator';

/**
 * StudentInteraction DTO
 * Represents a student's interaction with a unit
 * (e.g., viewed, completed, liked, recommended_and_viewed)
 */
export class StudentInteractionDto {
  @ApiProperty({ description: 'Interaction ID' })
  @IsString()
  id!: string;

  @ApiProperty({ description: 'Student/User ID' })
  @IsString()
  userId!: string;

  @ApiProperty({ description: 'Unit ID' })
  @IsString()
  unitId!: string;

  @ApiProperty({
    description: 'Type of interaction',
    example: 'viewed, completed, liked, disliked',
  })
  @IsString()
  interactionType!: string;

  @ApiProperty({
    description: 'Interaction strength/sentiment score',
    default: 0,
  })
  @IsNumber()
  score: number = 0;

  @ApiPropertyOptional({ description: 'Additional metadata' })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;

  @ApiProperty({ description: 'Creation timestamp' })
  @Type(() => Date)
  createdAt!: Date;
}

export class CreateStudentInteractionDto {
  @ApiProperty({ description: 'Student/User ID' })
  @IsString()
  userId!: string;

  @ApiProperty({ description: 'Unit ID' })
  @IsString()
  unitId!: string;

  @ApiProperty({ description: 'Type of interaction' })
  @IsString()
  interactionType!: string;

  @ApiPropertyOptional({ description: 'Interaction score', default: 0 })
  @IsNumber()
  @IsOptional()
  score?: number;

  @ApiPropertyOptional({ description: 'Metadata' })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}

export class UpdateStudentInteractionDto {
  @ApiPropertyOptional({ description: 'Interaction type' })
  @IsString()
  @IsOptional()
  interactionType?: string;

  @ApiPropertyOptional({ description: 'Score' })
  @IsNumber()
  @IsOptional()
  score?: number;

  @ApiPropertyOptional({ description: 'Metadata' })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}
