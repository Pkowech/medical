import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsOptional,
  IsDate,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';

export class LearningHistoryDto {
  @ApiProperty({ description: 'History ID' })
  @IsString()
  id!: string;

  @ApiProperty({ description: 'User ID' })
  @IsString()
  userId!: string;

  @ApiProperty({ description: 'Item ID (Material/Topic/Unit)' })
  @IsString()
  itemId!: string;

  @ApiProperty({ description: 'Type of item' })
  @IsString()
  itemType!: string;

  @ApiProperty({ description: 'Action type (viewed, completed, etc.)' })
  @IsString()
  actionType!: string;

  @ApiProperty({ description: 'Timestamp' })
  @Type(() => Date)
  @IsDate()
  timestamp!: Date;

  @ApiPropertyOptional({ description: 'Duration in seconds' })
  @IsOptional()
  @IsNumber()
  duration?: number;

  @ApiPropertyOptional({ description: 'Score achieved' })
  @IsOptional()
  @IsNumber()
  score?: number;

  @ApiPropertyOptional({ description: 'Metadata' })
  @IsOptional()
  @IsObject()
  metadata?: any;
}
