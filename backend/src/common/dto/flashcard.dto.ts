import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {} from 'class-validator';

export class CreateFlashcardDto {
  @ApiPropertyOptional()
  userId?: string;

  @ApiPropertyOptional()
  materialId?: string;

  // canonical fields used by spaced-repetition APIs
  @ApiPropertyOptional()
  question?: string;

  @ApiPropertyOptional()
  content?: string;

  @ApiPropertyOptional()
  answer?: string;

  // compatibility fields used by the flashcards service
  @ApiPropertyOptional()
  questionId?: string;

  @ApiPropertyOptional()
  front?: string;

  @ApiPropertyOptional()
  back?: string;

  @ApiPropertyOptional()
  difficulty?: string;

  @ApiPropertyOptional({ type: [String] })
  tags?: string[];

  @ApiPropertyOptional({ type: [String] })
  hints?: string[];
}

export class RecordFlashcardResponseDto {
  @ApiProperty()
  userId!: string;

  @ApiProperty()
  flashcardId!: string;

  @ApiProperty()
  quality!: number;
}

export class FlashcardItemDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty()
  materialId!: string;

  @ApiProperty()
  easeFactor!: number;

  @ApiProperty()
  interval!: number;

  @ApiProperty()
  nextReview!: Date;

  @ApiProperty()
  @Type(() => Date)
  createdAt!: Date;

  @ApiProperty()
  @Type(() => Date)
  updatedAt!: Date;
}

export type FlashcardItemResponse = FlashcardItemDto;

export class FlashcardReviewDto {
  @ApiProperty()
  flashcardId!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty()
  quality!: number;

  @ApiPropertyOptional()
  notes?: string;
}

export class FlashcardReviewResponseDto {
  @ApiProperty()
  flashcardId!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty()
  quality!: number;

  @ApiPropertyOptional()
  notes?: string;
}

export class FlashcardDeckDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty()
  title!: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiProperty()
  @Type(() => Date)
  createdAt!: Date;

  @ApiProperty()
  @Type(() => Date)
  updatedAt!: Date;
}

export type FlashcardDeckResponse = FlashcardDeckDto;

export class UpdateFlashcardDto {
  @ApiPropertyOptional()
  questionId?: string;

  @ApiPropertyOptional()
  front?: string;

  @ApiPropertyOptional()
  back?: string;

  @ApiPropertyOptional()
  difficulty?: string;

  @ApiPropertyOptional({ type: [String] })
  tags?: string[];

  @ApiPropertyOptional({ type: [String] })
  hints?: string[];
}

export type UpdateFlashcardResponse = UpdateFlashcardDto;

export class FlashcardSearchDto {
  @ApiPropertyOptional()
  query?: string;

  @ApiPropertyOptional({ type: [String] })
  tags?: string[];
}

export class SyncFlashcardDto {
  @ApiPropertyOptional()
  questionId?: string;

  @ApiPropertyOptional()
  front?: string;

  @ApiPropertyOptional()
  back?: string;

  @ApiPropertyOptional()
  difficulty?: string;

  @ApiPropertyOptional({ type: [String] })
  tags?: string[];

  @ApiPropertyOptional({ type: [String] })
  hints?: string[];

  @ApiPropertyOptional()
  @Type(() => Date)
  updatedAt?: Date; // From Flashcard

  // UserFlashcardProgress fields
  @ApiPropertyOptional()
  easeFactor?: number;

  @ApiPropertyOptional()
  interval?: number;

  @ApiPropertyOptional()
  @Type(() => Date)
  nextReview?: Date;

  @ApiPropertyOptional()
  correctStreak?: number;

  @ApiPropertyOptional()
  @Type(() => Date)
  lastReview?: Date;

  @ApiPropertyOptional()
  repetitions?: number;
}

export class AdaptiveQuizResultDto {
  @ApiProperty()
  userId!: string;

  @ApiProperty()
  quizId!: string;

  @ApiProperty()
  score!: number;

  @ApiProperty()
  totalQuestions!: number;

  @ApiProperty()
  correctAnswers!: number;

  @ApiProperty()
  incorrectAnswers!: number;

  @ApiProperty()
  @Type(() => Date)
  createdAt!: Date;

  @ApiProperty()
  @Type(() => Date)
  updatedAt!: Date;
}

export type AdaptiveQuizResultResponse = AdaptiveQuizResultDto;

export class AdaptiveQuizQuestionDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  quizId!: string;

  @ApiProperty()
  question!: string;

  @ApiProperty({ type: [String] })
  options!: string[];

  @ApiProperty()
  correctAnswer!: string;

  @ApiProperty()
  @Type(() => Date)
  createdAt!: Date;

  @ApiProperty()
  @Type(() => Date)
  updatedAt!: Date;
}

export type AdaptiveQuizQuestionResponse = AdaptiveQuizQuestionDto;
