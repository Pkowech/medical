import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsEnum,
  IsOptional,
  IsDate,
  IsArray,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';
import { MessageRole } from '@prisma/client';

export class ChatMessageDto {
  @ApiProperty({ description: 'Message ID' })
  @IsString()
  id!: string;

  @ApiProperty({ description: 'Session ID' })
  @IsString()
  sessionId!: string;

  @ApiProperty({ description: 'User ID' })
  @IsString()
  userId!: string;

  @ApiProperty({ description: 'Message content' })
  @IsString()
  content!: string;

  @ApiProperty({ description: 'Sender role', enum: MessageRole })
  @IsEnum(MessageRole)
  role!: MessageRole;

  @ApiProperty({ description: 'Creation timestamp' })
  @Type(() => Date)
  @IsDate()
  createdAt!: Date;

  @ApiPropertyOptional({ description: 'Metadata' })
  @IsOptional()
  @IsObject()
  metadata?: any;
}

export class ChatSessionDto {
  @ApiProperty({ description: 'Session ID' })
  @IsString()
  id!: string;

  @ApiProperty({ description: 'User ID' })
  @IsString()
  userId!: string;

  @ApiProperty({ description: 'Start time' })
  @Type(() => Date)
  @IsDate()
  startTime!: Date;

  @ApiPropertyOptional({ description: 'End time' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  endTime?: Date;

  @ApiPropertyOptional({ description: 'Topics discussed' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  topics?: string[];

  @ApiPropertyOptional({ description: 'Status' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({
    description: 'Messages in this session',
    type: [ChatMessageDto],
  })
  @IsOptional()
  @IsArray()
  @Type(() => ChatMessageDto)
  messages?: ChatMessageDto[];

  @ApiProperty({ description: 'Creation timestamp' })
  @Type(() => Date)
  @IsDate()
  createdAt!: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  @Type(() => Date)
  @IsDate()
  updatedAt!: Date;
}
