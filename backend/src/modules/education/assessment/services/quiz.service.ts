import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '#infrastructure/prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { RedisService } from '#infrastructure/redis/redis.service';
import { AssessmentProgressService } from './assessment-progress.service';
import { AssessmentAnalyticsService } from '#modules/ai-analytics/services/assessment-analytics.service';
import { MasteryGateService } from '../../courses/services/mastery-gate.service';
import { Option, Question, Quiz, QuizAttempt, UserActivityType } from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { QuizUtils } from '#common/utils/quiz.utils';
import { QuizAnswerDto, CreateQuizDto } from '#common/dto/assessment.dto';
import {
  ImportQuizDto,
  QuestionBankFilters,
} from '#common/dto/question-bank.dto';
import { QuestionBankService } from './question-bank.service';
import { FlashcardsService } from './flashcards.service';
import {
  AssessmentRecommendationService,
  QuizPerformanceRecommendations,
} from './assessment-recommendation.service';

import { GlobalSearchSyncService } from '../../../../infrastructure/search/services/global-search-sync.service';
import { MaxAttemptsExceededException } from '#common/exceptions/quiz.exception';

type PublicQuizQuestion = Omit<
  Question,
  'options' | 'explanation' | 'choices' | 'metadata'
> & {
  options: Array<Pick<Option, 'id' | 'text' | 'order'>>;
};

@Injectable()
@ApiTags('quizzes')
export class QuizService {
  private readonly logger = new Logger(QuizService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly progressService: AssessmentProgressService,
    private readonly analyticsService: AssessmentAnalyticsService,
    private readonly masteryGateService: MasteryGateService,
    private readonly questionBankService: QuestionBankService,
    private readonly searchSync: GlobalSearchSyncService,
    private readonly eventEmitter: EventEmitter2,
    private readonly flashcardsService: FlashcardsService,
    private readonly recommendationService: AssessmentRecommendationService,
  ) {}

  async importQuiz(data: ImportQuizDto, creatorId: string): Promise<Quiz> {
    let { courseId, unitId, topicId } = data;
    if (unitId) {
      const unit = await this.prisma.unit.findUnique({
        where: { id: unitId },
        select: { id: true, courseId: true },
      });
      if (!unit) throw new NotFoundException(`Unit ${unitId} not found`);
      if (courseId && courseId !== unit.courseId) {
        throw new BadRequestException('The selected unit does not belong to the course');
      }
      courseId = unit.courseId;
    }

    if (topicId) {
      const topic = await this.prisma.topic.findUnique({
        where: { id: topicId },
        select: { id: true, unitId: true, unit: { select: { courseId: true } } },
      });
      if (!topic) throw new NotFoundException(`Topic ${topicId} not found`);
      if (unitId && unitId !== topic.unitId) {
        throw new BadRequestException('The selected topic does not belong to the unit');
      }
      unitId = topic.unitId;
      courseId = topic.unit.courseId;
    }

    const preparedQuestions = data.questions.map((question) => {
      this.questionBankService.validateQuestionOptions(
        question.type,
        question.options,
      );
      return {
        ...question,
        courseId: question.courseId ?? courseId,
        unitId: question.unitId ?? unitId,
        topicIds:
          question.topicIds?.length
            ? question.topicIds
            : data.topicId
              ? [data.topicId]
              : [],
      };
    });
    for (const question of preparedQuestions) {
      await this.questionBankService.validateCourseAndUnit(
        question.courseId,
        question.unitId,
      );
    }

    const topicIds = [...new Set(preparedQuestions.flatMap((q) => q.topicIds))];
    if (topicIds.length > 0) {
      const topics = await this.prisma.topic.findMany({
        where: { id: { in: topicIds } },
        select: { id: true, unitId: true, unit: { select: { courseId: true } } },
      });
      if (topics.length !== topicIds.length) {
        throw new BadRequestException('One or more question topic IDs do not exist');
      }
      const topicsById = new Map(topics.map((topic) => [topic.id, topic]));
      for (const question of preparedQuestions) {
        for (const topicId of question.topicIds) {
          const topic = topicsById.get(topicId)!;
          if (question.unitId && topic.unitId !== question.unitId) {
            throw new BadRequestException(
              `Topic ${topicId} does not belong to question unit ${question.unitId}`,
            );
          }
          if (question.courseId && topic.unit.courseId !== question.courseId) {
            throw new BadRequestException(
              `Topic ${topicId} does not belong to question course ${question.courseId}`,
            );
          }
        }
      }
    }

    const quiz = await this.prisma.$transaction(async (tx) => {
      const questionRecords: Array<{ questionId: string; order: number }> = [];
      for (const [index, question] of preparedQuestions.entries()) {
        const createdQuestion = await tx.question.create({
          data: {
            text: question.questionText,
            type: question.type,
            difficulty: question.difficulty,
            category: question.category,
            explanation: question.explanation,
            conceptsCovered: question.conceptsCovered ?? [],
            tags: question.tags ?? [],
            topicIds: question.topicIds,
            points: question.points ?? 1,
            courseId: question.courseId,
            unitId: question.unitId,
            difficultyIndex: QuizUtils.getDifficultyIndex(question.difficulty),
            createdBy: creatorId,
            isActive: true,
            options: {
              create: question.options.map((option, optionOrder) => ({
                text: option.text,
                isCorrect: option.isCorrect ?? false,
                order: optionOrder,
              })),
            },
          },
          select: { id: true },
        });
        questionRecords.push({ questionId: createdQuestion.id, order: index + 1 });
      }

      const createdQuiz = await tx.quiz.create({
        data: {
          title: data.title,
          description: data.description,
          unitId,
          topicId,
          passingScore: data.passingScore ?? 70,
          isPublished: data.isPublished ?? false,
          publishedAt: data.isPublished ? new Date() : null,
          createdBy: creatorId,
          questionCount: questionRecords.length,
          questions: { create: questionRecords },
        },
      });
      return createdQuiz;
    });

    await this.invalidateAssessmentCaches(
      [
        ...new Set(preparedQuestions.map((question) => question.unitId).filter(
          (id): id is string => Boolean(id),
        )),
        ...(unitId ? [unitId] : []),
      ],
      [
        ...new Set(preparedQuestions.flatMap((question) => question.topicIds)),
        ...(topicId ? [topicId] : []),
      ],
    );
    await this.searchSync.syncEntity('quiz', quiz.id);
    return quiz;
  }

  private async invalidateAssessmentCaches(
    unitIds: string[] = [],
    topicIds: string[] = [],
  ): Promise<void> {
    await Promise.all([
      this.redisService.delPattern('questions:*'),
      this.redisService.delPattern('quizzes:*'),
      ...unitIds.flatMap((unitId) => [
        this.redisService.del(`unit:${unitId}:questions:v2`),
        this.redisService.del(`unit_quiz:${unitId}`),
      ]),
      ...topicIds.map((topicId) =>
        this.redisService.del(`topic:${topicId}:questions:v2`),
      ),
    ]);
  }

  async getQuestionBank(filters: QuestionBankFilters) {
    return this.questionBankService.findQuestions({
      ...filters,
      page: Math.max(1, Number(filters.page) || 1),
      limit: Math.min(100, Math.max(1, Number(filters.limit) || 20)),
    });
  }

  private toPublicQuizQuestion(
    question: Question & {
      options: Array<Pick<Option, 'id' | 'text' | 'order'>>;
    },
  ): PublicQuizQuestion {
    const {
      options,
      explanation,
      choices,
      metadata,
      ...publicQuestion
    } = question;
    void explanation;
    void choices;
    void metadata;
    return {
      ...publicQuestion,
      options: options.map(({ id, text, order }) => ({ id, text, order })),
    };
  }

  async publishQuiz(quizId: string, creatorId: string): Promise<Quiz> {
    const quiz = await this.prisma.quiz.findUnique({ where: { id: quizId } });
    if (!quiz) throw new NotFoundException(`Quiz ${quizId} not found`);
    if (quiz.createdBy !== creatorId) {
      throw new BadRequestException('Only the quiz creator can publish this quiz');
    }
    if (quiz.questionCount < 1) {
      throw new BadRequestException('A quiz must contain at least one question before publishing');
    }

    const publishedQuiz = await this.prisma.quiz.update({
      where: { id: quizId },
      data: { isPublished: true, publishedAt: quiz.publishedAt ?? new Date() },
    });
    await this.invalidateAssessmentCaches(
      quiz.unitId ? [quiz.unitId] : [],
      quiz.topicId ? [quiz.topicId] : [],
    );
    await this.searchSync.syncEntity('quiz', quizId);
    return publishedQuiz;
  }

  @ApiOperation({ summary: 'Create a new quiz' })
  @ApiResponse({ status: 201, description: 'Quiz created successfully' })
  async create(data: CreateQuizDto, creatorId: string): Promise<Quiz> {
    const cacheKey = `quiz:create:${JSON.stringify(data)}:${creatorId}`;
    const cachedQuiz = await this.redisService.get(cacheKey);
    if (cachedQuiz) {
      try {
        return JSON.parse(cachedQuiz);
      } catch (err) {
        this.logger.warn(`Corrupt cache for quiz creation: ${cacheKey}`);
        await this.redisService.del(cacheKey);
      }
    }

    const quiz = await this.prisma.$transaction(async (tx) => {
      const createdQuiz = await tx.quiz.create({
        data: {
          title: data.title || 'Untitled Quiz',
          description: data.description,
          unitId: data.unitId,
          topicId: data.topicId,
          maxAttempts: data.maxAttempts || 3,
          passingScore: data.passingScore || 70,
          isPublished: data.isPublished || false,
          createdBy: creatorId,
        },
      });

          if (data.questions && data.questions.length > 0) {
        await tx.quizQuestion.createMany({
          data: data.questions.map((qId, index) => ({
            quizId: createdQuiz.id,
            questionId: qId,
            order: index + 1,
          })),
        });
      }

      return tx.quiz.findUnique({
        where: { id: createdQuiz.id },
        include: {
          questions: { include: { question: true } },
          unit: true,
        },
      });
    });

    if (!quiz) {
      throw new BadRequestException('Failed to create quiz');
    }

    await this.redisService.set(cacheKey, JSON.stringify(quiz), 24 * 60 * 60); // 1 day TTL
    this.logger.log(`Created quiz ${quiz.id} by user ${creatorId}`);

    // Sync to global search index
    await this.searchSync.syncEntity('quiz', quiz.id);

    return quiz;
  }

  @ApiOperation({ summary: 'Find quizzes with pagination and filters' })
  @ApiResponse({ status: 200, description: 'List of quizzes with pagination' })
  async findMany(
    pagination: { page?: number; limit?: number },
    filters?: { unitId?: string; topicId?: string; isPublished?: boolean },
  ) {
    const cacheKey = `quizzes:${JSON.stringify({ pagination, filters })}`;
    const cachedResult = await this.redisService.get(cacheKey);
    if (cachedResult) {
      try {
        this.logger.log(
          `Retrieved cached quizzes for filters: ${JSON.stringify(filters)}`,
        );
        return JSON.parse(cachedResult);
      } catch (err) {
        this.logger.warn(`Corrupt cache for quizzes list: ${cacheKey}`);
        await this.redisService.del(cacheKey);
      }
    }

    const { page = 1, limit = 10 } = pagination;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (filters?.unitId) {
      where.unitId = filters.unitId;
    }
    if (filters?.topicId) {
      where.topicId = filters.topicId;
    }
    if (filters?.isPublished !== undefined) {
      where.isPublished = filters.isPublished;
    }

    const [quizzes, total] = await Promise.all([
      this.prisma.quiz.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          title: true,
          maxAttempts: true,
          passingScore: true,
          isPublished: true,
          createdAt: true,
          unit: {
            select: { name: true, course: { select: { name: true } } },
          },
          _count: {
            select: { attempts: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.quiz.count({ where }),
    ]);

    const result = {
      data: quizzes,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };

    await this.redisService.set(cacheKey, JSON.stringify(result), 1 * 60 * 60); // 1 hour TTL
    this.logger.log(
      `Fetched ${quizzes.length} quizzes with filters: ${JSON.stringify(filters)}`,
    );
    return result;
  }

  @ApiOperation({ summary: 'Find a quiz by ID' })
  @ApiResponse({ status: 200, description: 'Quiz details' })
  async findById(id: string): Promise<Quiz> {
    const cacheKey = `quiz:${id}`;
    const cachedQuiz = await this.redisService.get(cacheKey);
    if (cachedQuiz) {
      try {
        this.logger.log(`Retrieved cached quiz ${id}`);
        return JSON.parse(cachedQuiz);
      } catch (err) {
        this.logger.warn(`Corrupt cache for quiz ${id}`);
        await this.redisService.del(cacheKey);
      }
    }

    const quiz = await this.prisma.quiz.findUnique({
      where: { id },
      include: {
        questions: {
          include: { question: true },
          orderBy: { order: 'asc' },
        },
        unit: {
          include: {
            course: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!quiz) {
      this.logger.error(`Quiz ${id} not found`);
      throw new NotFoundException(`Quiz with ID ${id} not found`);
    }

    await this.redisService.set(cacheKey, JSON.stringify(quiz), 1 * 60 * 60); // 1 hour TTL
    this.logger.log(`Fetched quiz ${id}`);
    return quiz;
  }

  @ApiOperation({ summary: 'Update a quiz' })
  @ApiResponse({ status: 200, description: 'Quiz updated successfully' })
  async update(
    id: string,
    data: Partial<CreateQuizDto>,
    creatorId: string,
  ): Promise<Quiz> {
    const existingQuiz = await this.prisma.quiz.findUnique({ where: { id } });
    if (!existingQuiz) {
      this.logger.error(`Quiz ${id} not found`);
      throw new NotFoundException(`Quiz with ID ${id} not found`);
    }

    if ((existingQuiz).createdBy !== creatorId) {
      this.logger.error(
        `User ${creatorId} not authorized to update quiz ${id}`,
      );
      throw new BadRequestException('Only the creator can update this quiz');
    }

    const quiz = await this.prisma.$transaction(async (tx) => {
      if (data.questions) {
        await tx.quizQuestion.deleteMany({ where: { quizId: id } });
        await tx.quizQuestion.createMany({
          data: data.questions.map((qId, index) => ({
            quizId: id,
            questionId: qId,
            order: index + 1,
          })),
        });
      }

      return tx.quiz.update({
        where: { id },
        data: {
          title: data.title,
          description: data.description,
          maxAttempts: data.maxAttempts,
          passingScore: data.passingScore,
          isPublished: data.isPublished ?? (existingQuiz).isPublished,
        },
        include: {
          questions: { include: { question: true } },
          unit: true,
        },
      });
    });

    await this.redisService.del(`quiz:${id}`);
    // Invalidate unit-level generated quiz cache if this quiz belongs to a unit
    if (quiz.unitId) {
      await this.redisService.del(`unit_quiz:${quiz.unitId}`);
    }
    this.logger.log(`Updated quiz ${id} by user ${creatorId}`);

    // Sync to global search index
    await this.searchSync.syncEntity('quiz', quiz.id);

    return quiz;
  }

  @ApiOperation({ summary: 'Delete a quiz' })
  @ApiResponse({ status: 200, description: 'Quiz deleted successfully' })
  async delete(id: string, creatorId: string): Promise<void> {
    const existingQuiz = await this.prisma.quiz.findUnique({ where: { id } });
    if (!existingQuiz) {
      this.logger.error(`Quiz ${id} not found`);
      throw new NotFoundException(`Quiz with ID ${id} not found`);
    }

    if ((existingQuiz).createdBy !== creatorId) {
      this.logger.error(
        `User ${creatorId} not authorized to delete quiz ${id}`,
      );
      throw new BadRequestException('Only the creator can delete this quiz');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.quizQuestion.deleteMany({ where: { quizId: id } });
      await tx.quizAttempt.deleteMany({ where: { quizId: id } });
      await tx.quiz.delete({ where: { id } });
    });

    await this.redisService.del(`quiz:${id}`);
    this.logger.log(`Deleted quiz ${id} by user ${creatorId}`);
  }

  @ApiOperation({ summary: 'Get questions for a unit' })
  @ApiResponse({ status: 200, description: 'Questions retrieved successfully' })
  async getQuestionsByUnit(unitId: string): Promise<PublicQuizQuestion[]> {
    const cacheKey = `unit:${unitId}:questions:v2`;
    const cachedQuestions = await this.redisService.get(cacheKey);
    if (cachedQuestions) {
      try {
        this.logger.debug(`Retrieved cached questions for unit ${unitId}`);
        return JSON.parse(cachedQuestions);
      } catch (err) {
        this.logger.warn(`Corrupt cache for unit ${unitId} questions`);
        await this.redisService.del(cacheKey);
      }
    }

    const optionInclude = {
      options: {
        select: { id: true, text: true, order: true },
        orderBy: { order: 'asc' as const },
      },
    };
    const quiz = await this.prisma.quiz.findFirst({
      where: { unitId, topicId: null, isPublished: true },
      include: {
        questions: {
          orderBy: { order: 'asc' },
          include: { question: { include: optionInclude } },
        },
      },
    });

    const questions: PublicQuizQuestion[] = quiz
      ? quiz.questions.map(({ question }) =>
          this.toPublicQuizQuestion(question),
        )
      : await this.prisma.question.findMany({
          where: { unitId, isActive: true },
          orderBy: { createdAt: 'desc' },
          include: optionInclude,
        }).then((items) => items.map((question) => this.toPublicQuizQuestion(question)));

    // Return an empty array when no questions exist for the unit instead of throwing
    // This allows callers (and tests) to handle empty quizzes gracefully.
    await this.redisService.set(cacheKey, JSON.stringify(questions), 3600);
    return questions;
  }

  async getQuestionsByAssessmentId(
    assessmentId: string,
    userId: string,
  ): Promise<PublicQuizQuestion[]> {
    const quiz = await this.prisma.quiz.findFirst({
      where: {
        id: assessmentId,
        OR: [
          { isPublished: true },
          { autoGeneratedQuizzes: { some: { userId } } },
        ],
      },
      include: {
        questions: {
          orderBy: { order: 'asc' },
          include: {
            question: {
              include: {
                options: {
                  select: { id: true, text: true, order: true },
                  orderBy: { order: 'asc' },
                },
              },
            },
          },
        },
      },
    });

    if (!quiz) {
      throw new NotFoundException(
        `Published assessment ${assessmentId} not found`,
      );
    }

    return quiz.questions.map(({ question }) =>
      this.toPublicQuizQuestion(question),
    );
  }

  @ApiOperation({ summary: 'Get questions for a topic' })
  @ApiResponse({ status: 200, description: 'Topic questions retrieved successfully' })
  async getQuestionsByTopic(topicId: string): Promise<PublicQuizQuestion[]> {
    const cacheKey = `topic:${topicId}:questions:v2`;
    const cachedQuestions = await this.redisService.get(cacheKey);
    if (cachedQuestions) {
      try {
        this.logger.debug(`Retrieved cached questions for topic ${topicId}`);
        return JSON.parse(cachedQuestions);
      } catch (err) {
        this.logger.warn(`Corrupt cache for topic ${topicId} questions`);
        await this.redisService.del(cacheKey);
      }
    }

    const questions = await this.prisma.question.findMany({
      where: {
        isActive: true,
        topicIds: {
          has: topicId,
        },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        options: {
          select: { id: true, text: true, order: true },
          orderBy: { order: 'asc' },
        },
      },
    });

    const publicQuestions = questions.map((question) =>
      this.toPublicQuizQuestion(question),
    );
    await this.redisService.set(cacheKey, JSON.stringify(publicQuestions), 3600);
    return publicQuestions;
  }

  @ApiOperation({ summary: 'Get rapid review questions for a user' })
  @ApiResponse({ status: 200, description: 'Rapid review questions' })
  async getRapidReviewQuestions(
    _userId: string,
    topics?: string[],
  ): Promise<Question[]> {
    const where: any = { isActive: true };
    if (topics && topics.length > 0) {
      where.category = { in: topics };
    }

    const questions = await this.prisma.question.findMany({
      where,
      orderBy: { successRate: 'asc' },
      take: 10,
    });

    return questions;
  }

  @ApiOperation({ summary: 'Submit an answer for a question' })
  @ApiResponse({ status: 200, description: 'Answer submitted successfully' })
  async submitAnswer(
    userId: string,
    questionId: string,
    answer: string,
  ): Promise<{
    correct: boolean;
    explanation?: string;
  }> {
    const question = await this.prisma.question.findUnique({
      where: { id: questionId },
      include: { options: true },
    });

    if (!question) {
      throw new NotFoundException(`Question ${questionId} not found`);
    }

    const isCorrect = this.validateAnswer(question, answer);
    await this.recordAttempt(userId, questionId, isCorrect);

    return {
      correct: isCorrect,
      explanation: question.explanation ?? undefined,
    };
  }

  @ApiOperation({ summary: 'Get quiz results for a user' })
  @ApiResponse({
    status: 200,
    description: 'Quiz results retrieved successfully',
  })
  async getUserQuizResults(
    userId: string,
    unitId: string,
  ): Promise<{
    totalQuizzes: number;
    completedQuizzes: number;
    averageScore: number;
    attempts: QuizAttempt[];
  }> {
    const cacheKey = `quiz:results:${userId}:${unitId}`;
    const cachedResults = await this.redisService.get(cacheKey);
    if (cachedResults) {
      try {
        return JSON.parse(cachedResults);
      } catch (err) {
        this.logger.warn(`Corrupt cache for quiz results: ${cacheKey}`);
        await this.redisService.del(cacheKey);
      }
    }

    const attempts = await this.prisma.quizAttempt.findMany({
      where: {
        userId,
        quiz: { unitId },
      },
      orderBy: { completedAt: 'desc' },
    });

    const results = {
      totalQuizzes: attempts.length,
      completedQuizzes: attempts.filter((a) => a.completedAt).length,
      averageScore:
        attempts.reduce((sum, a) => sum + (a.score || 0), 0) /
          attempts.length || 0,
      attempts,
    };

    await this.redisService.set(cacheKey, JSON.stringify(results), 3600);
    return results;
  }

  @ApiOperation({ summary: 'Submit a quiz' })
  @ApiResponse({ status: 200, description: 'Quiz submitted successfully' })
  async submitQuiz(
    userId: string,
    unitId: string,
    answers: QuizAnswerDto[],
  ): Promise<QuizAttempt & { recommendations: QuizPerformanceRecommendations }> {
    const quizInclude = {
      questions: {
        include: {
          question: {
            include: { options: true },
          },
        },
      },
      unit: { select: { courseId: true } },
    };
    let quiz = await this.prisma.quiz.findFirst({
      where: {
        id: unitId,
        OR: [
          { isPublished: true },
          { autoGeneratedQuizzes: { some: { userId } } },
        ],
      },
      include: quizInclude,
    });
    if (!quiz) {
      quiz = await this.prisma.quiz.findFirst({
        where: { unitId, topicId: null, isPublished: true },
        include: quizInclude,
      });
    }

    if (!quiz) {
      this.logger.warn(
        `No published quiz found for unit ${unitId} — submission rejected`,
      );
      throw new NotFoundException(
        `No published quiz found for unit ${unitId}. Please use the generate endpoint first.`,
      );
    }

    const activeQuiz = quiz;

    const submittedQuestionIds = answers.map((answer) => answer.questionId);
    const expectedQuestionIds = activeQuiz.questions.map(
      (quizQuestion) => quizQuestion.questionId,
    );
    if (
      submittedQuestionIds.length !== expectedQuestionIds.length ||
      new Set(submittedQuestionIds).size !== submittedQuestionIds.length ||
      expectedQuestionIds.some((questionId) => !submittedQuestionIds.includes(questionId))
    ) {
      throw new BadRequestException(
        'A quiz submission must contain exactly one answer for every quiz question',
      );
    }

    const existingAttempts = await this.prisma.quizAttempt.count({
      where: { userId, quizId: activeQuiz.id },
    });

    if (activeQuiz.maxAttempts && existingAttempts >= activeQuiz.maxAttempts) {
      this.logger.error(
        `Maximum attempts exceeded for quiz ${activeQuiz.id} by user ${userId}`,
      );
      throw new MaxAttemptsExceededException(activeQuiz.id);
    }

    const bktUpdates: Array<{ skillId: string; isCorrect: boolean }> = [];
    const reviewAnswersByTopic = new Map<
      string,
      Array<{ questionId: string; isCorrect: boolean }>
    >();

    const result = await this.prisma.$transaction(async (tx) => {
      const prelimAttempt = await tx.quizAttempt.create({
        data: {
          userId,
          quizId: activeQuiz.id,
          startedAt: new Date(),
        },
      });

      let correctAnswers = 0;
      const totalQuestions = activeQuiz.questions.length;

      for (const answer of answers) {
        const question = activeQuiz.questions.find(
          (q) => q.questionId === answer.questionId,
        )?.question;
        if (!question) {
          this.logger.warn(
            `Question ${answer.questionId} not found for quiz ${activeQuiz.id}`,
          );
          continue;
        }

        const gradingResult = QuizUtils.gradeAnswer(
          question,
          answer.selectedOption,
        );
        await tx.userResponse.create({
          data: {
            userId,
            questionId: answer.questionId,
            attemptId: prelimAttempt.id,
            answer: JSON.stringify(answer.selectedOption),
            isCorrect: gradingResult.isCorrect,
            createdAt: new Date(),
          },
        });

        if (gradingResult.isCorrect) {
          correctAnswers++;
        }

        const topicIds = activeQuiz.topicId
          ? question.topicIds.includes(activeQuiz.topicId)
            ? [activeQuiz.topicId]
            : []
          : question.topicIds;
        for (const topicId of topicIds) {
          const topicAnswers = reviewAnswersByTopic.get(topicId) ?? [];
          topicAnswers.push({
            questionId: question.id,
            isCorrect: gradingResult.isCorrect,
          });
          reviewAnswersByTopic.set(topicId, topicAnswers);
        }

        // Collect BKT update data — will be dispatched after transaction commits
        const skillId = (question as any).topicId || (question as any).topic_ids?.[0] || (question as any).topicIds?.[0] || activeQuiz.topicId;
        if (skillId) {
          bktUpdates.push({ skillId, isCorrect: gradingResult.isCorrect });
        }
      }

      const { score: scorePercentage, isPassed } = QuizUtils.calculateScore(
        correctAnswers,
        totalQuestions,
        activeQuiz.passingScore || 70,
      );

      const attempt = await tx.quizAttempt.update({
        where: { id: prelimAttempt.id },
        data: {
          score: scorePercentage,
          maxScore: totalQuestions,
          percentage: scorePercentage,
          isPassed,
          completedAt: new Date(),
        },
      });

      await tx.userActivity.create({
        data: {
          userId,
          type: UserActivityType.QUIZ_ATTEMPT,
          description: `Completed quiz: ${activeQuiz.title}`,
          details: {
            quizId: activeQuiz.id,
            unitId: activeQuiz.unitId,
            score: scorePercentage,
            passed: isPassed,
            totalQuestions,
            correctAnswers,
          },
        },
      });

      if (isPassed && activeQuiz.unitId) {
        // REMOVE THIS LINE: await tx.unitProgress.upsert({...});
      }

      await this.progressService.updateProgress(userId, activeQuiz.id, {
        isPassed,
        completionPercentage: 100,
        bestScore: scorePercentage,
        totalAttempts: existingAttempts + 1,
      });

      await this.analyticsService.generateAnalytics(userId, activeQuiz.id);

      // Trigger mastery gate logic for topic-level quizzes
      if (activeQuiz.topicId) {
        try {
          const masteryResult = await this.masteryGateService.onQuizComplete(
            userId,
            activeQuiz.topicId,
            isPassed,
            scorePercentage,
            activeQuiz.passingScore || 70,
          );
          this.logger.log(
            `Mastery gate result for topic ${activeQuiz.topicId}: ${masteryResult.message}`,
          );
        } catch (err) {
          this.logger.warn(`Failed to update mastery gate: ${String(err)}`);
        }
      }

      const autoQuizUpdate = await tx.autoGeneratedQuiz.updateMany({
        where: {
          userId,
          quizId: activeQuiz.id,
          completedAt: null,
        },
        data: { completedAt: new Date() },
      });

      return {
        attempt,
        autoQuizCompleted: autoQuizUpdate.count === 1,
      };
    });

    if (result.autoQuizCompleted) {
      this.eventEmitter.emit('auto-quiz.completed', {
        userId,
        quizId: activeQuiz.id,
        score: result.attempt.score ?? 0,
        maxScore: result.attempt.maxScore,
        timestamp: result.attempt.completedAt ?? new Date(),
      });
    }

    await this.redisService.del(`quiz:${activeQuiz.id}`);
    this.logger.log(
      `Submitted quiz ${activeQuiz.id} for user ${userId} with score ${result.attempt.score}`,
    );

    // Dispatch BKT updates outside the transaction so failures don't corrupt attempt state
    for (const { skillId, isCorrect } of bktUpdates) {
      void this.analyticsService
        .updateBktForAssessment(userId, skillId, isCorrect)
        .catch((err) =>
          this.logger.warn(`Failed to update BKT for skill ${skillId}: ${String(err)}`),
        );
    }

    await Promise.all(
      Array.from(reviewAnswersByTopic.entries()).map(async ([topicId, reviewAnswers]) => {
        try {
          await this.flashcardsService.recordTopicQuizReviews(
            userId,
            topicId,
            reviewAnswers,
          );
        } catch (error) {
          this.logger.warn(
            `Quiz ${activeQuiz.id} was recorded, but review cards could not be scheduled for topic ${topicId}: ${String(error)}`,
          );
        }
      }),
    );

    const recommendations = await this.recommendationService.recommendForAnswers(
      userId,
      {
        topicId: activeQuiz.topicId,
        unitId: activeQuiz.unitId,
        courseId: activeQuiz.unit?.courseId,
      },
      [...reviewAnswersByTopic.values()].flat(),
    );

    return { ...result.attempt, recommendations };
  }

  @ApiOperation({ summary: 'Submit a topic-level quiz' })
  @ApiResponse({ status: 200, description: 'Topic quiz submitted successfully' })
  async submitTopicQuiz(
    userId: string,
    topicId: string,
    responses: Array<{ questionId: string; selectedAnswers: string[] }>,
  ): Promise<{
    score: number;
    feedback: string;
    passed: boolean;
    masteryUnlocked: boolean;
    nextTopicUnlocked: boolean;
    nextTopicId?: string;
    reviewCardsScheduled: number;
    recommendations: QuizPerformanceRecommendations;
  }> {
    try {
      const topic = await this.prisma.topic.findUnique({
        where: { id: topicId },
        select: {
          id: true,
          unitId: true,
          unit: { select: { courseId: true } },
        },
      });
      if (!topic) throw new NotFoundException(`Topic with ID ${topicId} not found`);
      if (
        !Array.isArray(responses) ||
        responses.length === 0 ||
        responses.length > 100 ||
        responses.some((response) => !response || typeof response !== 'object')
      ) {
        throw new BadRequestException('Topic quiz responses must contain 1–100 answer objects');
      }

      const questionIds = responses.map((r) => r.questionId);
      if (
        questionIds.some((id) => typeof id !== 'string' || !id) ||
        new Set(questionIds).size !== questionIds.length
      ) {
        throw new BadRequestException('Topic quiz responses contain invalid or duplicate question IDs');
      }
      const fetchedQuestions = await this.prisma.question.findMany({
        where: { topicIds: { has: topicId }, isActive: true },
        include: { options: true },
      });
      if (
        fetchedQuestions.length !== questionIds.length ||
        fetchedQuestions.some((question) => !questionIds.includes(question.id))
      ) {
        throw new BadRequestException(
          'A topic quiz must answer every current question exactly once',
        );
      }
      const questionMap = new Map(fetchedQuestions.map((q) => [q.id, q]));
      const selectedAnswersByQuestion = new Map<string, string[]>();

      let score = 0;
      let correctAnswers = 0;
      let totalPoints = 0;
      const reviewAnswers: Array<{ questionId: string; isCorrect: boolean }> = [];

      for (const response of responses) {
        const question = questionMap.get(response.questionId);
        if (!question || !Array.isArray(response.selectedAnswers)) {
          throw new BadRequestException('A submitted question does not belong to this topic');
        }

        const selectedIds = response.selectedAnswers;
        if (
          selectedIds.some((id) => typeof id !== 'string') ||
          new Set(selectedIds).size !== selectedIds.length
        ) {
          throw new BadRequestException('A topic quiz response contains invalid or duplicate options');
        }
        const optionIds = new Set(question.options.map((option) => option.id));
        if (selectedIds.some((id) => !optionIds.has(id))) {
          throw new BadRequestException('A selected option does not belong to its question');
        }

        totalPoints += question.points || 1;
        const correctOptions = question.options.filter(option => option.isCorrect);
        const isCorrect =
          correctOptions.length === selectedIds.length &&
          correctOptions.every(option => selectedIds.includes(option.id));
        if (isCorrect) {
          score += question.points || 1;
          correctAnswers += 1;
        }
        reviewAnswers.push({ questionId: question.id, isCorrect });
        selectedAnswersByQuestion.set(question.id, selectedIds);
      }

      const scorePercentage = totalPoints > 0 ? Math.round((score / totalPoints) * 100) : 0;
      const passed = scorePercentage >= 70;
      await this.prisma.topicQuizAttempt.create({
        data: {
          userId,
          topicId,
          score: scorePercentage,
          questionCount: responses.length,
          correctAnswers,
          responses: reviewAnswers.map((answer) => ({
            questionId: answer.questionId,
            isCorrect: answer.isCorrect,
            selectedAnswers: selectedAnswersByQuestion.get(answer.questionId) ?? [],
          })) as Prisma.InputJsonValue,
        },
      });
      const recommendations = await this.recommendationService.recommendForAnswers(
        userId,
        { topicId, unitId: topic.unitId, courseId: topic.unit.courseId },
        reviewAnswers,
      );
      this.eventEmitter.emit('assessment.completed', {
        userId,
        assessmentId: topicId,
        courseId: topic.unit.courseId,
        topicId,
        score: scorePercentage,
        maxScore: 100,
        timestamp: new Date(),
        attemptData: {
          score: scorePercentage,
          maxScore: 100,
          passed,
          progressPercentage: 100,
          timestamp: new Date().toISOString(),
        },
      });
      for (const answer of reviewAnswers) {
        void this.analyticsService
          .updateBktForAssessment(userId, topicId, answer.isCorrect)
          .catch((error) =>
            this.logger.warn(`Could not update topic mastery for ${topicId}: ${String(error)}`),
          );
      }
      const reviewCardsScheduled =
        await this.flashcardsService.recordTopicQuizReviews(
          userId,
          topicId,
          reviewAnswers,
        );
      const mastery = await this.masteryGateService.onQuizComplete(
        userId,
        topicId,
        passed,
        scorePercentage,
      );

      try {
        await this.prisma.userActivity.create({
          data: {
            userId,
            type: UserActivityType.QUIZ_ATTEMPT,
            description: `Completed topic quiz: ${topicId}`,
            details: { topicId, score: scorePercentage, passed, totalPoints },
          },
        });
      } catch (error) {
        this.logger.warn(`Could not record activity for topic quiz ${topicId}: ${String(error)}`);
      }
      
      return {
        score: scorePercentage,
        feedback: passed 
          ? `Great job! You scored ${scorePercentage}%`
          : `You scored ${scorePercentage}%. Keep practicing!`,
        passed,
        masteryUnlocked: mastery.masteryUnlocked,
        nextTopicUnlocked: mastery.nextTopicUnlocked,
        nextTopicId: mastery.nextTopicId,
        reviewCardsScheduled,
        recommendations,
      };
    } catch (error) {
      this.logger.error(`Error submitting topic quiz: ${String(error)}`);
      throw error;
    }
  }

  async syncOfflinePracticeAttempt(
    userId: string,
    topicId: string,
    attemptId: string,
    responses: Array<{ questionId: string; selectedAnswers: string[] }>,
  ): Promise<{ attemptId: string; score: number; validatedAt: Date; formative: true }> {
    if (typeof attemptId !== 'string' || !attemptId.trim()) {
      throw new BadRequestException('An offline attempt ID is required');
    }
    if (!Array.isArray(responses) || responses.length === 0) {
      throw new BadRequestException('At least one practice response is required');
    }
    if (responses.some(response => !response || typeof response !== 'object' || Array.isArray(response))) {
      throw new BadRequestException('Practice responses must be objects');
    }

    const questionIds = responses.map((response) => response.questionId);
    if (
      questionIds.some((questionId) => typeof questionId !== 'string' || !questionId) ||
      new Set(questionIds).size !== questionIds.length
    ) {
      throw new BadRequestException('Practice responses contain invalid or duplicate question IDs');
    }

    const questions = await this.prisma.question.findMany({
      where: {
        isActive: true,
        topicIds: { has: topicId },
      },
      select: {
        id: true,
        points: true,
        options: { select: { id: true, isCorrect: true } },
      },
    });
    if (
      questions.length !== questionIds.length ||
      questions.some(question => !questionIds.includes(question.id))
    ) {
      throw new BadRequestException(
        'A practice attempt must answer every current question for this topic',
      );
    }

    const questionById = new Map(questions.map((question) => [question.id, question]));
    const normalizedResponses = responses.map((response) => {
      if (
        !Array.isArray(response.selectedAnswers) ||
        response.selectedAnswers.some((optionId) => typeof optionId !== 'string') ||
        new Set(response.selectedAnswers).size !== response.selectedAnswers.length
      ) {
        throw new BadRequestException('Practice response contains invalid or duplicate options');
      }
      const question = questionById.get(response.questionId);
      if (!question) {
        throw new BadRequestException('A submitted question does not belong to this topic');
      }
      const optionIds = new Set(question.options.map((option) => option.id));
      if (response.selectedAnswers.some((optionId) => !optionIds.has(optionId))) {
        throw new BadRequestException('A selected option does not belong to its question');
      }
      return {
        questionId: response.questionId,
        selectedAnswers: [...response.selectedAnswers].sort(),
      };
    });

    let earnedPoints = 0;
    let totalPoints = 0;
    for (const response of normalizedResponses) {
      const question = questionById.get(response.questionId)!;
      const correctOptionIds = question.options
        .filter((option) => option.isCorrect)
        .map((option) => option.id)
        .sort();
      const points = question.points || 1;
      totalPoints += points;
      if (
        correctOptionIds.length === response.selectedAnswers.length &&
        correctOptionIds.every((optionId, index) => optionId === response.selectedAnswers[index])
      ) {
        earnedPoints += points;
      }
    }
    const score = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;

    const attempt = await this.prisma.offlinePracticeAttempt.upsert({
      where: { id: attemptId },
      create: {
        id: attemptId,
        userId,
        topicId,
        responses: normalizedResponses as Prisma.InputJsonValue,
        score,
      },
      update: {},
      select: { id: true, userId: true, topicId: true, responses: true, score: true, validatedAt: true },
    });

    const storedResponses = attempt.responses as typeof normalizedResponses;
    const storedAnswerKey = JSON.stringify(
      storedResponses
        .map((response) => ({
          questionId: response.questionId,
          selectedAnswers: [...response.selectedAnswers].sort(),
        }))
        .sort((left, right) => left.questionId.localeCompare(right.questionId)),
    );
    const requestedAnswerKey = JSON.stringify(
      [...normalizedResponses].sort((left, right) => left.questionId.localeCompare(right.questionId)),
    );
    if (
      attempt.userId !== userId ||
      attempt.topicId !== topicId ||
      storedAnswerKey !== requestedAnswerKey
    ) {
      throw new ConflictException('This offline attempt ID is already associated with another submission');
    }

    return {
      attemptId: attempt.id,
      score: attempt.score,
      validatedAt: attempt.validatedAt,
      formative: true,
    };
  }

  /**
   * Automatically generate a quiz for a specific unit using available questions.
   * Merged from UnitQuizService.
   */
  @ApiOperation({ summary: 'Generate a quiz for a unit' })
  async generateUnitQuiz(unitId: string, creatorId: string): Promise<Quiz> {
    const cacheKey = `unit_quiz:${unitId}`;
    const cachedQuiz = await this.redisService.get(cacheKey);
    if (cachedQuiz) {
      try {
        this.logger.log(`Retrieved cached unit quiz for unit ${unitId}`);
        return JSON.parse(cachedQuiz);
      } catch (err) {
        this.logger.warn(`Corrupt cache for unit quiz: ${cacheKey}`);
        await this.redisService.del(cacheKey);
      }
    }

    const unit = await this.prisma.unit.findUnique({
      where: { id: unitId },
      include: { course: true },
    });

    if (!unit) {
      throw new NotFoundException(`Unit with ID ${unitId} not found`);
    }

    const questions = await this.questionBankService.findQuestions({
      unitId,
      limit: 10,
    });

    if (questions.questions.length < 5) {
      throw new BadRequestException(
        `Not enough questions available for unit ${unitId} (found ${questions.questions.length}, need at least 5)`,
      );
    }

    const quiz = await this.prisma.$transaction(async (tx) => {
      const createdQuiz = await tx.quiz.create({
        data: {
          title: `Unit Quiz for ${unit.title}`,
          description: `Automatically generated quiz for ${unit.title}`,
          unitId,
          maxAttempts: 3,
          passingScore: 70,
          isPublished: true,
          createdBy: creatorId,
          questionCount: questions.questions.length,
        },
      });

      await tx.quizQuestion.createMany({
        data: questions.questions.map((q: any, index: number) => ({
          quizId: createdQuiz.id,
          questionId: q.id,
          order: index + 1,
        })),
      });

      return createdQuiz;
    });

    if (!quiz) {
      throw new BadRequestException('Failed to generate unit quiz');
    }

    await this.redisService.set(cacheKey, JSON.stringify(quiz), 3600);

    // Sync to global search index
    await this.searchSync.syncEntity('quiz', quiz.id);

    return quiz;
  }

  /**
   * Source of truth for grading a single question attempt
   */
  private validateAnswer(question: Question, answer: any): boolean {
    const grading = QuizUtils.gradeAnswer(question as any, answer);
    return grading.isCorrect;
  }

  private async recordAttempt(
    userId: string,
    questionId: string,
    correct: boolean,
  ): Promise<void> {
    // Log as a user activity for systems without a dedicated questionAttempt model
    await (this.prisma as any).userActivity.create({
      data: {
        userId,
        type: UserActivityType.QUIZ_ATTEMPT,
        details: { questionId, correct },
        createdAt: new Date(),
      },
    });
  }
}
