import {
  Injectable,
  Logger,
  Inject,
  OnModuleInit,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { RedisService } from '#infrastructure/redis/redis.service';
import { firstValueFrom, timeout, Observable } from 'rxjs';
import { retry } from 'rxjs/operators';
import { AnalyticsService } from '#infrastructure/grpc/analytics.client';
import { PerformanceMetricsService } from '#infrastructure/monitoring/performance-metrics.service';
import { DistributedTracingService } from '#infrastructure/monitoring/distributed-tracing.service';
import { RequestDeduplicationService } from './request-deduplication.service';
import {
  PerformanceAnalyticsDto,
  SubmitAnswerDto,
  AdaptiveQuizSession,
  UserPerformanceProfileDto,
} from '#common/dto';
import type { AssessmentPerformanceAnalyticsResponse } from '../../../generated/grpc/analytics';
import { getErrorMessage } from '#common/utils/error.utils';
import {
  ANALYTICS_CACHE_CONFIG,
  ANALYTICS_METRICS_CONFIG,
} from './analytics-cache.constants';
import { PrismaService } from '#infrastructure/prisma/prisma.service';
import { PredictionValidatorService } from './prediction-validator.service';
import { QuizUtils } from '#common/utils/quiz.utils';
import { v4 as uuidv4 } from 'uuid';
import {
  Option,
  Question,
  Prisma,
  QuestionCategory,
  QuestionType,
} from '@prisma/client';

type AdaptiveQuestionWithOptions = Question & { options: Option[] };

/**
 * AssessmentAnalyticsService
 *
 * Domain-specific service for assessment and quiz-related analytics operations.
 * Provides performance predictions, BKT (Bayesian Knowledge Tracing) updates,
 * and assessment-specific analytics and recommendations.
 * Proxies assessment analytics to the Rust service over gRPC.
 *
 * Used by:
 * - assessment-recommendations.service.ts (personalized assessment recommendations)
 * - adaptive-quiz.service.ts (adaptive quiz performance tracking and BKT updates)
 * - quiz.service.ts (quiz submissions and analytics)
 */
@Injectable()
export class AssessmentAnalyticsService implements OnModuleInit {
  private readonly logger = new Logger(AssessmentAnalyticsService.name);
  private readonly cacheTtl = 3600;
  private readonly grpcTimeoutMs = Number(
    process.env.RUST_GRPC_TIMEOUT_MS || 5000,
  );
  private readonly grpcRetries = Number(process.env.RUST_GRPC_RETRIES || 2);

  private analyticsServiceGrpc!: AnalyticsService;

  constructor(
    private readonly redisService: RedisService,
    @Inject('ANALYTICS_PACKAGE') private readonly client: ClientGrpc,
    private readonly requestDeduplicationService: RequestDeduplicationService,
    private readonly performanceMetrics: PerformanceMetricsService,
    private readonly tracingService: DistributedTracingService,
    private readonly prisma: PrismaService,
    private readonly predictionValidator: PredictionValidatorService,
  ) {}

  /**
   * Call gRPC with configurable timeout and retry (used for adaptive flows)
   */
  private async callGrpcWithTimeout<T>(
    obs: Observable<T>,
    timeoutMs: number,
  ): Promise<T> {
    return firstValueFrom(
      obs.pipe(
        timeout(timeoutMs),
        retry({ count: this.grpcRetries, delay: 500 }),
      ),
    );
  }

  // ----------------- Adaptive quiz helpers (migrated from AdaptiveQuizAnalyticsService) -----------------

  async startAdaptiveQuiz(
    userId: string,
    courseId?: string,
    unitId?: string,
  ): Promise<AdaptiveQuizSession> {
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
    } else if (courseId) {
      const course = await this.prisma.course.findUnique({
        where: { id: courseId },
        select: { id: true },
      });
      if (!course) throw new NotFoundException(`Course ${courseId} not found`);
    }

    const startTime = Date.now();
    const cacheKey = ANALYTICS_CACHE_CONFIG.ASSESSMENT.ADAPTIVE_QUIZ(
      userId,
      courseId,
      unitId,
    );
    const dedupKey = ANALYTICS_CACHE_CONFIG.DEDUP(cacheKey);

    // Check cache first
    const cachedSession = await this.redisService.get<string>(cacheKey);
    if (cachedSession) {
      this.logger.log(`Retrieved cached session for user ${userId}`);
      return JSON.parse(cachedSession) as AdaptiveQuizSession;
    }

    return await this.requestDeduplicationService.executeWithDedup(
      dedupKey,
      async () => {
        const userAbility = await this.callGrpcWithTimeout(
          this.analyticsServiceGrpc.getUserAbility({ userId }),
          this.grpcTimeoutMs,
        );
        const sessionId = uuidv4();
        const session: AdaptiveQuizSession = {
          sessionId,
          userId,
          courseId,
          unitId,
          questions: [],
          currentQuestionIndex: 0,
          userAbility: userAbility.estimatedAbility,
          confidenceInterval: 2.0,
          targetPrecision: 0.3,
          responses: [],
          isComplete: false,
          finalScore: 0,
          recommendations: [],
        };

        const grpcResp = await this.callGrpcWithTimeout(
          this.analyticsServiceGrpc.getNextAdaptiveQuestion({
            userId,
            topicId: '',
            courseId: session.courseId ?? '',
            unitId: session.unitId ?? '',
          }),
          this.grpcTimeoutMs,
        );
        const initialQuestion = grpcResp.questionId
          ? await this.findAdaptiveQuestion(grpcResp.questionId, session)
          : null;
        if (!initialQuestion) {
          throw new NotFoundException(
            'Rust analytics returned no eligible question for this assessment scope',
          );
        }
        session.questions.push(initialQuestion);

        await this.prisma.$transaction(async (tx) => {
          const quiz = await tx.quiz.create({
            data: {
              title: 'Adaptive quiz session',
              description: 'Private adaptive assessment session',
              unitId,
              questionCount: 0,
              maxAttempts: 1,
              isAdaptive: true,
              isPublished: false,
              createdBy: userId,
            },
          });
          await tx.quizAttempt.create({
            data: {
              id: sessionId,
              userId,
              quizId: quiz.id,
              startedAt: new Date(),
              totalQuestions: 0,
              answers: [],
            },
          });
        });

        const sessionCacheKey =
          ANALYTICS_CACHE_CONFIG.ASSESSMENT.ADAPTIVE_SESSION(userId, sessionId);
        await this.redisService.set(
          sessionCacheKey,
          JSON.stringify(session),
          30 * 60,
        );

        await this.performanceMetrics.recordMetric({
          endpoint: ANALYTICS_METRICS_CONFIG.ENDPOINTS.ASSESSMENT,
          method: 'startAdaptiveQuiz',
          provider: ANALYTICS_METRICS_CONFIG.PROVIDERS.GRPC,
          userId,
          responseTimeMs: Date.now() - startTime,
          cacheHit: false,
          success: true,
          timestamp: new Date(),
        });

        this.logger.log(
          `Started adaptive quiz session ${sessionId} for user ${userId}`,
        );
        return session;
      },
    );
  }

  async submitAnswer(
    sessionId: string,
    dto: SubmitAnswerDto,
    confidence: number = 3,
  ): Promise<{
    isCorrect: boolean;
    explanation: string;
    nextQuestion?: Question;
    isComplete: boolean;
    session: AdaptiveQuizSession;
  }> {
    const startTime = Date.now();
    const sessionCacheKey = ANALYTICS_CACHE_CONFIG.ASSESSMENT.ADAPTIVE_SESSION(
      dto.userId,
      sessionId,
    );
    const sessionData = await this.redisService.get<string>(sessionCacheKey);
    if (!sessionData) {
      throw new Error(
        `Quiz session ${sessionId} not found for user ${dto.userId}`,
      );
    }
    const session: AdaptiveQuizSession = JSON.parse(sessionData);

    try {
      const currentQuestion = session.questions[
        session.currentQuestionIndex
      ] as AdaptiveQuestionWithOptions | undefined;
      if (!currentQuestion || currentQuestion.id !== dto.questionId) {
        throw new BadRequestException(
          `Question ${dto.questionId} is not the current question in this session`,
        );
      }

      if (
        typeof dto.answerData !== 'string' ||
        !currentQuestion.options?.some((option) => option.id === dto.answerData)
      ) {
        throw new BadRequestException(
          'The selected option does not belong to the current question',
        );
      }
      const gradingResult = QuizUtils.gradeAnswer(
        currentQuestion,
        dto.answerData,
      );

      session.responses.push({
        questionId: dto.questionId,
        isCorrect: gradingResult.isCorrect,
        responseTime: dto.timeSpentSeconds ?? 0,
        confidence,
      });

      // Update ability estimate using IRT
      session.userAbility = QuizUtils.updateUserAbility(
        session.userAbility,
        {
          difficultyIndex: currentQuestion.difficultyIndex || 0,
          discrimination: currentQuestion.discrimination || 1,
          guessing: currentQuestion.guessing || 0.25,
        },
        gradingResult.isCorrect,
      );

      session.confidenceInterval = QuizUtils.updateConfidenceInterval(
        session.confidenceInterval,
        currentQuestion.discrimination || 1,
      );

      // Persist response
      await this.prisma.userResponse.create({
        data: {
          userId: session.userId,
          questionId: dto.questionId,
          attemptId: session.sessionId,
          answer: dto.answerData ?? Prisma.JsonNull,
          isCorrect: gradingResult.isCorrect,
          responseTime: dto.timeSpentSeconds ?? 0,
          createdAt: new Date(),
        },
      });
      await Promise.all(
        currentQuestion.topicIds.map((topicId) =>
          this.updateBktForAssessment(
            session.userId,
            topicId,
            gradingResult.isCorrect,
          ),
        ),
      );

      // Advance question index
      session.currentQuestionIndex++;
      const shouldContinue = this.shouldContinueQuiz(session);
      let nextQuestion: Question | undefined;

      if (shouldContinue) {
        const grpcResp = await this.callGrpcWithTimeout(
          this.analyticsServiceGrpc.getNextAdaptiveQuestion({
            userId: session.userId,
            topicId: '',
            courseId: session.courseId ?? '',
            unitId: session.unitId ?? '',
          }),
          this.grpcTimeoutMs,
        );
        if (grpcResp.questionId) {
          nextQuestion =
            (await this.findAdaptiveQuestion(
              grpcResp.questionId,
              session,
            )) || undefined;
        }
        await this.performanceMetrics.recordMetric({
          endpoint: ANALYTICS_METRICS_CONFIG.ENDPOINTS.ASSESSMENT,
          method: 'submitAnswer/getNextAdaptiveQuestion',
          provider: ANALYTICS_METRICS_CONFIG.PROVIDERS.GRPC,
          userId: session.userId,
          responseTimeMs: Date.now() - startTime,
          cacheHit: false,
          success: true,
          timestamp: new Date(),
        });
        if (!nextQuestion) session.isComplete = true;
        else session.questions.push(nextQuestion);
      } else {
        session.isComplete = true;
      }

      const cacheKey = ANALYTICS_CACHE_CONFIG.ASSESSMENT.ADAPTIVE_SESSION(
        session.userId,
        sessionId,
      );
      await this.redisService.set(cacheKey, JSON.stringify(session), 30 * 60);

      return {
        isCorrect: gradingResult.isCorrect,
        explanation: currentQuestion.explanation || '',
        nextQuestion,
        isComplete: session.isComplete,
        session,
      };
    } catch (error) {
      this.logger.error(
        `Error processing answer for session ${sessionId}: ${getErrorMessage(error)}`,
      );
      throw error;
    }
  }

  async finalizeSession(session: AdaptiveQuizSession): Promise<void> {
    try {
      const correct = session.responses.filter((r) => r.isCorrect).length;
      session.finalScore =
        session.responses.length > 0
          ? (correct / session.responses.length) * 100
          : 0;

      const attempt = await this.prisma.quizAttempt.findFirst({
        where: { id: session.sessionId, userId: session.userId },
        select: { id: true, quizId: true, startedAt: true },
      });
      if (!attempt) {
        throw new Error(`Adaptive quiz attempt ${session.sessionId} was not found`);
      }

      await this.prisma.$transaction([
        this.prisma.quizAttempt.update({
          where: { id: attempt.id },
          data: {
            answers: session.responses as Prisma.InputJsonValue,
            score: session.finalScore,
            maxScore: 100,
            percentage: session.finalScore,
            timeTaken: session.responses.reduce(
              (sum, response) => sum + response.responseTime,
              0,
            ),
            isPassed: session.finalScore >= 70,
            correctAnswers: correct,
            totalQuestions: session.responses.length,
            completedAt: new Date(),
          },
        }),
        this.prisma.quiz.update({
          where: { id: attempt.quizId },
          data: { questionCount: session.responses.length },
        }),
      ]);

      const sessionCacheKey =
        ANALYTICS_CACHE_CONFIG.ASSESSMENT.ADAPTIVE_SESSION(
          session.userId,
          session.sessionId,
        );
      await this.redisService.del(sessionCacheKey);
      this.logger.log(`Finalized session ${session.sessionId}`);
    } catch (error) {
      this.logger.error(`Error finalizing session: ${getErrorMessage(error)}`);
      throw error;
    }
  }

  private shouldContinueQuiz(session: AdaptiveQuizSession): boolean {
    return (
      session.responses.length < 20 &&
      (session.responses.length < 5 ||
        session.confidenceInterval > session.targetPrecision)
    );
  }

  async getSession(
    userId: string,
    sessionId: string,
  ): Promise<AdaptiveQuizSession | undefined> {
    const sessionCacheKey = ANALYTICS_CACHE_CONFIG.ASSESSMENT.ADAPTIVE_SESSION(
      userId,
      sessionId,
    );
    const data = await this.redisService.get<string>(sessionCacheKey);
    return data ? JSON.parse(data) : undefined;
  }

  async invalidateUserProfile(userId: string): Promise<void> {
    await this.redisService.del(`user_profile:${userId}`);
  }

  async getNextAdaptiveQuestion(userId: string): Promise<{
    questionId: string;
    recommendedDifficulty: number;
  }> {
    const startTime = Date.now();
    const grpcResp = await this.callGrpcWithTimeout(
      this.analyticsServiceGrpc.getNextAdaptiveQuestion({
        userId,
        topicId: '',
        courseId: '',
        unitId: '',
      }),
      this.grpcTimeoutMs,
    );
    if (!grpcResp.questionId) {
      throw new NotFoundException(
        'Rust analytics found no eligible adaptive question',
      );
    }

    await this.performanceMetrics.recordMetric({
      endpoint: ANALYTICS_METRICS_CONFIG.ENDPOINTS.ASSESSMENT,
      method: 'getNextAdaptiveQuestion',
      provider: ANALYTICS_METRICS_CONFIG.PROVIDERS.GRPC,
      userId,
      responseTimeMs: Date.now() - startTime,
      cacheHit: false,
      success: true,
      timestamp: new Date(),
    });

    return {
      questionId: grpcResp.questionId,
      recommendedDifficulty: grpcResp.recommendedDifficulty,
    };
  }

  // ----------------- Recommendations helpers (gRPC-first) -----------------

  async getRelatedResources(assessmentId: string): Promise<any[]> {
    try {
      const grpcResp = await this.callGrpc(
        this.analyticsServiceGrpc.getRelatedResources({
          resourceId: assessmentId,
          limit: 5,
        }),
      );
      return grpcResp.resources;
    } catch (error) {
      this.logger.error(
        `getRelatedResources gRPC failure: ${getErrorMessage(error)}`,
      );
      throw error;
    }
  }

  async generateStudyRecommendations(
    userId: string,
    knowledgeGaps: string[] = [],
  ): Promise<any[]> {
    try {
      const grpcResp = await this.callGrpc(
        this.analyticsServiceGrpc.generateStudyRecommendations({
          userId,
          knowledgeGaps,
        }),
      );
      return grpcResp.recommendations;
    } catch (error) {
      this.logger.error(
        `generateStudyRecommendations gRPC failure: ${getErrorMessage(error)}`,
      );
      throw error;
    }
  }

  async generateNextSteps(userId: string): Promise<string[]> {
    try {
      const grpcResp = await this.callGrpc(
        this.analyticsServiceGrpc.generateNextSteps({ userId: userId }),
      );
      return grpcResp.steps.map((step) => step.step);
    } catch (error) {
      this.logger.error(
        `generateNextSteps gRPC failure: ${getErrorMessage(error)}`,
      );
      throw error;
    }
  }

  async getFullRecommendations(
    userId: string,
    assessmentId?: string,
  ): Promise<any> {
    const recs = await this.getAssessmentRecommendations(userId);
    const resources = assessmentId
      ? await this.getRelatedResources(assessmentId)
      : await this.generateStudyRecommendations(
          userId,
          recs.map((r: any) => r.assessmentId || ''),
        );
    const nextSteps = await this.generateNextSteps(userId);

    return {
      userId,
      assessmentId: assessmentId || null,
      recommendedActions: recs.map(
        (r: any) => r.title || r.reason || r.assessmentId,
      ),
      priorityTopics: recs.map((r: any) => r.assessmentId),
      estimatedStudyTime: recs.length * 2,
      resources,
      nextSteps,
    };
  }

  private async findAdaptiveQuestion(
    questionId: string,
    session: AdaptiveQuizSession,
  ): Promise<Question | null> {
    return this.prisma.question.findFirst({
      where: {
        id: {
          equals: questionId,
          notIn: session.questions.map((question) => question.id),
        },
        isActive: true,
        type: { in: [QuestionType.multiple_choice, QuestionType.true_false] },
        ...(session.unitId
          ? { unitId: session.unitId }
          : session.courseId
            ? { courseId: session.courseId }
            : {}),
      },
      include: { options: true },
    });
  }

  onModuleInit() {
    this.analyticsServiceGrpc =
      this.client.getService<AnalyticsService>('AnalyticsService');
  }

  private async callGrpc<T>(obs: Observable<T>): Promise<T> {
    return firstValueFrom(
      obs.pipe(timeout(this.grpcTimeoutMs), retry(this.grpcRetries)),
    );
  }

  /**
   * Predict performance for a user on a specific skill/assessment
   * Uses gRPC for fast prediction
   */
  async predictAssessmentPerformance(
    userId: string,
    skillId: string,
  ): Promise<{ score: number; confidence?: number }> {
    try {
      const cacheKey = ANALYTICS_CACHE_CONFIG.ASSESSMENT.PREDICTIONS(
        userId,
        skillId,
      );

      const cached = await this.redisService.get<string>(cacheKey);
      if (typeof cached === 'string') {
        return JSON.parse(cached);
      }

      // Strictly gRPC
      const startTime = Date.now();
      const response = await this.callGrpc(
        this.analyticsServiceGrpc.predictPerformance({
          userId: userId,
          skillId: skillId,
        }),
      );
      const responseTimeMs = Date.now() - startTime;

      void this.performanceMetrics.recordMetric({
        endpoint: ANALYTICS_METRICS_CONFIG.ENDPOINTS.PREDICTIONS,
        method: 'GET',
        provider: ANALYTICS_METRICS_CONFIG.PROVIDERS.GRPC,
        userId,
        responseTimeMs,
        cacheHit: false,
        success: true,
        timestamp: new Date(),
      });

      const result = { score: response.score };
      if (skillId) {
        await this.predictionValidator.recordPrediction(
          userId,
          skillId,
          response.score,
        );
      }
      await this.redisService.set(
        cacheKey,
        JSON.stringify(result),
        this.cacheTtl,
      );
      return result;
    } catch (error) {
      this.logger.error(
        `Failed to predict assessment performance via gRPC: ${getErrorMessage(
          error,
        )}`,
      );
      throw error;
    }
  }

  async recordCompletedAssessmentOutcome(
    userId: string,
    assessmentId: string,
    scorePercentage: number,
  ): Promise<void> {
    try {
      await this.predictionValidator.recordActualOutcome(
        userId,
        assessmentId,
        scorePercentage / 100,
      );
    } catch (error) {
      this.logger.warn(
        `Could not record prediction outcome for assessment ${assessmentId}: ${getErrorMessage(error)}`,
      );
      throw error;
    }
  }

  async getUserAssessmentPredictions(userId: string) {
    const attempts = await this.prisma.quizAttempt.findMany({
      where: {
        userId,
        completedAt: { not: null },
        quiz: { isPublished: true },
      },
      select: {
        quizId: true,
        quiz: {
          select: {
            title: true,
            passingScore: true,
            topicId: true,
            topic: { select: { name: true } },
          },
        },
      },
      orderBy: { completedAt: 'desc' },
      take: 500,
    });

    const attemptsByQuiz = new Map<
      string,
      {
        title: string;
        topicId: string | null;
        topicName: string | null;
        passingScore: number;
      }
    >();

    for (const attempt of attempts) {
      const entry = attemptsByQuiz.get(attempt.quizId) ?? {
        title: attempt.quiz.title,
        topicId: attempt.quiz.topicId,
        topicName: attempt.quiz.topic?.name ?? null,
        passingScore: attempt.quiz.passingScore ?? 70,
      };
      attemptsByQuiz.set(attempt.quizId, entry);
    }

    return Promise.all(
      [...attemptsByQuiz.entries()].map(async ([assessmentId, entry]) => {
        if (!entry.topicId) {
          throw new Error(
            `Cannot predict assessment ${assessmentId}: no topic is linked`,
          );
        }
        const prediction = await this.predictAssessmentPerformance(
          userId,
          entry.topicId,
        );
        const predictedScore = prediction.score * 100;
        const belowPassingScore = predictedScore < entry.passingScore;
        const studyTarget = entry.topicName ?? entry.title;

        return {
          assessmentId,
          assessmentName: entry.title,
          predictedScore,
          recommendation: belowPassingScore
            ? `Review ${studyTarget}; your predicted score is below the ${entry.passingScore}% passing score.`
            : `Your predicted score is above the passing score. Continue practicing ${studyTarget}.`,
          recommendedPreparation: belowPassingScore
            ? [`Review the course materials for ${studyTarget}.`]
            : [],
          difficultyAreas: belowPassingScore ? [studyTarget] : [],
        };
      }),
    );
  }

  async getUserAssessmentPrediction(userId: string, assessmentId: string) {
    const prediction = (
      await this.getUserAssessmentPredictions(userId)
    ).find((item) => item.assessmentId === assessmentId);
    return prediction ?? null;
  }

  /**
   * Update Bayesian Knowledge Tracing for user's skill assessment
   * Fire-and-forget call to gRPC/Rust
   */
  async updateBktForAssessment(
    userId: string,
    skillId: string,
    isCorrect: boolean,
  ): Promise<void> {
    await this.callGrpc(
      this.analyticsServiceGrpc.updateBkt({
        userId,
        skillId,
        isCorrect,
      }),
    );
    const cacheKey = ANALYTICS_CACHE_CONFIG.ASSESSMENT.PREDICTIONS(
      userId,
      skillId,
    );
    await this.redisService.del(cacheKey);
  }

  /**
   * Get assessment recommendations based on user performance
   */
  async getAssessmentRecommendations(userId: string): Promise<
    Array<{
      assessmentId: string;
      title: string;
      recommendedDifficulty: number;
      reason: string;
    }>
  > {
    try {
      const cacheKey =
        ANALYTICS_CACHE_CONFIG.RECOMMENDATIONS.ASSESSMENT(userId);
      const dedupKey = ANALYTICS_CACHE_CONFIG.DEDUP(cacheKey);

      const cached = await this.redisService.get<string>(cacheKey);
      if (typeof cached === 'string') {
        return JSON.parse(cached);
      }

      return await this.requestDeduplicationService.executeWithDedup(
        dedupKey,
        async () => {
          // Strictly gRPC
          const response = await this.callGrpc(
            this.analyticsServiceGrpc.getRecommendations({ userId, limit: 10 }),
          );

          // Filter for assessment-type recommendations
          const assessmentRecs = response.items
            .filter((item) => item.type === 'assessment')
            .map((item) => ({
              assessmentId: item.id,
              title: item.title,
              recommendedDifficulty: item.score,
              reason: item.reason,
            }));

          await this.redisService.set(
            cacheKey,
            JSON.stringify(assessmentRecs),
            this.cacheTtl,
          );
          return assessmentRecs;
        },
      );
    } catch (error) {
      this.logger.error(
        `Failed to get assessment recommendations via gRPC: ${getErrorMessage(
          error,
        )}`,
      );
      throw error;
    }
  }

  /**
   * Get comprehensive assessment analytics for a user
   */
  async getAssessmentAnalytics(
    userId: string,
  ): Promise<Record<string, unknown>> {
    try {
      const cacheKey = `${ANALYTICS_CACHE_CONFIG.ASSESSMENT.PERFORMANCE(userId)}:assessment-summary:v2`;

      const cached = await this.redisService.get<string>(cacheKey);
      if (typeof cached === 'string') {
        return JSON.parse(cached);
      }

      // Strictly gRPC - we proxy the detailed analytics and pick performance metrics
      const startTime = Date.now();
      const grpcResp = await this.callGrpc(
        this.analyticsServiceGrpc.getDetailedLearningAnalytics({
          userId,
        }),
      );
      const responseTimeMs = Date.now() - startTime;

      void this.performanceMetrics.recordMetric({
        endpoint: ANALYTICS_METRICS_CONFIG.ENDPOINTS.ASSESSMENT,
        method: 'GET',
        provider: ANALYTICS_METRICS_CONFIG.PROVIDERS.GRPC,
        userId,
        responseTimeMs,
        cacheHit: false,
        success: true,
        timestamp: new Date(),
      });

      const metrics = grpcResp.performanceMetrics;
      if (!metrics) {
        throw new Error('Rust analytics omitted assessment performance metrics');
      }
      const analytics = {
        userId,
        averageScore: metrics.averageAssessmentScore,
        passRate: metrics.passRate,
        weaknessAreas: metrics.weaknessAreas,
        strengthAreas: metrics.strengthAreas,
      };

      await this.redisService.set(
        cacheKey,
        JSON.stringify(analytics),
        this.cacheTtl,
      );
      return analytics;
    } catch (error) {
      this.logger.error(
        `Failed to get assessment analytics via gRPC: ${getErrorMessage(
          error,
        )}`,
      );
      throw error;
    }
  }

  /**
   * Get high-risk/struggling topic recommendations from Rust analytics
   */
  async getFocusRecommendations(
    userId: string,
    limit: number = 5,
  ): Promise<
    Array<{
      topic: string;
      cardCount: number;
      passRate: number;
    }>
  > {
    try {
      const cacheKey = `focus_recommendations:${userId}:${limit}`;
      const cached = await this.redisService.get<string>(cacheKey);
      if (typeof cached === 'string') {
        return JSON.parse(cached);
      }

      const response = await this.callGrpc(
        this.analyticsServiceGrpc.getFocusRecommendations({
          userId: userId,
          limit,
        }),
      );

      const recommendations = response.areas.map((a) => ({
          topic: a.topic,
          cardCount: a.cardCount,
          passRate: a.passRate,
        }));

      await this.redisService.set(
        cacheKey,
        JSON.stringify(recommendations),
        600, // 10 minutes cache
      );

      return recommendations;
    } catch (error) {
      this.logger.error(
        `Failed to get focus recommendations via gRPC: ${getErrorMessage(error)}`,
      );
      throw error;
    }
  }

  /**
   * Get due flashcards/reviews for spaced repetition via Rust analytics gRPC
   */
  async getDueCards(userId: string) {
    try {
      const grpcResp = await this.callGrpc(
        this.analyticsServiceGrpc.getDueCards({ userId }),
      );
      return grpcResp.cards;
    } catch (error) {
      this.logger.error(
        `Failed to get due cards via gRPC: ${getErrorMessage(error)}`,
      );
      throw error;
    }
  }

  /**
   * Track assessment submission event
   */
  async trackAssessmentSubmission(
    userId: string,
    assessmentId: string,
    _score: number,
    isCorrect: boolean,
  ): Promise<void> {
    try {
      // Proxy event to Rust
      await this.callGrpc(
        this.analyticsServiceGrpc.batchTrackEvents({
          userId: userId,
          events: [
            {
              eventType: 'assessment_submission',
              data: {},
              timestamp: new Date().toISOString(),
              sessionId: '',
              duration: 0,
            },
          ],
        }),
      );

      // Update BKT asynchronously via gRPC
      await this.updateBktForAssessment(userId, assessmentId, isCorrect);
    } catch (error) {
      this.logger.warn(
        `Failed to proxy assessment submission to Rust: ${getErrorMessage(
          error,
        )}`,
      );
      throw error;
    }
  }

  // ==================== ASSESSMENT DOMAIN METHODS ====================

  /**
   * Predict performance for a user on a specific assessment
   */
  async predictPerformance(
    userId: string,
    assessmentId?: string,
  ): Promise<any> {
    try {
      const cacheKey = ANALYTICS_CACHE_CONFIG.ASSESSMENT.PREDICTIONS(
        userId,
        assessmentId,
      );
      const cached = await this.redisService.get<string>(cacheKey);
      if (typeof cached === 'string') {
        return JSON.parse(cached);
      }

      // Strictly gRPC
      const startTime = Date.now();
      const grpcResp = await this.callGrpc(
        this.analyticsServiceGrpc.predictPerformance({
          userId: userId,
          skillId: assessmentId || '',
        }),
      );
      const responseTimeMs = Date.now() - startTime;

      void this.performanceMetrics.recordMetric({
        endpoint: ANALYTICS_METRICS_CONFIG.ENDPOINTS.PREDICTIONS,
        method: 'GET',
        provider: ANALYTICS_METRICS_CONFIG.PROVIDERS.GRPC,
        userId,
        responseTimeMs,
        cacheHit: false,
        success: true,
        timestamp: new Date(),
      });

      const result = { score: grpcResp.score };
      await this.redisService.set(
        cacheKey,
        JSON.stringify(result),
        this.cacheTtl,
      );
      return result;
    } catch (error) {
      this.logger.error(
        `Error in predictPerformance via gRPC: ${getErrorMessage(error)}`,
      );
      throw error;
    }
  }

  /**
   * Get performance analytics for a user
   */
  async getPerformanceAnalytics(userId: string): Promise<{
    userId: string;
    totalAssessments: number;
    averageScore: number;
    performanceBySkill: Record<string, number>;
    strengthAreas: string[];
    weaknessAreas: string[];
  }> {
    try {
      const cacheKey = `${ANALYTICS_CACHE_CONFIG.ASSESSMENT.PERFORMANCE(userId)}:v2`;
      const cached = await this.redisService.get<string>(cacheKey);
      if (typeof cached === 'string') {
        return JSON.parse(cached);
      }

      const startTime = Date.now();
      const response = await this.requestAssessmentPerformanceAnalytics(userId);
      const responseTimeMs = Date.now() - startTime;
      const analytics = {
        userId,
        totalAssessments: response.totalAttempts,
        averageScore: response.averageScore,
        performanceBySkill: Object.fromEntries(
          response.categoryBreakdown.map(({ category, score }) => [
            category,
            score,
          ]),
        ),
        strengthAreas: response.strengths,
        weaknessAreas: response.weaknesses,
      };

      void this.performanceMetrics.recordMetric({
        endpoint: ANALYTICS_METRICS_CONFIG.ENDPOINTS.ASSESSMENT,
        method: 'GET',
        provider: ANALYTICS_METRICS_CONFIG.PROVIDERS.GRPC,
        userId,
        responseTimeMs,
        cacheHit: false,
        success: true,
        timestamp: new Date(),
      });
      await this.redisService.set(
        cacheKey,
        JSON.stringify(analytics),
        this.cacheTtl,
      );
      return analytics;
    } catch (error) {
      this.logger.error(
        `Error in getPerformanceAnalytics: ${getErrorMessage(error)}`,
      );
      throw error;
    }
  }

  /**
   * Predict with Bayesian Knowledge Tracing model
   */
  async predictWithBKT(
    userId: string,
    skillId: string,
    previousAttempts?: number,
  ): Promise<any> {
    try {
      const cacheKey = ANALYTICS_CACHE_CONFIG.ASSESSMENT.BKT(
        `${userId}:${skillId}`,
      );
      const cached = await this.redisService.get<string>(cacheKey);
      if (typeof cached === 'string') {
        return JSON.parse(cached);
      }

      try {
        const startTime = Date.now();
        const grpcResp = await this.callGrpc(
          this.analyticsServiceGrpc.predictBkt({
            userId,
            skillId,
            featureVector: [],
          }),
        );
        const responseTimeMs = Date.now() - startTime;

        void this.performanceMetrics.recordMetric({
          endpoint: ANALYTICS_METRICS_CONFIG.ENDPOINTS.PREDICTIONS,
          method: 'GET',
          provider: ANALYTICS_METRICS_CONFIG.PROVIDERS.GRPC,
          userId,
          responseTimeMs,
          cacheHit: false,
          success: true,
          timestamp: new Date(),
        });

        const result = {
          skillId,
          probabilityKnown: grpcResp.pKnown,
          probabilityNextCorrect: grpcResp.pNextCorrect,
          attempts: previousAttempts,
        };

        await this.redisService.set(
          cacheKey,
          JSON.stringify(result),
          this.cacheTtl,
        );
        return result;
      } catch (grpcErr) {
        this.logger.warn(
          `gRPC predictWithBKT failed: ${getErrorMessage(grpcErr)}`,
        );
        throw grpcErr;
      }
    } catch (error) {
      this.logger.error(`Error in predictWithBKT: ${getErrorMessage(error)}`);
      throw error;
    }
  }

  /**
   * Predict performance using Burnout model
   */
  async predictWithBurnModel(userId: string): Promise<any> {
    try {
      const cacheKey = ANALYTICS_CACHE_CONFIG.ASSESSMENT.BURN(userId);
      const cached = await this.redisService.get<string>(cacheKey);
      if (typeof cached === 'string') {
        return JSON.parse(cached);
      }

      // Strictly gRPC
      try {
        const startTime = Date.now();
        const grpcResp = await this.callGrpc(
          this.analyticsServiceGrpc.predictBurnModel({
            userId: userId,
            features: [],
          }),
        );
        const responseTimeMs = Date.now() - startTime;

        void this.performanceMetrics.recordMetric({
          endpoint: ANALYTICS_METRICS_CONFIG.ENDPOINTS.PREDICTIONS,
          method: 'GET',
          provider: ANALYTICS_METRICS_CONFIG.PROVIDERS.GRPC,
          userId,
          responseTimeMs,
          cacheHit: false,
          success: true,
          timestamp: new Date(),
        });

        const data = grpcResp;
        await this.redisService.set(
          cacheKey,
          JSON.stringify(data),
          this.cacheTtl,
        );
        return data;
      } catch (grpcErr) {
        this.logger.warn(
          `gRPC predictWithBurnModel failed: ${getErrorMessage(grpcErr)}`,
        );
        throw grpcErr;
      }
    } catch (error) {
      this.logger.error(
        `Error in predictWithBurnModel: ${getErrorMessage(error)}`,
      );
      throw error;
    }
  }

  /** Generates assessment analytics through the Rust analytics service. */
  async generateAnalytics(
    userId: string,
    assessmentId?: string,
  ): Promise<PerformanceAnalyticsDto> {
    const response = await this.requestAssessmentPerformanceAnalytics(
      userId,
      assessmentId,
    );
    return this.mapAssessmentPerformanceAnalytics(response);
  }

  async identifyStrengths(userId: string): Promise<string[]> {
    const analytics = await this.getPerformanceAnalytics(userId);
    return analytics.strengthAreas;
  }

  async identifyWeaknesses(userId: string): Promise<string[]> {
    const analytics = await this.getPerformanceAnalytics(userId);
    return analytics.weaknessAreas;
  }

  async analyzeDifficulty(
    userId: string,
    question: Pick<Question, 'id'>,
  ): Promise<{ difficultyScore: number; suggestion: string; sampleSize: number }> {
    return this.callGrpc(
      this.analyticsServiceGrpc.analyzeQuestionDifficulty({
        userId,
        questionId: question.id,
      }),
    );
  }

  /**
   * Backwards-compatible wrapper used by education callers to fetch
   * a user performance profile from Rust analytics.
   */
  async getUserPerformanceProfile(
    userId: string,
  ): Promise<UserPerformanceProfileDto> {
    try {
      const [learningAnalytics, assessmentAnalytics, userAbility] =
        await Promise.all([
          this.callGrpc(
            this.analyticsServiceGrpc.getDetailedLearningAnalytics({
              userId,
            }),
          ),
          this.requestAssessmentPerformanceAnalytics(userId),
          this.callGrpc(
            this.analyticsServiceGrpc.getUserAbility({ userId }),
          ),
        ]);
      const { courseStats, pathStats } = learningAnalytics;
        const performanceMetrics = learningAnalytics.performanceMetrics;
        if (!courseStats || !pathStats || !performanceMetrics) {
          throw new Error(
            'Rust analytics omitted required course, path, or performance statistics',
          );
      }
      const categoryValues = Object.values(QuestionCategory);
      const knowledgeGaps = assessmentAnalytics.weaknesses.map((category) => {
        const normalized = category.toLowerCase().replaceAll(' ', '_');
        const questionCategory = categoryValues.find(
          (value) => value === normalized,
        );
        if (!questionCategory) {
          throw new Error(
            `Rust analytics returned unsupported question category: ${category}`,
          );
        }
        return questionCategory;
      });
      return {
        userId,
        recentPerformance: {
          correct: assessmentAnalytics.correctAnswers,
          total: assessmentAnalytics.questionsAttempted,
          averageTime: assessmentAnalytics.timePerQuestion,
        },
        knowledgeGaps,
        totalCourses: courseStats.totalCourses,
        completedCourses: courseStats.completedCourses,
        totalLearningPaths: pathStats.totalLearningPaths,
        completedLearningPaths: pathStats.completedLearningPaths,
        categoryAbilities: Object.fromEntries(
          assessmentAnalytics.categoryBreakdown.map(({ category, score }) => [
            category,
            score,
          ]),
        ),
        overallAbility: userAbility.estimatedAbility,
        overallScore: assessmentAnalytics.averageScore,
        performanceMetrics: {
          averageAssessmentScore: performanceMetrics.averageAssessmentScore,
          passRate: performanceMetrics.passRate,
          improvementRate: performanceMetrics.improvementRate,
        },
        strengths: assessmentAnalytics.strengths,
        weaknesses: assessmentAnalytics.weaknesses,
        skill_prob_by_skill: userAbility.pKnownBySkill,
      };
    } catch (error) {
      this.logger.warn(
        `getUserPerformanceProfile gRPC failure: ${getErrorMessage(error)}`,
      );
      throw error;
    }
  }

  /**
   * Fetch a user's quiz/assessment attempt history from Rust analytics.
   */
  async getQuizAttemptHistory(
    userId: string,
    options?: { limit?: number; offset?: number },
  ): Promise<any[]> {
    try {
      // Strictly gRPC
      const resp = await this.callGrpc(
        this.analyticsServiceGrpc.getQuizAttemptHistory({
          userId,
          limit: options?.limit ?? 0,
          offset: options?.offset ?? 0,
        }),
      );
      return resp.attempts;
    } catch (error) {
      this.logger.warn(
        `getQuizAttemptHistory gRPC failure: ${getErrorMessage(error)}`,
      );
      throw error;
    }
  }

  /**
   * Get topic mastery levels (p_known) for a user
   */
  async getMastery(userId: string): Promise<Record<string, number>> {
    try {
      const cacheKey = `${ANALYTICS_CACHE_CONFIG.ASSESSMENT.PERFORMANCE(
        `${userId}:mastery`,
      )}:v2`;
      const cached = await this.redisService.get<Record<string, number>>(
        cacheKey,
      );
      if (cached !== null) {
        return cached;
      }

      // Strictly gRPC
      const startTime = Date.now();
      const grpcResp = await this.callGrpc(
        this.analyticsServiceGrpc.getUserAbility({ userId: userId }),
      );
      const responseTimeMs = Date.now() - startTime;

      void this.performanceMetrics.recordMetric({
        endpoint: ANALYTICS_METRICS_CONFIG.ENDPOINTS.ASSESSMENT,
        method: 'GET',
        provider: ANALYTICS_METRICS_CONFIG.PROVIDERS.GRPC,
        userId,
        responseTimeMs,
        cacheHit: false,
        success: true,
        timestamp: new Date(),
      });

      const mastery = grpcResp.pKnownBySkill;

      await this.redisService.set(cacheKey, mastery, this.cacheTtl);
      return mastery;
    } catch (error) {
      this.logger.error(
        `Failed to get mastery via gRPC: ${getErrorMessage(error)}`,
      );
      throw error;
    }
  }

  /**
   * Get spaced repetition (flashcard) statistics for a user.
   * Proxies to Rust SpacedRepetitionAnalytics.get_user_stats()
   */
  async getSpacedRepetitionStats(userId: string): Promise<{
    totalCards: number;
    dueToday: number;
    masteredCards: number;
    learningCards: number;
    relearningCards: number;
    avgEaseFactor: number;
    avgIntervalDays: number;
    recentPassRate: number;
  }> {
    try {
      const cacheKey = ANALYTICS_CACHE_CONFIG.ASSESSMENT.PERFORMANCE(
        `${userId}:spaced_rep`,
      );
      const cached = await this.redisService.get<string>(cacheKey);
      if (typeof cached === 'string') {
        return JSON.parse(cached);
      }

      // Strictly gRPC
      const startTime = Date.now();
      const grpcResp = await this.callGrpc(
        this.analyticsServiceGrpc.getSpacedRepetitionStats({ userId: userId }),
      );
      const responseTimeMs = Date.now() - startTime;

      void this.performanceMetrics.recordMetric({
        endpoint: ANALYTICS_METRICS_CONFIG.ENDPOINTS.ASSESSMENT,
        method: 'GET',
        provider: ANALYTICS_METRICS_CONFIG.PROVIDERS.GRPC,
        userId,
        responseTimeMs,
        cacheHit: false,
        success: true,
        timestamp: new Date(),
      });

      if (!grpcResp.stats) {
        throw new Error('Rust analytics omitted spaced repetition statistics');
      }
      const stats = grpcResp.stats;

      await this.redisService.set(
        cacheKey,
        JSON.stringify(stats),
        this.cacheTtl,
      );
      return stats;
    } catch (error) {
      this.logger.warn(
        `getSpacedRepetitionStats gRPC failure: ${getErrorMessage(error)}`,
      );
      throw error;
    }
  }

  // ==================== CONSOLIDATED RECOMMENDATIONS METHODS ====================

  private async requestAssessmentPerformanceAnalytics(
    userId: string,
    assessmentId?: string,
  ) {
    return this.callGrpc(
      this.analyticsServiceGrpc.getAssessmentPerformanceAnalytics({
        userId,
        quizId: assessmentId ?? '',
      }),
    );
  }

  private mapAssessmentPerformanceAnalytics(
    response: AssessmentPerformanceAnalyticsResponse,
  ): PerformanceAnalyticsDto {
    return {
      userId: response.userId,
      quizId: response.quizId || undefined,
      overallScore: response.overallScore,
      averageScore: response.averageScore,
      totalAttempts: response.totalAttempts,
      recentScores: response.recentScores,
      questionsAttempted: response.questionsAttempted,
      correctAnswers: response.correctAnswers,
      timeTaken: response.timeTaken,
      timeSpent: response.timeSpent,
      timePerQuestion: response.timePerQuestion,
      averageTimePerQuestion: response.averageTimePerQuestion,
      weakAreas: response.weaknesses,
      progressTrend: response.progressTrend,
      difficultyBreakdown: Object.fromEntries(
        response.difficultyBreakdown.map(({ difficulty, correctAnswers }) => [
          difficulty,
          correctAnswers,
        ]),
      ),
      categoryBreakdown: response.categoryBreakdown.map((category) => ({
        category: category.category,
        correct: category.correct,
        total: category.total,
        percentage: category.score,
        score: category.score,
        questionsAnswered: category.questionsAnswered,
        averageTime: category.averageTime,
        strengths: category.isStrength ? [category.category] : [],
        weaknesses: category.isWeakness ? [category.category] : [],
      })),
      learningTrends: response.learningTrends,
      strengths: response.strengths,
      weaknesses: response.weaknesses,
    };
  }

  private async generatePerformanceAnalytics(
    userId: string,
    assessmentId?: string,
  ): Promise<PerformanceAnalyticsDto> {
    const response = await this.requestAssessmentPerformanceAnalytics(
      userId,
      assessmentId,
    );
    return this.mapAssessmentPerformanceAnalytics(response);
  }

  /**
   * Get performance analytics for a user (merged from assessment-recommendations.service.ts)
   */
  async getPerformanceAnalyticsForAssessment(
    userId: string,
    assessmentId?: string,
  ): Promise<any> {
    const cacheKey = `${ANALYTICS_CACHE_CONFIG.ASSESSMENT.PREDICTIONS(
      userId,
      assessmentId,
    )}:v4`;
    const cachedAnalytics =
      await this.redisService.get<PerformanceAnalyticsDto>(cacheKey);
    if (cachedAnalytics !== null) {
      this.logger.log(`Retrieved cached analytics for user ${userId}`);
      return cachedAnalytics;
    }

    const analytics = await this.generatePerformanceAnalytics(
      userId,
      assessmentId,
    );
    await this.redisService.set(cacheKey, analytics, 12 * 60 * 60);

    return analytics;
  }

  async getQuizHistory(userId: string) {
    const response = await this.callGrpc(
      this.analyticsServiceGrpc.getQuizAttemptHistory({
        userId,
        limit: 0,
        offset: 0,
      }),
    );
    return {
      attempts: response.attempts.map((attempt) => ({
        id: attempt.attemptId,
        quizId: attempt.quizId,
        quizTitle: attempt.quizTitle,
        score: attempt.score,
        totalQuestions: attempt.totalQuestions,
        correctAnswers: attempt.correctAnswers,
        timeSpent: Math.round(attempt.timeTakenSeconds / 60),
        completedAt: attempt.date,
        unitId: attempt.unitId,
        unitTitle: attempt.unitTitle,
      })),
      stats: {
        totalAttempts: response.totalAttempts,
        averageScore: response.averageScore,
        bestScore: response.bestScore,
        totalTimeSpent: Math.round(response.totalTimeSpentSeconds / 60),
        recentImprovement: response.recentImprovement,
      },
    };
  }

  // ==================== CONSOLIDATED LEARNING ANALYTICS METHODS ====================

  /**
   * Get user learning analytics including quiz attempts, unit completions, and activities
   * (merged from consolidated-analytics.service.ts)
   */
  async getUserLearningAnalytics(userId: string): Promise<any> {
    const cacheKey = `user-learning:${userId}`;
    const cached = await this.redisService.get<any>(cacheKey);
    if (cached) {
      this.logger.log(`Retrieved cached user learning analytics for ${userId}`);
      return typeof cached === 'string' ? JSON.parse(cached) : cached;
    }

    const analytics = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        quizAttempts: {
          select: {
            score: true,
            completedAt: true,
            quiz: {
              select: {
                title: true,
                description: true,
              },
            },
          },
        },
        // unitCompletions: {
        //   select: {
        //     score: true,
        //     completedAt: true,
        //     unit: {
        //       select: {
        //         title: true,
        //       },
        //     },
        //   },
        // },
        userActivities: {
          select: {
            type: true,
            description: true,
            createdAt: true,
          },
        },
      },
    });

    await this.redisService.set(
      cacheKey,
      JSON.stringify(analytics),
      this.cacheTtl,
    );
    return analytics;
  }

  /**
   * Get consolidated analytics across all users/assessments
   * (merged from consolidated-analytics.service.ts)
   */
  async getConsolidatedAnalytics(): Promise<any> {
    const cacheKey = 'consolidated-analytics:all:v2';
    try {
      const cached = await this.redisService.get<any>(cacheKey);
      if (cached) {
        return typeof cached === 'string' ? JSON.parse(cached) : cached;
      }

      const analytics = await this.callGrpc(
        this.analyticsServiceGrpc.getSystemAnalytics({}),
      );
      const result = {
        coursesCompleted: analytics.completedCourses,
        averageScore: Math.round(analytics.averageAssessmentScore),
        totalStudyHours: Math.round(analytics.totalStudyTimeMinutes / 60),
        overview: {
          totalUsers: analytics.totalUsers,
          activeUsers: analytics.activeLearners,
          completionRate: Math.round(analytics.averageCompletionRate),
        },
      };

      await this.redisService.set(cacheKey, result, this.cacheTtl);
      return result;
    } catch (error) {
      this.logger.error(
        `Failed to get consolidated analytics from Rust: ${getErrorMessage(error)}`,
      );
      throw error;
    }
  }

  /**
   * Get assessment-level analytics by assessment ID
   * (merged from consolidated-analytics.service.ts - note: this overlaps with existing getAssessmentAnalytics)
   */
  async getConsolidatedAssessmentAnalytics(assessmentId: string): Promise<any> {
    const cacheKey = `assessment:${assessmentId}`;
    const cached = await this.redisService.get<any>(cacheKey);
    if (cached) {
      this.logger.log(
        `Retrieved cached assessment analytics for ${assessmentId}`,
      );
      return typeof cached === 'string' ? JSON.parse(cached) : cached;
    }

    const analytics = await this.prisma.quiz.findUnique({
      where: { id: assessmentId },
      select: {
        title: true,
        description: true,
        attempts: {
          select: {
            score: true,
            completedAt: true,
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                username: true,
              },
            },
          },
        },
        questionCount: true,
        passingScore: true,
      },
    });

    await this.redisService.set(
      cacheKey,
      JSON.stringify(analytics),
      this.cacheTtl,
    );
    return analytics;
  }
}
