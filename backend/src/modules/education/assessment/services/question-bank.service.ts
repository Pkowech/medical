import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';
import { RedisService } from '../../../../infrastructure/redis/redis.service';
import { AssessmentConfigService } from '../../../../config/assessment.config';
import { AssessmentAnalyticsService } from '#modules/ai-analytics/services/assessment-analytics.service';
import { QuizUtils } from '../../../../common/utils/quiz.utils';
import {
  AdaptiveQuizConfig,
  QuestionBankFilters,
  PaginatedQuestions,
} from '../../../../common/dto';
import { Prisma, Question, QuestionType } from '@prisma/client';
import {
  QuestionNotFoundException,
  InvalidQuestionTypeException,
} from '../../../../common/exceptions';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CreateQuestionBankDto } from '../../../../common/dto/question-bank.dto';

@Injectable()
@ApiTags('questions')
export class QuestionBankService {
  private readonly logger = new Logger(QuestionBankService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly config: AssessmentConfigService,
    private readonly analyticsService: AssessmentAnalyticsService,
  ) {}

  private getCacheKey(filters: QuestionBankFilters): string {
    return `questions:${JSON.stringify(filters)}`;
  }

  @ApiOperation({ summary: 'Create a new question' })
  // Prisma model types are type-only; use runtime-safe Object for Swagger decorators
  @ApiResponse({
    status: 201,
    description: 'Question created successfully',
    type: Object,
  })
  async createQuestion(
    dto: CreateQuestionBankDto,
    createdBy: string,
  ): Promise<Question> {
    await this.validateCourseAndUnit(dto.courseId, dto.unitId);
    this.validateQuestionOptions(dto.type, dto.options);

    const cacheKey = `question:${dto.questionText}:${createdBy}`;
    const cachedQuestion = await this.redisService.get(cacheKey);
    if (cachedQuestion) {
      return JSON.parse(cachedQuestion);
    }

    const question = await this.prisma.$transaction(async (tx) => {
      const question = await tx.question.create({
        data: {
          text: dto.questionText,
          type: dto.type,
          difficulty: dto.difficulty,
          category: dto.category,
          explanation: dto.explanation,
          isActive: true,
          courseId: dto.courseId,
          unitId: dto.unitId,
          difficultyIndex: QuizUtils.getDifficultyIndex(dto.difficulty),
          usageCount: 0,
          averageScore: 0,
          createdBy,
        },
      });

      if (dto.options?.length) {
        await tx.option.createMany({
          data: dto.options.map((opt, index) => ({
            questionId: question.id,
            text: (opt as any).text || (opt as any).optionText,
            isCorrect: (opt as any).isCorrect,
            order: index,
          })),
        });
      }

      return tx.question.findUnique({
        where: { id: question.id },
        include: { options: true },
      });
    });

    if (!question) {
      // Shouldn't happen since we just created it, but guard for compiler strictness
      throw new Error('Question creation failed');
    }

    await this.redisService.set(
      cacheKey,
      JSON.stringify(question),
      24 * 60 * 60,
    );
    return question as Question;
  }

  @ApiOperation({ summary: 'Find questions based on filters' })
  @ApiResponse({
    status: 200,
    description: 'Returns questions matching the filters',
  })
  async findQuestions(
    filters: QuestionBankFilters = {},
  ): Promise<PaginatedQuestions> {
    const cacheKey = this.getCacheKey(filters);
    const cachedResult = await this.redisService.get(cacheKey);
    if (cachedResult) {
      return JSON.parse(cachedResult) as PaginatedQuestions;
    }

    const {
      search,
      type,
      difficulty,
      category,
      courseId,
      unitId,
      tags,
      createdBy,
      isActive = true,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
    } = filters;

    const where: Prisma.QuestionWhereInput = { isActive };
    if (search) {
      where.OR = [
        { text: { contains: search, mode: 'insensitive' } },
        { tags: { has: search } },
      ];
    }
    if (type) {
      where.type = type;
    }
    if (difficulty) {
      where.difficulty = difficulty;
    }
    if (category) {
      where.category = category;
    }
    if (courseId) {
      where.courseId = courseId;
    }
    if (unitId) {
      where.unitId = unitId;
    }
    if (tags && tags.length > 0) {
      where.tags = { hasSome: tags };
    }
    if (createdBy) {
      where.createdBy = createdBy;
    }
    if (filters.excludeQuestionIds) {
      where.id = { notIn: filters.excludeQuestionIds };
    }

    const [questions, total] = await Promise.all([
      this.prisma.question.findMany({
        where,
        include: { options: true },
        orderBy: { [sortBy]: sortOrder.toLowerCase() },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.question.count({ where }),
    ]);

    const result = {
      questions,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };

    await this.redisService.set(
      cacheKey,
      JSON.stringify(result),
      this.config.questionCacheTTL,
    );
    return result;
  }

  @ApiOperation({ summary: 'Generate questions for an adaptive quiz' })
  @ApiResponse({
    status: 200,
    description: 'List of questions for adaptive quiz',
    type: Object,
  })
  async generateAdaptiveQuiz(
    userId: string,
    config: AdaptiveQuizConfig,
  ): Promise<Question[]> {
    const cacheKey = `adaptive_quiz_questions:${userId}:${JSON.stringify(config)}`;
    const cachedQuestions = await this.redisService.get(cacheKey);
    if (cachedQuestions) {
      return JSON.parse(cachedQuestions);
    }

    const {
      targetDifficulty,
      questionCount,
      categories,
      excludeRecent = true,
      recentDays = 7,
      adaptiveAlgorithm = 'irt',
    } = config;

    const where: any = { isActive: true };
    if (targetDifficulty) {
      where.difficulty = targetDifficulty;
    }
    if (categories && categories.length > 0) {
      where.category = { in: categories };
    }
    if (excludeRecent) {
      const recentDate = new Date(
        Date.now() - recentDays * 24 * 60 * 60 * 1000,
      );
      where.NOT = {
        userResponses: {
          some: { userId, createdAt: { gt: recentDate } },
        },
      };
    }

    let orderBy: any = [{ id: 'asc' }];
    if (adaptiveAlgorithm === 'irt') {
      orderBy = [{ difficultyIndex: 'asc' }, { id: 'asc' }];
    } else if (adaptiveAlgorithm === 'weighted') {
      orderBy = [{ difficultyIndex: 'asc' }, { id: 'asc' }];
    }

    const questions = await this.prisma.question.findMany({
      where,
      take: questionCount,
      orderBy,
      include: { options: true },
    });

    await this.redisService.set(
      cacheKey,
      JSON.stringify(questions),
      1 * 60 * 60,
    );
    return questions;
  }

  async updateQuestionStatistics(
    questionId: string,
    isCorrect: boolean,
    responseTime: number,
  ): Promise<void> {
    const question = await this.prisma.question.findUnique({
      where: { id: questionId },
    });
    if (!question) {
      throw new QuestionNotFoundException(questionId);
    }

    const currentScore = isCorrect ? 1 : 0;
    const newUsageCount = question.usageCount + 1;
    const avgScore = question.averageScore ?? 0;
    const newAverageScore =
      (avgScore * question.usageCount + currentScore) / newUsageCount;

    // Local DB update for immediate consistency
    await this.prisma.question.update({
      where: { id: questionId },
      data: {
        usageCount: newUsageCount,
        averageScore: newAverageScore,
        difficultyIndex: 1 - newAverageScore,
      },
    });

    // Fire-and-forget gRPC call to Rust for async analytics
    void this.analyticsService.updateQuestionStats(
      questionId,
      isCorrect,
      responseTime,
    );

    await this.redisService.del(`question:${questionId}:*`);
  }

  private async validateCourseAndUnit(courseId?: string, unitId?: string) {
    if (courseId) {
      const course = await this.prisma.course.findUnique({
        where: { id: courseId },
      });
      if (!course) {
        throw new NotFoundException('Course not found');
      }
    }
    if (unitId) {
      const unit = await this.prisma.unit.findUnique({ where: { id: unitId } });
      if (!unit) {
        throw new NotFoundException('Unit not found');
      }
    }
  }

  private validateQuestionOptions(type: QuestionType, options: any[]): void {
    if (!options || options.length === 0) {
      throw new InvalidQuestionTypeException(
        'Question must have at least one option',
      );
    }

    const correctOptions = options.filter((opt) => opt.isCorrect);
    switch (type) {
      case QuestionType.multiple_choice:
        if (correctOptions.length !== 1) {
          throw new InvalidQuestionTypeException(
            'Multiple choice questions must have exactly one correct answer',
          );
        }
        if (options.length < 2) {
          throw new InvalidQuestionTypeException(
            'Multiple choice questions must have at least two options',
          );
        }
        break;
      case QuestionType.multiple_select:
        if (correctOptions.length < 1) {
          throw new InvalidQuestionTypeException(
            'Multiple select questions must have at least one correct answer',
          );
        }
        break;
      case QuestionType.true_false:
        if (options.length !== 2) {
          throw new InvalidQuestionTypeException(
            'True/False questions must have exactly two options',
          );
        }
        if (correctOptions.length !== 1) {
          throw new InvalidQuestionTypeException(
            'True/False questions must have exactly one correct answer',
          );
        }
        break;
    }
  }
}
