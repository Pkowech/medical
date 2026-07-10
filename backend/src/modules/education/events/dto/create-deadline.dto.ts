// backend/src/modules/education/events/dto/create-deadline.dto.ts
import {
  IsString,
  IsOptional,
  IsDateString,
  IsNotEmpty,
  IsEnum,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum DeadlinePriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
}

export class CreateDeadlineDto {
  @ApiProperty({ description: 'Title of the deadline' })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiPropertyOptional({ description: 'Description of the deadline' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ description: 'Due date of the deadline' })
  @IsDateString()
  dueDate!: string;

  @ApiPropertyOptional({
    description: 'Priority level: low, medium, high',
    enum: DeadlinePriority,
  })
  @IsEnum(DeadlinePriority)
  @IsOptional()
  priority?: DeadlinePriority;

  @ApiPropertyOptional({ description: 'Related course ID' })
  @IsString()
  @IsOptional()
  courseId?: string;

  @ApiPropertyOptional({ description: 'Related unit ID' })
  @IsString()
  @IsOptional()
  unitId?: string;

  @ApiPropertyOptional({ description: 'Additional metadata' })
  @IsOptional()
  metadata?: any;
}

export class UpdateDeadlineDto {
  @ApiPropertyOptional({ description: 'Title of the deadline' })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiPropertyOptional({ description: 'Description of the deadline' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'Due date of the deadline' })
  @IsDateString()
  @IsOptional()
  dueDate?: string;

  @ApiPropertyOptional({
    description: 'Priority level: low, medium, high',
    enum: DeadlinePriority,
  })
  @IsEnum(DeadlinePriority)
  @IsOptional()
  priority?: DeadlinePriority;

  @ApiPropertyOptional({ description: 'Related course ID' })
  @IsString()
  @IsOptional()
  courseId?: string;

  @ApiPropertyOptional({ description: 'Related unit ID' })
  @IsString()
  @IsOptional()
  unitId?: string;

  @ApiPropertyOptional({ description: 'Additional metadata' })
  @IsOptional()
  metadata?: any;
}
