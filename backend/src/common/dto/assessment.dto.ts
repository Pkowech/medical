import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsObject,
  IsString,
  IsUUID,
  IsDateString,
  Min,
  Max,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  RiskLevel,
  QuestionCategory,
  QuestionDifficulty,
  Question,
  Prisma,
} from '@prisma/client';

export class CreateQuizDto {
  @ApiProperty({ description: 'Quiz title' })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiPropertyOptional({ description: 'Quiz description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Detailed instructions for the quiz' })
  @IsOptional()
  @IsString()
  instructions?: string;

  @ApiPropertyOptional({ description: 'Time limit in minutes' })
  @IsOptional()
  @IsNumber()
  timeLimit?: number;

  @ApiPropertyOptional({ description: 'Maximum attempts allowed' })
  @IsOptional()
  @IsNumber()
  maxAttempts?: number;

  @ApiPropertyOptional({ description: 'Passing score percentage (0-100)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  passingScore?: number;

  @ApiPropertyOptional({ description: 'Whether the quiz is published' })
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  @ApiPropertyOptional({ description: 'When the quiz was published' })
  @IsOptional()
  @IsDateString()
  publishedAt?: Date;

  @ApiPropertyOptional({ description: 'When the quiz expires' })
  @IsOptional()
  @IsDateString()
  expiresAt?: Date;

  @ApiPropertyOptional({ description: 'Availability start date' })
  @IsOptional()
  @IsDateString()
  availableFrom?: Date;

  @ApiPropertyOptional({ description: 'Availability end date' })
  @IsOptional()
  @IsDateString()
  availableUntil?: Date;

  @ApiPropertyOptional({ description: 'Shuffle questions for each attempt' })
  @IsOptional()
  @IsBoolean()
  shuffleQuestions?: boolean;

  @ApiPropertyOptional({
    description: 'Whether to show results after submission',
  })
  @IsOptional()
  @IsBoolean()
  showResults?: boolean;

  @ApiPropertyOptional({ description: 'Adaptive quiz flag' })
  @IsOptional()
  @IsBoolean()
  isAdaptive?: boolean;

  @ApiPropertyOptional({ description: 'Adaptive configuration JSON' })
  @IsOptional()
  @IsObject()
  adaptiveConfig?: Prisma.JsonValue;

  @ApiPropertyOptional({ description: 'Category id' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ description: 'Unit id' })
  @IsOptional()
  @IsUUID()
  unitId?: string;

  @ApiPropertyOptional({ description: 'Topic id' })
  @IsOptional()
  @IsUUID()
  topicId?: string;

  @ApiPropertyOptional({
    description: 'List of question ids to include in the quiz',
  })
  @IsOptional()
  @IsArray()
  questions?: string[];
}

export class UpdateQuizDto {
  @ApiPropertyOptional({ description: 'Quiz title' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ description: 'Quiz description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Detailed instructions for the quiz' })
  @IsOptional()
  @IsString()
  instructions?: string;

  @ApiPropertyOptional({ description: 'Time limit in minutes' })
  @IsOptional()
  @IsNumber()
  timeLimit?: number;

  @ApiPropertyOptional({ description: 'Maximum attempts allowed' })
  @IsOptional()
  @IsNumber()
  maxAttempts?: number;

  @ApiPropertyOptional({ description: 'Passing score percentage (0-100)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  passingScore?: number;

  @ApiPropertyOptional({ description: 'Whether the quiz is published' })
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  @ApiPropertyOptional({ description: 'When the quiz expires' })
  @IsOptional()
  @IsDateString()
  expiresAt?: Date;

  @ApiPropertyOptional({ description: 'Availability start date' })
  @IsOptional()
  @IsDateString()
  availableFrom?: Date;

  @ApiPropertyOptional({ description: 'Availability end date' })
  @IsOptional()
  @IsDateString()
  availableUntil?: Date;

  @ApiPropertyOptional({ description: 'Shuffle questions for each attempt' })
  @IsOptional()
  @IsBoolean()
  shuffleQuestions?: boolean;

  @ApiPropertyOptional({
    description: 'Whether to show results after submission',
  })
  @IsOptional()
  @IsBoolean()
  showResults?: boolean;

  @ApiPropertyOptional({ description: 'Adaptive configuration JSON' })
  @IsOptional()
  @IsObject()
  adaptiveConfig?: Prisma.JsonValue;

  @ApiPropertyOptional({
    description: 'List of question ids to include in the quiz',
  })
  @IsOptional()
  @IsArray()
  questions?: string[];
}

export class PredictionFactors {
  @ApiProperty()
  historicalPerformance!: number;

  @ApiProperty()
  timeSinceLastAttempt!: number;

  @ApiProperty()
  questionDifficulty!: number;
}

export class QuizInfo {
  @ApiProperty()
  title!: string;
}

export class CreateAssessmentDto {
  @ApiProperty({ description: 'Assessment title' })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiPropertyOptional({ description: 'Assessment description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Course ID' })
  @IsOptional()
  @IsUUID()
  courseId?: string;

  @ApiPropertyOptional({ description: 'Unit ID' })
  @IsOptional()
  @IsUUID()
  unitId?: string;

  @ApiProperty({ description: 'Total number of questions' })
  @IsNumber()
  @Min(1)
  totalQuestions!: number;

  @ApiPropertyOptional({ description: 'Maximum number of attempts allowed' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  maxAttempts?: number;

  @ApiPropertyOptional({ description: 'Passing score percentage' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  passingScore?: number;

  @ApiPropertyOptional({ description: 'Assessment availability start date' })
  @IsOptional()
  @IsDateString()
  availableFrom?: Date;

  @ApiPropertyOptional({ description: 'Assessment availability end date' })
  @IsOptional()
  @IsDateString()
  availableUntil?: Date;
}

export class StartAssessmentDto {
  @ApiProperty()
  @IsString()
  assessmentId!: string;

  @ApiProperty()
  @IsString()
  userId!: string;
}

export type AnswerData = string | string[] | Record<string, string>;

export class SubmitAnswerDto {
  @ApiProperty()
  @IsString()
  assessmentId!: string;

  @ApiProperty()
  @IsString()
  userId!: string;

  @ApiProperty()
  @IsString()
  questionId!: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  selectedOptionIds!: string[];

  @ApiProperty({
    required: false,
    oneOf: [
      { type: 'string' },
      { type: 'array', items: { type: 'string' } },
      { type: 'object', additionalProperties: { type: 'string' } },
    ],
  })
  @IsOptional()
  @IsObject()
  answerData?: AnswerData;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  timeSpentSeconds?: number;
}

export class QuizAnswerDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  questionId!: string;

  @ApiProperty()
  @IsNotEmpty()
  selectedOption!: any;
}

export class SubmitQuizDto {
  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  unitId!: string;

  @ApiProperty({ type: () => [QuizAnswerDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuizAnswerDto)
  answers!: QuizAnswerDto[];
}

/**
 * -------------------
 * Prediction DTO
 * -------------------
 */
export class AssessmentPredictionDto {
  @ApiProperty()
  @IsString()
  userId!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  assessmentId?: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  @Max(100)
  predictedScore!: number;

  @ApiProperty({ type: [Number] })
  @IsArray()
  @IsNumber({}, { each: true })
  confidenceInterval!: [number, number];

  @ApiProperty({ enum: RiskLevel })
  @IsEnum(RiskLevel)
  riskLevel!: RiskLevel;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  @Max(1)
  successProbability!: number;

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  suggestedPreparation!: string[];

  @ApiProperty({ type: () => PredictionFactors })
  @ValidateNested()
  @Type(() => PredictionFactors)
  factors!: PredictionFactors;
}

/**
 * -------------------
 * Recommendation DTOs
 * -------------------
 */
export class ResourceDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  type!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty({ required: false })
  url?: string;

  @ApiProperty()
  priority!: number;
}

export class PracticeSuggestionDto {
  @ApiProperty({ enum: QuestionCategory })
  category!: QuestionCategory;

  @ApiProperty()
  count!: number;

  @ApiProperty({ enum: QuestionDifficulty })
  difficulty!: QuestionDifficulty;
}

export class AssessmentRecommendationDto {
  @ApiProperty()
  userId!: string;

  @ApiProperty({ required: false })
  assessmentId?: string;

  @ApiProperty({ type: [String] })
  recommendedActions!: string[];

  @ApiProperty({ type: [String] })
  priorityTopics!: string[];

  @ApiProperty()
  estimatedStudyTime!: number;

  @ApiProperty({ type: () => ResourceDto, isArray: true })
  @ValidateNested({ each: true })
  @Type(() => ResourceDto)
  resources!: ResourceDto[];

  @ApiProperty({ type: [String], required: false })
  nextSteps?: string[];

  // Compatibility fields required by some services
  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  timePerQuestion?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  totalAttempts?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsObject()
  topicScores?: Record<string, number>;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  overallAbility?: number;
}

/**
 * -------------------
 * Analytics DTOs (Fixed)
 * -------------------
 */

export class CategoryAnalyticsDto {
  @ApiProperty()
  category!: string;

  @ApiProperty()
  averageScore!: number;

  @ApiProperty()
  attempts!: number;

  @ApiProperty({ type: [String] })
  strengths!: string[];

  @ApiProperty({ type: [String] })
  weaknesses!: string[];

  @ApiProperty()
  averageTimeSpent!: number;

  @ApiProperty({ type: Number })
  recentAttempts!: number;

  @ApiProperty()
  trendDirection!: 'improving' | 'declining' | 'stable';

  @ApiProperty()
  confidenceLevel!: number;

  // Optional extras for service compatibility
  @ApiProperty({ required: false })
  correct?: number;
  @ApiProperty({ required: false })
  total?: number;
  @ApiProperty({ required: false })
  percentage?: number;
  @ApiProperty({ required: false })
  score?: number;
  @ApiProperty({ required: false })
  totalQuestions?: number;

  @ApiProperty({ required: false })
  correctAnswers?: number;
}

// -------------------
// Core Entities
// -------------------
export class AssessmentHistoryDto {
  @ApiProperty({ required: false })
  id?: string;

  @ApiProperty({ required: false })
  userId?: string;

  @ApiProperty({ required: false })
  assessmentId?: string;

  @ApiProperty()
  quizId!: string;

  @ApiProperty()
  score!: number;

  @ApiProperty()
  completedAt!: Date;

  @ApiProperty({ required: false })
  date?: Date;

  @ApiProperty({ required: false })
  totalMarks?: number;

  @ApiProperty({ required: false })
  status?: string;

  @ApiProperty({ required: false })
  timeSpent?: number;

  @ApiProperty({ required: false, type: () => QuizInfo })
  @Type(() => QuizInfo)
  quiz?: QuizInfo;
}

export class RecentPerformanceDto {
  @ApiProperty({ description: 'Number of correct answers' })
  correct!: number;

  @ApiProperty({ description: 'Total number of questions' })
  total!: number;

  @ApiProperty({ description: 'Average time per answer' })
  averageTime!: number;
}

export class UserPerformanceProfileDto {
  @ApiProperty()
  userId!: string;

  @ApiProperty({ required: false })
  email?: string;

  @ApiProperty({
    description: 'Recent performance metrics',
    type: () => RecentPerformanceDto,
  })
  recentPerformance!: RecentPerformanceDto;

  @ApiProperty({ type: [String], enum: QuestionCategory })
  knowledgeGaps!: QuestionCategory[];

  @ApiProperty()
  totalCourses!: number;

  @ApiProperty()
  completedCourses!: number;

  @ApiProperty()
  totalLearningPaths!: number;

  @ApiProperty()
  completedLearningPaths!: number;

  @ApiProperty({ type: Object, description: 'Record of category abilities' })
  categoryAbilities!: Record<string, number>;

  @ApiProperty()
  overallAbility!: number;

  @ApiProperty()
  overallScore!: number;

  @ApiProperty({ required: false })
  performanceMetrics?: Record<string, unknown>;

  @ApiProperty({ type: [String] })
  strengths!: string[];

  @ApiProperty({ type: [String] })
  weaknesses!: string[];

  @ApiProperty({
    type: Object,
    required: false,
    description: 'BKT skill probabilities by skill ID',
  })
  skill_prob_by_skill?: Record<string, number>;
}

// -------------------
// Core Entities - Standardized on DTO classes above.
// -------------------

export class DetailedFeedbackDto {
  @ApiProperty()
  questionId!: string;

  @ApiProperty()
  isCorrect!: boolean;

  @ApiProperty()
  userAnswer!: any;

  @ApiProperty({ type: [Object] })
  correctAnswer!: any[];

  @ApiProperty()
  explanation!: string;

  @ApiProperty({ type: [String] })
  conceptsToReview!: string[];

  @ApiProperty({ type: [Object] })
  relatedResources!: any[];

  @ApiProperty()
  difficultyAnalysis!: any;

  @ApiProperty()
  timeAnalysis!: any;
}
export type DetailedFeedback = DetailedFeedbackDto;

export class AdaptiveQuizSessionDto {
  @ApiProperty()
  sessionId!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty({ type: [Object] })
  questions!: Question[];

  @ApiProperty()
  currentQuestionIndex!: number;

  @ApiProperty()
  userAbility!: number;

  @ApiProperty()
  confidenceInterval!: number;

  @ApiProperty()
  targetPrecision!: number;

  @ApiProperty({ type: [Object] })
  responses!: Array<{
    questionId: string;
    isCorrect: boolean;
    responseTime: number;
    confidence: number;
  }>;

  @ApiProperty()
  isComplete!: boolean;

  @ApiProperty()
  finalScore!: number;

  @ApiProperty({ type: [String] })
  recommendations!: string[];
}
export type AdaptiveQuizSession = AdaptiveQuizSessionDto;

export class AdaptiveQuizConfigDto {
  @ApiProperty()
  initialDifficulty!: number;

  @ApiProperty()
  minQuestions!: number;

  @ApiProperty()
  maxQuestions!: number;

  @ApiProperty()
  targetPrecision!: number;

  @ApiProperty()
  adaptivityRate!: number;

  @ApiPropertyOptional()
  timeLimit?: number;

  @ApiPropertyOptional()
  targetDifficulty?: number;

  @ApiPropertyOptional()
  questionCount?: number;

  @ApiPropertyOptional({ type: [String] })
  categories?: string[];

  @ApiPropertyOptional()
  excludeRecent?: boolean;

  @ApiPropertyOptional()
  recentDays?: number;

  @ApiPropertyOptional()
  adaptiveAlgorithm?: 'irt' | 'other' | 'weighted';
}
export type AdaptiveQuizConfig = AdaptiveQuizConfigDto;

export class QuizSessionStateDto {
  @ApiProperty()
  currentQuestionId!: string;

  @ApiProperty({ type: [String] })
  answeredQuestions!: string[];

  @ApiProperty()
  abilityEstimate!: number;

  @ApiProperty()
  startTime!: Date;

  @ApiPropertyOptional()
  timeRemaining?: number;

  @ApiProperty()
  score!: number;

  @ApiProperty()
  isComplete!: boolean;
}
export type QuizSessionState = QuizSessionStateDto;

export class QuestionResponseDto {
  @ApiProperty()
  questionId!: string;

  @ApiProperty()
  userAnswer!: any;

  @ApiProperty()
  isCorrect!: boolean;

  @ApiProperty()
  timeSpent!: number;

  @ApiProperty()
  difficulty!: number;

  @ApiProperty()
  discrimination!: number;
}
export type QuestionResponse = QuestionResponseDto;

// -------------------
// Assessment Progress DTO
// -------------------

export class AssessmentProgressDto {
  @ApiProperty()
  userId!: string;

  @ApiProperty()
  assessmentId!: string;

  @ApiProperty({ required: false })
  unitId?: string;

  @ApiProperty()
  completionPercentage!: number;

  @ApiProperty({ required: false })
  lastAttemptedAt?: Date;

  @ApiProperty()
  totalAttempts!: number;

  @ApiProperty({ required: false })
  bestScore?: number;

  @ApiProperty()
  isPassed!: boolean;
}
