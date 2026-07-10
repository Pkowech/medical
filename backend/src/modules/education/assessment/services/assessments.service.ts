import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Inject,
  OnModuleInit,
} from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom, timeout, Observable } from 'rxjs';
import { retry } from 'rxjs/operators';
import { PrismaService } from '#infrastructure/prisma/prisma.service';
import { RedisService } from '#infrastructure/redis/redis.service';
import { QuizService } from './quiz.service';
import { FlashcardsService } from './flashcards.service';
import { FeedbackService } from './feedback.service';
import { AssessmentProgressService } from './assessment-progress.service';
import { AssessmentAnalyticsService } from '#modules/ai-analytics/services/assessment-analytics.service';
import {
  CreateAssessmentDto,
  SubmitAnswerDto,
  CreateQuestionBankDto,
} from '#common/dto';
import { QuizUtils } from '#common/utils/quiz.utils';
import {
  AssessmentNotFoundException,
  MaximumAttemptsReachedException,
  QuestionNotFoundException,
} from '#common/exceptions/not-found.exception';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import {
  Quiz,
  QuizAttempt,
  Question,
  Option,
  UserActivityType,
} from '@prisma/client';
import { AnalyticsService } from '#infrastructure/grpc/analytics.client';

@Injectable()
@ApiTags('assessments')
export class AssessmentsService implements OnModuleInit {
  private readonly logger = new Logger(AssessmentsService.name);
  private analyticsServiceGrpc!: AnalyticsService;
  private readonly grpcTimeoutMs = Number(
    process.env.RUST_GRPC_TIMEOUT_MS || 5000,
  );
  private readonly grpcRetries = Number(process.env.RUST_GRPC_RETRIES || 2);

  private callGrpc<T>(obs: Observable<T>): Promise<T> {
    return firstValueFrom(
      obs.pipe(timeout(this.grpcTimeoutMs), retry(this.grpcRetries)),
    );
  }

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly quizService: QuizService,
    private readonly flashcardsService: FlashcardsService,
    private readonly feedbackService: FeedbackService,
    private readonly progressService: AssessmentProgressService,
    private readonly analyticsService: AssessmentAnalyticsService,
    @Inject('ANALYTICS_PACKAGE') private readonly client: ClientGrpc,
  ) {}

  onModuleInit() {
    this.analyticsServiceGrpc =
      this.client.getService<AnalyticsService>('AnalyticsService');
  }

  @ApiOperation({ summary: 'Create a new assessment' })
  @ApiResponse({ status: 201, description: 'Assessment created successfully' })
  async createAssessment(
    dto: CreateAssessmentDto,
    creatorId: string,
  ): Promise<Quiz> {
    await this.validateCourseAndUnit(dto.courseId, dto.unitId);
    const cacheKey = `assessment:${dto.title}:${creatorId}`;
    const cachedAssessment = await this.redisService.get<string>(cacheKey);
    if (cachedAssessment) {
      try {
        return JSON.parse(cachedAssessment) as Quiz;
      } catch (err) {
        this.logger.warn(`Corrupt cache for assessment: ${cacheKey}`);
        await this.redisService.del(cacheKey);
      }
    }

    const assessment = await this.prisma.$transaction(async (tx) => {
      const assessment = await tx.quiz.create({
        data: {
          title: dto.title,
          description: dto.description,
          questionCount: dto.totalQuestions,
          maxAttempts: dto.maxAttempts,
          passingScore: dto.passingScore,
          isPublished: false,
          unitId: dto.unitId,
          createdAt: new Date(),
          createdBy: creatorId,
        },
      });
      return assessment;
    });

    await this.redisService.set(
      cacheKey,
      JSON.stringify(assessment),
      24 * 60 * 60,
    ); // 1 day TTL
    this.logger.log(`Created assessment ${assessment.id} by user ${creatorId}`);
    return assessment;
  }

  @ApiOperation({ summary: 'Find all assessments with filters' })
  @ApiResponse({ status: 200, description: 'List of assessments' })
  async findAll(
    filters: {
      courseId?: string;
      unitId?: string;
      isPublished?: boolean;
      createdBy?: string;
    } = {},
  ): Promise<Quiz[]> {
    const cacheKey = `assessments:${JSON.stringify(filters)}`;
    const cachedResult = await this.redisService.get<string>(cacheKey);
    if (cachedResult) {
      try {
        return JSON.parse(cachedResult) as Quiz[];
      } catch (err) {
        this.logger.warn(`Corrupt cache for assessments list: ${cacheKey}`);
        await this.redisService.del(cacheKey);
      }
    }

    const where: any = {};
    if (filters.courseId) {
      where.unit = { courseId: filters.courseId };
    }
    if (filters.unitId) {
      where.unitId = filters.unitId;
    }
    if (filters.isPublished !== undefined) {
      where.isPublished = filters.isPublished;
    }
    if (filters.createdBy) {
      where.createdBy = filters.createdBy;
    }

    const assessments = await this.prisma.quiz.findMany({
      where,
      include: {
        unit: { include: { course: { select: { title: true } } } },
        questions: { include: { question: { include: { options: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });

    await this.redisService.set(
      cacheKey,
      JSON.stringify(assessments),
      1 * 60 * 60,
    ); // 1 hour TTL
    return assessments;
  }

  @ApiOperation({ summary: 'Find an assessment by ID' })
  @ApiResponse({ status: 200, description: 'Assessment details' })
  async findOne(
    id: string,
    userId?: string,
  ): Promise<Quiz & { canAttempt?: boolean; attempts?: QuizAttempt[] }> {
    const cacheKey = `assessment:${id}:${userId || 'public'}`;
    const cachedAssessment = await this.redisService.get<string>(cacheKey);
    if (cachedAssessment) {
      try {
        return JSON.parse(cachedAssessment) as Quiz & {
          canAttempt?: boolean;
          attempts?: QuizAttempt[];
        };
      } catch (err) {
        this.logger.warn(`Corrupt cache for assessment ${id}`);
        await this.redisService.del(cacheKey);
      }
    }

    const assessment = await this.prisma.quiz.findUnique({
      where: { id },
      include: {
        unit: { include: { course: { select: { title: true } } } },
        questions: { include: { question: { include: { options: true } } } },
        attempts: userId ? { where: { userId } } : undefined,
      },
    });

    if (!assessment) {
      throw new AssessmentNotFoundException(id);
    }

    const result = userId
      ? {
          ...assessment,
          canAttempt: await this.canUserAttempt(assessment, userId),
        }
      : assessment;

    await this.redisService.set(cacheKey, JSON.stringify(result), 1 * 60 * 60);
    return result;
  }

  @ApiOperation({ summary: 'Add a question to an assessment' })
  @ApiResponse({ status: 201, description: 'Question added successfully' })
  async addQuestion(
    assessmentId: string,
    createQuestionDto: CreateQuestionBankDto,
    creatorId: string,
  ): Promise<Question & { options: Option[] }> {
    const assessment = await this.prisma.quiz.findUnique({
      where: { id: assessmentId },
    });
    if (!assessment) {
      throw new AssessmentNotFoundException(assessmentId);
    }

    if (assessment.createdBy !== creatorId) {
      throw new ForbiddenException(
        'Only the creator can modify this assessment',
      );
    }

    const question = await this.prisma.$transaction(async (tx) => {
      const question = await tx.question.create({
        data: {
          text: createQuestionDto.questionText,
          type: createQuestionDto.type,
          difficulty: createQuestionDto.difficulty,
          category: createQuestionDto.category,
          explanation: createQuestionDto.explanation,
          isActive: true,
          courseId: createQuestionDto.courseId,
          unitId: createQuestionDto.unitId,
          difficultyIndex: QuizUtils.getDifficultyIndex(
            createQuestionDto.difficulty,
          ),
          createdBy: creatorId,
        },
      });

      await tx.quizQuestion.create({
        data: {
          quizId: assessmentId,
          questionId: question.id,
          order:
            (await tx.quizQuestion.count({ where: { quizId: assessmentId } })) +
            1,
        },
      });

      if (createQuestionDto.options?.length) {
        await tx.option.createMany({
          data: createQuestionDto.options.map((opt, index) => ({
            questionId: question.id,
            text: opt.text || '',
            isCorrect: opt.isCorrect || false,
            order: index,
          })),
        });
      }

      return tx.question.findUnique({
        where: { id: question.id },
        include: { options: true },
      }) as Promise<Question & { options: Option[] }>;
    });

    await this.redisService.del(`assessment:${assessmentId}:*`); // Invalidate cache
    return question;
  }

  @ApiOperation({ summary: 'Start an assessment for a user' })
  @ApiResponse({ status: 201, description: 'Assessment attempt started' })
  async startAssessment(
    assessmentId: string,
    userId: string,
  ): Promise<QuizAttempt> {
    const assessment = await this.prisma.quiz.findUnique({
      where: { id: assessmentId, isPublished: true },
      include: { questions: true },
    });

    if (!assessment) {
      throw new AssessmentNotFoundException(assessmentId);
    }

    const now = new Date();
    if (assessment.availableFrom && now < assessment.availableFrom) {
      throw new BadRequestException('Assessment is not yet available');
    }
    if (assessment.availableUntil && now > assessment.availableUntil) {
      throw new BadRequestException('Assessment is no longer available');
    }

    const previousAttempts = await this.prisma.quizAttempt.count({
      where: { quizId: assessmentId, userId },
    });

    if (assessment.maxAttempts && previousAttempts >= assessment.maxAttempts) {
      throw new MaximumAttemptsReachedException();
    }

    const attempt = await this.prisma.quizAttempt.create({
      data: {
        userId,
        quizId: assessmentId,
        answers: {},
        score: 0,
        correctAnswers: 0,
        totalQuestions: assessment.questionCount,
        timeTaken: 0,
        isPassed: false,
        createdAt: new Date(),
      },
    });

    await this.progressService.updateProgress(userId, assessmentId, {
      completionPercentage: 0,
      lastAttemptedAt: new Date(),
      totalAttempts: previousAttempts + 1,
      bestScore: 0,
      isPassed: false,
    });

    return attempt;
  }

  @ApiOperation({ summary: 'Submit an answer for an assessment' })
  @ApiResponse({ status: 200, description: 'Answer submitted successfully' })
  async submitAnswer(attemptId: string, dto: SubmitAnswerDto, userId: string) {
    const attempt = await this.prisma.quizAttempt.findFirst({
      where: { id: attemptId, userId },
      include: { quiz: true },
    });

    if (!attempt) {
      throw new NotFoundException('Active attempt not found');
    }

    const question = await this.prisma.question.findUnique({
      where: { id: dto.questionId },
      include: { options: true },
    });

    if (!question) {
      throw new QuestionNotFoundException(dto.questionId);
    }

    const gradingResult = QuizUtils.gradeAnswer(question, dto.answerData);
    const answer = await this.prisma.$transaction(async (tx) => {
      const existingResponse = await tx.userResponse.findFirst({
        where: {
          userId,
          questionId: dto.questionId,
        },
      });

      if (existingResponse) {
        return tx.userResponse.update({
          where: { id: existingResponse.id },
          data: {
            answer: dto.answerData as any,
            isCorrect: gradingResult.isCorrect,
            responseTime: dto.timeSpentSeconds,
            updatedAt: new Date(),
          },
        });
      } else {
        return tx.userResponse.create({
          data: {
            userId,
            questionId: dto.questionId,
            attemptId, // Ensure attemptId is correctly passed
            answer: dto.answerData as any,
            isCorrect: gradingResult.isCorrect,
            responseTime: dto.timeSpentSeconds,
            createdAt: new Date(),
          },
        });
      }
    });

    // Update BKT
    const topicIds = (question as any).topic_ids;
    if (topicIds && topicIds.length > 0) {
      topicIds.forEach((topicId: string) => {
        // Fire-and-forget but ensure we log if RPC fails
        this.callGrpc(
          this.analyticsServiceGrpc.updateBkt({
            user_id: userId,
            skill_id: topicId,
            is_correct: gradingResult.isCorrect,
          }),
        ).catch((err) =>
          this.logger.warn(
            `Failed to update BKT for ${topicId} via gRPC: ${err}`,
          ),
        );
      });
    }

    await this.redisService.del(`assessment:${attempt.quizId}:${userId}`);
    return answer;
  }

  @ApiOperation({ summary: 'Complete an assessment attempt' })
  @ApiResponse({
    status: 200,
    description: 'Assessment completed successfully',
  })
  async completeAssessment(
    attemptId: string,
    userId: string,
  ): Promise<QuizAttempt> {
    const attempt = await this.prisma.quizAttempt.findFirst({
      where: { id: attemptId, userId },
      include: {
        quiz: { include: { questions: { include: { question: true } } } },
      },
    });

    if (!attempt) {
      throw new NotFoundException('Active attempt not found');
    }

    const responses = await this.prisma.userResponse.findMany({
      where: {
        userId,
        questionId: { in: attempt.quiz.questions.map((q) => q.questionId) },
      },
    });

    const totalPoints = responses.reduce(
      (sum, r) => sum + (r.isCorrect ? 1 : 0),
      0,
    );
    const maxPoints = attempt.quiz.questionCount;
    const percentage = maxPoints > 0 ? (totalPoints / maxPoints) * 100 : 0;

    const updatedAttempt = await this.prisma.quizAttempt.update({
      where: { id: attemptId },
      data: {
        score: percentage,
        correctAnswers: responses.filter((r) => r.isCorrect).length,
        totalQuestions: maxPoints,
        isPassed: percentage >= (attempt.quiz.passingScore || 70),
        timeTaken: Math.floor(
          (Date.now() - attempt.createdAt.getTime()) / 1000,
        ),
      },
    });

    await this.progressService.updateProgress(userId, attempt.quizId, {
      completionPercentage: 100,
      lastAttemptedAt: new Date(),
      totalAttempts: await this.prisma.quizAttempt.count({
        where: { userId, quizId: attempt.quizId },
      }),
      bestScore: percentage,
      isPassed: percentage >= (attempt.quiz.passingScore || 70),
    });

    await this.analyticsService.generateAnalytics(userId, attempt.quizId);
    await this.redisService.del(`assessment:${attempt.quizId}:${userId}`);
    return updatedAttempt;
  }

  @ApiOperation({ summary: 'Get user assessment summary' })
  @ApiResponse({ status: 200, description: 'User assessment summary' })
  async getUserAssessmentSummary(userId: string) {
    const cacheKey = `assessment_summary:${userId}`;
    const cachedSummary = await this.redisService.get<string>(cacheKey);
    if (cachedSummary) {
      try {
        return JSON.parse(cachedSummary);
      } catch (err) {
        this.logger.warn(`Corrupt cache for assessment summary: ${userId}`);
        await this.redisService.del(cacheKey);
      }
    }

    const [quizAttempts, flashcardSessions, averageScores, recentActivity] =
      await Promise.all([
        this.prisma.quizAttempt.count({ where: { userId } }),
        this.prisma.flashcard.count({
          where: {
            userProgress: {
              some: {
                userId,
              },
            },
          },
        }),
        this.calculateAverageScores(userId),
        this.getRecentAssessmentActivity(userId),
      ]);

    const summary = {
      totalQuizAttempts: quizAttempts,
      totalFlashcardSessions: flashcardSessions,
      averageQuizScore: averageScores.quiz,
      averageFlashcardAccuracy: averageScores.flashcard,
      recentActivity,
      strengths: await this.analyticsService.identifyStrengths(userId),
      weaknesses: await this.analyticsService.identifyWeaknesses(userId),
    };

    await this.redisService.set(cacheKey, JSON.stringify(summary), 1 * 60 * 60);
    return summary;
  }

  @ApiOperation({ summary: 'Get assessment analytics for a user' })
  @ApiResponse({ status: 200, description: 'Assessment analytics' })
  async getAssessmentAnalytics(
    userId: string,
    _dateRange?: { start: Date; end: Date },
  ) {
    const cacheKey = `assessment_analytics:${userId}`;
    const cachedAnalytics = await this.redisService.get<string>(cacheKey);
    if (cachedAnalytics) {
      try {
        return JSON.parse(cachedAnalytics);
      } catch (err) {
        this.logger.warn(`Corrupt cache for assessment analytics: ${userId}`);
        await this.redisService.del(cacheKey);
      }
    }

    const analytics = await this.analyticsService.generateAnalytics(
      userId,
      undefined,
    );
    await this.redisService.set(
      cacheKey,
      JSON.stringify(analytics),
      1 * 60 * 60,
    );
    return analytics;
  }

  private async calculateAverageScores(userId: string) {
    const [quizAvg, flashcardAvg] = await Promise.all([
      this.prisma.quizAttempt.aggregate({
        where: { userId },
        _avg: { score: true },
      }),
      this.prisma.userFlashcardProgress.aggregate({
        where: { userId },
        _avg: { easeFactor: true },
      }),
    ]);

    return {
      quiz: Math.round(quizAvg._avg.score || 0),
      flashcard: Math.round(flashcardAvg._avg.easeFactor || 0),
    };
  }

  private async getRecentAssessmentActivity(userId: string) {
    return this.prisma.userActivity.findMany({
      where: {
        userId,
        type: {
          in: [
            UserActivityType.QUIZ_COMPLETION,
            UserActivityType.FLASHCARD_SESSION,
          ],
        },
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
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

  private async canUserAttempt(
    assessment: Quiz,
    userId: string,
  ): Promise<boolean> {
    const attemptCount = await this.prisma.quizAttempt.count({
      where: { quizId: assessment.id, userId },
    });
    return !assessment.maxAttempts || attemptCount < assessment.maxAttempts;
  }
}
