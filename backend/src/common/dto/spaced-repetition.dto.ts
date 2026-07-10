// src/modules/ai/dto/spaced-repetition.dto.ts
import { IsString, IsNumber, IsOptional } from 'class-validator';

export class UpdateSpacedRepetitionDto {
  @IsString()
  userId!: string;

  @IsString()
  itemId!: string;

  @IsString()
  itemType!: 'flashcard' | 'question' | 'concept';

  @IsNumber()
  difficulty!: number; // 1-5 scale

  @IsNumber()
  responseTime!: number; // milliseconds

  @IsOptional()
  @IsString()
  quality?: 'easy' | 'good' | 'hard' | 'again';
}
