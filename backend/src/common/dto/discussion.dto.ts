import { IsString, IsOptional, IsArray, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DiscussionType, Prisma } from '@prisma/client';

export class CreateDiscussionDto {
  @ApiProperty({ description: 'Title of the discussion' })
  @IsString()
  title!: string;

  @ApiPropertyOptional({ description: 'Content of the discussion' })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiProperty({ enum: DiscussionType, description: 'Type of discussion' })
  @IsEnum(DiscussionType)
  type!: DiscussionType;

  @ApiPropertyOptional({
    description: 'Tags for the discussion',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ description: 'Poll data for poll discussions' })
  @IsOptional()
  pollData?: Prisma.JsonValue;

  @ApiPropertyOptional({ description: 'Attachments for the discussion' })
  @IsOptional()
  @IsArray()
  attachments?: Prisma.JsonValue[];
}

export interface GroupDiscussionMetadata {
  content?: string;
  tags?: string[];
  pollData?: Prisma.JsonValue;
  attachments?: Prisma.JsonValue[];
  messageCount: number;
  lastMessageBy?: string;
}
