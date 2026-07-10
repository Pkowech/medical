// src/modules/assessment/dto/feedback.dto.ts
import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum FeedbackType {
  COURSE = 'course',
  QUIZ = 'quiz',
  UNIT = 'unit',
  GENERAL = 'general',
}

export class UserInfoDto {
  @ApiProperty({ description: 'User ID' })
  id!: string;

  @ApiProperty({ description: 'User first name' })
  firstName!: string;

  @ApiProperty({ description: 'User last name' })
  lastName!: string;
}

export class CreateFeedbackDto {
  @ApiProperty({ description: 'Feedback content' })
  @IsString()
  @IsNotEmpty()
  content!: string;

  @ApiProperty({ enum: FeedbackType, description: 'Type of feedback' })
  @IsEnum(FeedbackType)
  type!: FeedbackType;

  @ApiPropertyOptional({
    description: 'Related entity ID (course, quiz, etc.)',
  })
  @IsOptional()
  @IsString()
  entityId?: string;

  @ApiPropertyOptional({ description: 'Rating from 1-5' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  rating?: number;

  @ApiPropertyOptional({ description: 'Whether feedback is anonymous' })
  @IsOptional()
  isAnonymous?: boolean;
}

export class FeedbackResponseDto {
  @ApiProperty({ description: 'Feedback ID' })
  id!: string;

  @ApiProperty({ description: 'Feedback content' })
  content!: string;

  @ApiProperty({ enum: FeedbackType, description: 'Feedback type' })
  type!: FeedbackType;

  @ApiPropertyOptional({ description: 'Related entity ID' })
  entityId?: string;

  @ApiPropertyOptional({ description: 'User rating' })
  rating?: number;

  @ApiProperty({ description: 'Submission date' })
  createdAt!: Date;

  @ApiPropertyOptional({
    description: 'User details (if not anonymous)',
    type: () => UserInfoDto,
  })
  @Type(() => UserInfoDto)
  user?: UserInfoDto;
}
