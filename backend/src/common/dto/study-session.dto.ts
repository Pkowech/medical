// src/modules/study/dto/study-session.dto.ts
import {
  IsString,
  IsDateString,
  IsOptional,
  IsNumber,
  IsDate,
  IsArray,
  IsObject,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateStudySessionDto {
  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsDateString()
  scheduledDate!: string;

  @IsNumber()
  duration!: number;

  @IsOptional()
  @IsString()
  studyGroupId?: string;
}

export class StudySessionDto {
  @ApiProperty({ description: 'Session ID' })
  @IsString()
  id!: string;

  @ApiProperty({ description: 'User ID' })
  @IsString()
  userId!: string;

  @ApiPropertyOptional({ description: 'Material ID' })
  @IsOptional()
  @IsString()
  materialId?: string;

  @ApiProperty({ description: 'Start time' })
  @Type(() => Date)
  @IsDate()
  startTime!: Date;

  @ApiPropertyOptional({ description: 'End time' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  endTime?: Date;

  @ApiProperty({ description: 'Duration in minutes', default: 0 })
  @IsNumber()
  duration!: number;

  @ApiProperty({ description: 'Focus score (0-100)', default: 0 })
  @IsNumber()
  focusScore!: number;

  @ApiPropertyOptional({ description: 'Activities in this session' })
  @IsOptional()
  @IsArray()
  activities?: any[];

  @ApiPropertyOptional({ description: 'Metadata' })
  @IsOptional()
  @IsObject()
  metadata?: any;
}
