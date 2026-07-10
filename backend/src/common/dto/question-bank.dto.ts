import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  Question,
  QuestionType,
  QuestionDifficulty,
  QuestionCategory,
} from '@prisma/client';
import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsNumber,
  IsOptional,
  IsArray,
  IsUUID,
  ValidateNested,
  Min,
  ArrayMinSize,
  IsUrl,
  MinLength,
} from 'class-validator';
import { QuestionOptionDto } from './base';

export class CreateQuestionDto {
  @ApiProperty({ description: 'Question text' })
  @IsString()
  @IsNotEmpty()
  text!: string;

  @ApiProperty({ enum: QuestionType, description: 'Question type' })
  @IsEnum(QuestionType)
  type!: QuestionType;

  @ApiProperty({ enum: QuestionDifficulty, description: 'Difficulty level' })
  @IsEnum(QuestionDifficulty)
  difficulty!: QuestionDifficulty;

  @ApiProperty({
    type: () => QuestionOptionDto,
    isArray: true,
    description: 'Answer options',
  })
  @IsArray()
  @Type(() => QuestionOptionDto)
  options!: QuestionOptionDto[];

  @ApiPropertyOptional({ description: 'Question category/topic' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: 'Learning objectives tags' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ description: 'Question explanation' })
  @IsOptional()
  @IsString()
  explanation?: string;

  @ApiPropertyOptional({ description: 'Reference materials' })
  @IsOptional()
  @IsString()
  references?: string;
}

export class QuestionBankFilterDto {
  @ApiPropertyOptional({
    enum: QuestionType,
    description: 'Filter by question type',
  })
  @IsOptional()
  @IsEnum(QuestionType)
  type?: QuestionType;

  @ApiPropertyOptional({
    enum: QuestionDifficulty,
    description: 'Filter by difficulty',
  })
  @IsOptional()
  @IsEnum(QuestionDifficulty)
  difficulty?: QuestionDifficulty;

  @ApiPropertyOptional({ description: 'Filter by category' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: 'Filter by tags' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

export class QuestionBankResponseDto {
  @ApiProperty({ description: 'Question ID' })
  id!: string;

  @ApiProperty({ description: 'Question text' })
  text!: string;

  @ApiProperty({ enum: QuestionType, description: 'Question type' })
  type!: QuestionType;

  @ApiProperty({ enum: QuestionDifficulty, description: 'Difficulty level' })
  difficulty!: QuestionDifficulty;

  @ApiProperty({ description: 'Number of options' })
  optionsCount!: number;

  @ApiPropertyOptional({ description: 'Question category' })
  category?: string;

  @ApiPropertyOptional({ description: 'Associated tags' })
  tags?: string[];

  @ApiProperty({ description: 'Creation date' })
  createdAt!: Date;

  @ApiProperty({ description: 'Times used in quizzes' })
  usageCount!: number;
}

export class CreateQuestionBankDto {
  @IsString()
  @MinLength(10)
  questionText!: string;

  @IsEnum(QuestionType)
  type!: QuestionType;

  @IsEnum(QuestionDifficulty)
  difficulty!: QuestionDifficulty;

  @IsEnum(QuestionCategory)
  category!: QuestionCategory;

  @IsNumber()
  @IsOptional()
  @Min(0)
  points?: number;

  @IsString()
  @IsOptional()
  explanation?: string;

  @IsString()
  @IsOptional()
  reference?: string;

  @IsUrl()
  @IsOptional()
  imageUrl?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @IsUUID()
  @IsOptional()
  courseId?: string;

  @IsUUID()
  @IsOptional()
  unitId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @ArrayMinSize(1)
  @Type(() => QuestionOptionDto)
  options!: QuestionOptionDto[];
}

export class UpdateQuestionBankDto {
  @IsString()
  @MinLength(10)
  @IsOptional()
  questionText?: string;

  @IsEnum(QuestionType)
  @IsOptional()
  type?: QuestionType;

  @IsEnum(QuestionDifficulty)
  @IsOptional()
  difficulty?: QuestionDifficulty;

  @IsEnum(QuestionCategory)
  @IsOptional()
  category?: QuestionCategory;

  @IsNumber()
  @IsOptional()
  @Min(0)
  points?: number;

  @IsString()
  @IsOptional()
  explanation?: string;

  @IsString()
  @IsOptional()
  reference?: string;

  @IsUrl()
  @IsOptional()
  imageUrl?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @IsUUID()
  @IsOptional()
  courseId?: string;

  @IsUUID()
  @IsOptional()
  unitId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @ArrayMinSize(1)
  @IsOptional()
  @Type(() => QuestionOptionDto)
  options?: QuestionOptionDto[];
}

export class QuestionUsageStatsDto {
  @ApiProperty({ description: 'Question ID' })
  id!: string;

  @ApiProperty({
    description: 'Number of times the question was answered correctly',
  })
  correctAnswers!: number;

  @ApiProperty({
    description: 'Number of times the question was answered incorrectly',
  })
  incorrectAnswers!: number;

  @ApiProperty({
    description: 'Total number of times the question was attempted',
  })
  totalAttempts!: number;

  @ApiProperty({ description: 'Last time the question was attempted' })
  lastAttemptedAt!: Date;
}

export class QuestionBankStatsResponseDto {
  @ApiProperty({ description: 'Total number of questions' })
  totalQuestions!: number;

  @ApiProperty({ description: 'Number of questions answered correctly' })
  correctAnswers!: number;

  @ApiProperty({ description: 'Number of questions answered incorrectly' })
  incorrectAnswers!: number;

  @ApiProperty({ description: 'Total number of attempts' })
  totalAttempts!: number;

  @ApiProperty({ description: 'Last time a question was attempted' })
  lastAttemptedAt!: Date;
}

export class QuestionBankUsageResponseDto {
  @ApiProperty({ description: 'Total number of questions' })
  totalQuestions!: number;

  @ApiProperty({ description: 'Number of questions answered correctly' })
  correctAnswers!: number;

  @ApiProperty({ description: 'Number of questions answered incorrectly' })
  incorrectAnswers!: number;

  @ApiProperty({ description: 'Total number of attempts' })
  totalAttempts!: number;

  @ApiProperty({ description: 'Last time a question was attempted' })
  lastAttemptedAt!: Date;
}

export class QuestionBankPaginationDto {
  @ApiProperty({ description: 'Current page number' })
  currentPage!: number;

  @ApiProperty({ description: 'Number of items per page' })
  itemsPerPage!: number;

  @ApiProperty({ description: 'Total number of items' })
  totalItems!: number;

  @ApiProperty({ description: 'Total number of pages' })
  totalPages!: number;
}

export class PaginatedQuestionBankResponseDto {
  @ApiProperty({ description: 'Pagination information' })
  pagination!: QuestionBankPaginationDto;

  @ApiProperty({ description: 'List of questions' })
  questions!: CreateQuestionBankDto[];
}

export class BulkQuestionUploadResponseDto {
  @ApiProperty({ description: 'List of successfully uploaded questions' })
  uploadedQuestions!: CreateQuestionBankDto[];

  @ApiProperty({ description: 'List of failed uploads with error messages' })
  failedUploads!: { question: CreateQuestionBankDto; error: string }[];
}

export class QuestionBankImportDto {
  @ApiProperty({ description: 'List of questions to import' })
  questions!: CreateQuestionBankDto[];
}

export class QuestionBankExportDto {
  @ApiProperty({ description: 'List of questions to export' })
  questions!: CreateQuestionBankDto[];
}

export class QuestionBankImportResponseDto {
  @ApiProperty({ description: 'List of successfully imported questions' })
  importedQuestions!: CreateQuestionBankDto[];

  @ApiProperty({ description: 'List of failed imports with error messages' })
  failedImports!: { question: CreateQuestionBankDto; error: string }[];
}

export interface QuestionBankFilters {
  search?: string;
  type?: QuestionType;
  difficulty?: QuestionDifficulty;
  category?: QuestionCategory;
  courseId?: string;
  unitId?: string;
  tags?: string[];
  createdBy?: string;
  isActive?: boolean;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
  excludeQuestionIds?: string[];
}

export interface PaginatedQuestions {
  questions: Question[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}
