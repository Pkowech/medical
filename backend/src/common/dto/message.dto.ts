import {
  IsString,
  IsOptional,
  IsArray,
  IsEnum,
  IsObject,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MessageType, Prisma, MessageRole } from '@prisma/client';

export class CreateMessageDto {
  @ApiProperty({ description: 'Content of the message' })
  @IsString()
  content!: string;

  @ApiPropertyOptional({
    description: 'Discussion ID (for forum/discussion messages)',
  })
  @IsOptional()
  @IsString()
  discussionId?: string;

  @ApiPropertyOptional({ enum: MessageType, description: 'Type of message' })
  @IsOptional()
  @IsEnum(MessageType)
  type?: MessageType;

  @ApiPropertyOptional({ description: 'Attachments for the message' })
  @IsOptional()
  @IsArray()
  attachments?: Prisma.JsonValue[];

  @ApiPropertyOptional({ description: 'Arbitrary metadata for the message' })
  @IsOptional()
  @IsObject()
  metadata?: Prisma.JsonValue;

  @ApiPropertyOptional({ description: 'ID of the message this is a reply to' })
  @IsOptional()
  @IsString()
  replyToId?: string;
}

export class CreateChatMessageDto {
  @ApiProperty({
    description: 'Chat session id (maps to ChatMessage.sessionId)',
  })
  @IsString()
  sessionId!: string;

  @ApiProperty({ description: 'Content of the chat message' })
  @IsString()
  content!: string;

  @ApiPropertyOptional({
    enum: MessageRole,
    description: 'Role of sender (system, user, etc.)',
  })
  @IsOptional()
  @IsEnum(MessageRole)
  role?: MessageRole;

  @ApiPropertyOptional({
    description: 'Arbitrary metadata attached to the message',
  })
  @IsOptional()
  @IsObject()
  metadata?: Prisma.JsonValue;
}

export class ChatMessageResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  sessionId!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty()
  content!: string;

  @ApiProperty({ enum: MessageRole })
  role!: MessageRole;

  @ApiPropertyOptional()
  metadata?: Prisma.JsonValue;

  @ApiProperty()
  createdAt!: Date;
}

export class CreateChatDto {
  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsArray()
  @IsString({ each: true })
  participantIds!: string[];

  @IsOptional()
  @IsString()
  type?: 'private' | 'group' | 'studyGroup';
}

export interface ChatRequest {
  message: string;
  user_id: string;
  context?: string;
  metadata?: Record<string, any>;
}

export interface ChatResponse {
  message: string;
  type: 'text' | 'suggestion' | 'resource' | 'error';
  metadata?: {
    confidence: number;
    source?: string;
    related_resources?: string[];
  };
}
export class SendMessageDto {
  @IsString()
  content!: string;

  @IsString()
  chatId!: string;

  @IsOptional()
  @IsString()
  type?: 'text' | 'image' | 'file' | 'voice';

  @IsOptional()
  @IsString()
  replyToMessageId?: string;

  @IsOptional()
  attachments?: Array<{
    name: string;
    url: string;
    type: string;
    size: number;
  }>;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
