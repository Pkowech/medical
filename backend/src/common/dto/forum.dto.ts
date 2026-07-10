import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  IsBoolean,
} from 'class-validator';
import {
  GroupDiscussion,
  DiscussionMessage,
  DiscussionType,
  MessageType,
} from '@prisma/client';

export class CreateForumDto {
  @ApiProperty({ description: 'Name of the forum' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({ description: 'Description of the forum' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'Category of the forum' })
  @IsString()
  @IsOptional()
  category?: string;

  @ApiPropertyOptional({ description: 'Tags associated with the forum' })
  @IsArray()
  @IsOptional()
  tags?: string[];

  @ApiPropertyOptional({ description: 'Whether the forum is private' })
  @IsBoolean()
  @IsOptional()
  isPrivate?: boolean;
}

export class UpdateForumDto {
  @ApiPropertyOptional({ description: 'Updated name of the forum' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ description: 'Updated description of the forum' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'Updated category of the forum' })
  @IsString()
  @IsOptional()
  category?: string;

  @ApiPropertyOptional({
    description: 'Updated tags associated with the forum',
  })
  @IsArray()
  @IsOptional()
  tags?: string[];

  @ApiPropertyOptional({ description: 'Whether the forum is private' })
  @IsBoolean()
  @IsOptional()
  isPrivate?: boolean;
}

export class CreateTopicDto {
  @ApiProperty({ description: 'Title of the topic' })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiPropertyOptional({ description: 'Content of the topic' })
  @IsString()
  @IsOptional()
  content?: string;

  @ApiPropertyOptional({ description: 'Tags associated with the topic' })
  @IsArray()
  @IsOptional()
  tags?: string[];
}

export class CreatePostDto {
  @ApiProperty({ description: 'Content of the post' })
  @IsString()
  @IsNotEmpty()
  content!: string;

  @ApiPropertyOptional({ description: 'ID of the parent post (for replies)' })
  @IsString()
  @IsOptional()
  parentId?: string;

  @ApiPropertyOptional({ description: 'Attachments for the post' })
  @IsArray()
  @IsOptional()
  attachments?: string[];
}

export class ForumResponseDto {
  @ApiProperty({ description: 'Unique identifier for the forum' })
  id!: string;

  @ApiProperty({ description: 'Name of the forum' })
  name!: string;

  @ApiPropertyOptional({ description: 'Description of the forum' })
  description?: string;

  @ApiPropertyOptional({ description: 'Category of the forum' })
  category?: string;

  @ApiPropertyOptional({ description: 'Tags associated with the forum' })
  tags?: string[];

  @ApiPropertyOptional({ description: 'Whether the forum is private' })
  isPrivate?: boolean;

  @ApiProperty({ description: 'Date and time when the forum was created' })
  @Type(() => Date)
  createdAt!: Date;

  @ApiProperty({ description: 'Date and time when the forum was last updated' })
  @Type(() => Date)
  updatedAt!: Date;

  @ApiProperty({ description: 'Number of topics in the forum' })
  topicCount!: number;

  @ApiProperty({ description: 'Number of posts in the forum' })
  postCount!: number;

  @ApiProperty({
    description: 'Date and time of the last activity in the forum',
  })
  @Type(() => Date)
  lastActivity!: Date;

  constructor(
    partial: Partial<GroupDiscussion> & {
      topicCount?: number;
      postCount?: number;
      lastActivity?: Date;
      category?: string;
      description?: string;
    },
  ) {
    Object.assign(this, partial);
    this.id = partial.id!;
    this.name = partial.title ?? this.name;
    this.description =
      partial.description ?? (partial.metadata as any)?.description;
    this.category = partial.category ?? (partial.metadata as any)?.category;
    this.topicCount = partial.topicCount ?? 0;
    this.postCount = partial.postCount ?? 0;
    this.lastActivity = partial.lastActivity ?? partial.updatedAt ?? new Date();
    this.createdAt = partial.createdAt!;
    this.updatedAt = partial.updatedAt!;
  }
}

export class TopicResponseDto {
  @ApiProperty({ description: 'Unique identifier for the topic' })
  id!: string;

  @ApiProperty({ description: 'Title of the discussion topic' })
  title!: string;

  @ApiProperty({ enum: DiscussionType, description: 'Type of the discussion' })
  type!: DiscussionType;

  @ApiPropertyOptional({
    description: 'Content of the initial post',
    required: false,
  })
  content?: string;

  @ApiProperty({ description: 'ID of the study group this topic belongs to' })
  studyGroupId!: string;

  @ApiProperty({ description: 'Date and time when the topic was created' })
  @Type(() => Date)
  createdAt!: Date;

  @ApiProperty({ description: 'Date and time when the topic was last updated' })
  @Type(() => Date)
  updatedAt!: Date;

  constructor(partial: Partial<DiscussionMessage>) {
    Object.assign(this, partial);
  }
}

export class MessageResponseDto {
  @ApiProperty({ description: 'Unique identifier for the message' })
  id!: string;

  @ApiProperty({ description: 'Content of the message' })
  content!: string;

  @ApiProperty({ enum: MessageType, description: 'Type of the message' })
  type!: MessageType;

  @ApiProperty({ description: 'ID of the discussion this message belongs to' })
  discussionId!: string;

  @ApiProperty({ description: 'ID of the user who sent the message' })
  userId!: string;

  @ApiPropertyOptional({
    description: 'ID of the message this is a reply to',
    required: false,
  })
  replyToId?: string;

  @ApiProperty({ description: 'Date and time when the message was created' })
  @Type(() => Date)
  createdAt!: Date;

  @ApiProperty({
    description: 'Date and time when the message was last updated',
  })
  @Type(() => Date)
  updatedAt!: Date;

  constructor(partial: Partial<DiscussionMessage>) {
    Object.assign(this, partial);
  }
}
