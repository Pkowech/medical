// backend/src/modules/education/events/dto/create-event.dto.ts
import {
  IsString,
  IsOptional,
  IsDateString,
  IsNotEmpty,
  IsBoolean,
  IsInt,
  IsArray,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateEventDto {
  @ApiProperty({ description: 'Title of the event' })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiPropertyOptional({ description: 'Description of the event' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ description: 'Start date of the event' })
  @IsDateString()
  date!: string;

  @ApiProperty({ description: 'End date of the event' })
  @IsDateString()
  endDate!: string;

  @ApiPropertyOptional({ description: 'Type of event (lecture, exam, etc.)' })
  @IsString()
  @IsOptional()
  type?: string;

  @ApiPropertyOptional({ description: 'Location of the event' })
  @IsString()
  @IsOptional()
  location?: string;

  @ApiPropertyOptional({ description: 'Instructor name' })
  @IsString()
  @IsOptional()
  instructor?: string;

  @ApiPropertyOptional({ description: 'Whether the event/task is completed' })
  @IsBoolean()
  @IsOptional()
  completed?: boolean;

  @ApiPropertyOptional({ description: 'All-day event flag' })
  @IsBoolean()
  @IsOptional()
  allDay?: boolean;

  @ApiPropertyOptional({
    description: 'Priority level: 1=Normal, 2=Important, 3=Urgent',
    minimum: 1,
    maximum: 3,
  })
  @IsInt()
  @Min(1)
  @Max(3)
  @IsOptional()
  @Type(() => Number)
  priority?: number;

  @ApiPropertyOptional({
    description: 'Event status: pending, in_progress, completed, cancelled',
  })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({
    description: 'Event category: academic, social, personal, work',
  })
  @IsString()
  @IsOptional()
  category?: string;

  @ApiPropertyOptional({ description: 'Custom color for event (hex code)' })
  @IsString()
  @IsOptional()
  color?: string;

  @ApiPropertyOptional({ description: 'Whether this is a recurring event' })
  @IsBoolean()
  @IsOptional()
  isRecurring?: boolean;

  @ApiPropertyOptional({ description: 'Recurrence pattern object' })
  @IsOptional()
  recurrencePattern?: any;

  @ApiPropertyOptional({
    description: 'Reminder times in minutes before event',
  })
  @IsArray()
  @IsOptional()
  reminders?: number[];

  @ApiPropertyOptional({ description: 'Array of attendee IDs or emails' })
  @IsArray()
  @IsOptional()
  attendees?: string[];

  @ApiPropertyOptional({ description: 'Additional metadata' })
  @IsOptional()
  metadata?: any;

  @ApiPropertyOptional({ description: 'Related topic ID (ID-Reference)' })
  @IsString()
  @IsOptional()
  topicId?: string;

  @ApiPropertyOptional({ description: 'Related course ID (ID-Reference)' })
  @IsString()
  @IsOptional()
  courseId?: string;

  @ApiPropertyOptional({
    description: 'Related learning path ID (ID-Reference)',
  })
  @IsString()
  @IsOptional()
  learningPathId?: string;
}

export class UpdateEventDto {
  @ApiPropertyOptional({ description: 'Title of the event' })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiPropertyOptional({ description: 'Description of the event' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'Start date of the event' })
  @IsDateString()
  @IsOptional()
  date?: string;

  @ApiPropertyOptional({ description: 'End date of the event' })
  @IsDateString()
  @IsOptional()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Type of event (lecture, exam, etc.)' })
  @IsString()
  @IsOptional()
  type?: string;

  @ApiPropertyOptional({ description: 'Location of the event' })
  @IsString()
  @IsOptional()
  location?: string;

  @ApiPropertyOptional({ description: 'Instructor name' })
  @IsString()
  @IsOptional()
  instructor?: string;

  @ApiPropertyOptional({ description: 'Whether the event/task is completed' })
  @IsBoolean()
  @IsOptional()
  completed?: boolean;

  @ApiPropertyOptional({ description: 'All-day event flag' })
  @IsBoolean()
  @IsOptional()
  allDay?: boolean;

  @ApiPropertyOptional({
    description: 'Priority level: 1=Normal, 2=Important, 3=Urgent',
    minimum: 1,
    maximum: 3,
  })
  @IsInt()
  @Min(1)
  @Max(3)
  @IsOptional()
  @Type(() => Number)
  priority?: number;

  @ApiPropertyOptional({
    description: 'Event status: pending, in_progress, completed, cancelled',
  })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({
    description: 'Event category: academic, social, personal, work',
  })
  @IsString()
  @IsOptional()
  category?: string;

  @ApiPropertyOptional({ description: 'Custom color for event (hex code)' })
  @IsString()
  @IsOptional()
  color?: string;

  @ApiPropertyOptional({ description: 'Whether this is a recurring event' })
  @IsBoolean()
  @IsOptional()
  isRecurring?: boolean;

  @ApiPropertyOptional({ description: 'Recurrence pattern object' })
  @IsOptional()
  recurrencePattern?: any;

  @ApiPropertyOptional({
    description: 'Reminder times in minutes before event',
  })
  @IsArray()
  @IsOptional()
  reminders?: number[];

  @ApiPropertyOptional({ description: 'Array of attendee IDs or emails' })
  @IsArray()
  @IsOptional()
  attendees?: string[];

  @ApiPropertyOptional({ description: 'Additional metadata' })
  @IsOptional()
  metadata?: any;

  @ApiPropertyOptional({ description: 'Related topic ID (ID-Reference)' })
  @IsString()
  @IsOptional()
  topicId?: string;

  @ApiPropertyOptional({ description: 'Related course ID (ID-Reference)' })
  @IsString()
  @IsOptional()
  courseId?: string;

  @ApiPropertyOptional({
    description: 'Related learning path ID (ID-Reference)',
  })
  @IsString()
  @IsOptional()
  learningPathId?: string;
}
