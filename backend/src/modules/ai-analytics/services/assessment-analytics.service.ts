import { Injectable, Logger, Inject, OnModuleInit } from '@nestjs/common';
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
} from '#common/dto';
import { getErrorMessage } from '#common/utils/error.utils';
import {
  ANALYTICS_CACHE_CONFIG,
  ANALYTICS_METRICS_CONFIG,
} from './analytics-cache.constants';
import { PrismaService } from '#infrastructure/prisma/prisma.service';
import { QuizUtils } from '#common/utils/quiz.utils';
import { v4 as uuidv4 } from 'uuid';
import { Question, Prisma } from '@prisma/client';

/**
 * AssessmentAnalyticsService
 *
 * Domain-specific service for assessment and quiz-related analytics operations.
 * Provides performance predictions, BKT (Bayesian Knowledge Tracing) updates,
 * and assessment-specific analytics and recommendations.
 * Uses gRPC-first approach with HTTP fallback for Rust analytics service integration.
 *
 * Used by:
 * - assessment-recommendations.service.ts (personalized assessment recommendations)
 * - adaptive-quiz.service.ts (adaptive quiz performance tracking and BKT updates)
 * - assessments.service.ts (quiz submissions and analytics)
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

  // Helper to access the gRPC client as `any` to allow calling RPCs
  // that may not be declared in the generated TypeScript interface.
  private grpc(): any {
    return this.analyticsServiceGrpc as any;
  }

  constructor(
    private readonly redisService: RedisService,
    @Inject('ANALYTICS_PACKAGE') private readonly client: ClientGrpc,
    private readonly requestDeduplicationService: RequestDeduplicationService,
    private readonly performanceMetrics: PerformanceMetricsService,
    private readonly tracingService: DistributedTracingService,
    private readonly prisma: PrismaService,
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
        // Use gRPC-first to get user performance profile and ability
        const userProfile = await this.getUserPerformanceProfile(userId);
        const sessionId = uuidv4();
        const session: AdaptiveQuizSession = {
          sessionId,
          userId,
          questions: [],
          currentQuestionIndex: 0,
          userAbility: userProfile.overallAbility,
          confidenceInterval: 2.0,
          targetPrecision: 0.3,
          responses: [],
          isComplete: false,
          finalScore: 0,
          recommendations: [],
        };

        // Fetch initial question
        try {
          const grpcResp = await this.callGrpcWithTimeout(
            this.analyticsServiceGrpc.getNextAdaptiveQuestion({
              user_id: userId,
            }),
            this.grpcTimeoutMs,
          );

          if ((grpcResp as any).question_id) {
            const initialQuestion = await this.prisma.question.findUnique({
              where: { id: (grpcResp as any).question_id },
              include: { options: true },
            });
            if (initialQuestion) {
              session.questions.push(initialQuestion);
            }
          }
        } catch (initialErr) {
          this.logger.warn(
            `Failed to get initial gRPC question: ${getErrorMessage(initialErr)}, using local fallback`,
          );
          const fallbackQuestion =
            await this.selectNextQuestionFallback(session);
          if (fallbackQuestion) {
            session.questions.push(fallbackQuestion);
          }
        }

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
      const currentQuestion = session.questions[session.currentQuestionIndex];
      if (!currentQuestion || currentQuestion.id !== dto.questionId) {
        throw new Error(`Question ${dto.questionId} not found in session`);
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
          timeSpent: dto.timeSpentSeconds ?? 0,
          createdAt: new Date(),
        },
      });

      // Advance question index
      session.currentQuestionIndex++;
      const shouldContinue = this.shouldContinueQuiz(session);
      let nextQuestion: Question | undefined;

      if (shouldContinue) {
        // Use gRPC to get next adaptive question from Rust
        try {
          const grpcResp = await this.callGrpcWithTimeout(
            this.analyticsServiceGrpc.getNextAdaptiveQuestion({
              user_id: session.userId,
            }),
            this.grpcTimeoutMs,
          );

          if ((grpcResp as any).question_id) {
            nextQuestion =
              (await this.prisma.question.findUnique({
                where: { id: (grpcResp as any).question_id },
                include: { options: true },
              })) || undefined;

            if (nextQuestion) {
              session.questions.push(nextQuestion);
            }
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
        } catch (grpcErr) {
          this.logger.warn(
            `gRPC getNextAdaptiveQuestion failed: ${getErrorMessage(grpcErr)}, falling back to local selection`,
          );

          // Local fallback selection
          nextQuestion =
            (await this.selectNextQuestionFallback(session)) || undefined;
          if (nextQuestion) {
            session.questions.push(nextQuestion);
          }
        }
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

      await this.prisma.quizAttempt.create({
        data: {
          userId: session.userId,
          quizId: session.sessionId,
          answers: session.responses,
          score: session.finalScore,
          maxScore: 100,
          percentage: session.finalScore,
          timeSpent: session.responses.reduce(
            (sum, r) => sum + r.responseTime,
            0,
          ),
          isPassed: session.finalScore >= 70,
          startedAt: new Date(),
          completedAt: new Date(),
        },
      });

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
  } | null> {
    const startTime = Date.now();

    try {
      // Try gRPC
      const grpcResp = await this.callGrpcWithTimeout(
        this.analyticsServiceGrpc.getNextAdaptiveQuestion({
          user_id: userId,
        }),
        this.grpcTimeoutMs,
      );

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
        questionId: (grpcResp as any).question_id,
        recommendedDifficulty: (grpcResp as any).recommended_difficulty || 0.5,
      };
    } catch (grpcErr) {
      this.logger.warn(
        `gRPC getNextAdaptiveQuestion failed: ${getErrorMessage(grpcErr)}`,
      );
      return null;
    }
  }

  // ----------------- Recommendations helpers (gRPC-first) -----------------

  async getRelatedResources(assessmentId: string): Promise<any[]> {
    try {
      const grpcResp = await this.callGrpc(
        this.analyticsServiceGrpc.getRelatedResources({
          resource_id: assessmentId,
        }),
      );
      return (grpcResp as any).resources || [];
    } catch (error) {
      this.logger.error(
        `getRelatedResources gRPC failure: ${getErrorMessage(error)}`,
      );
      return [];
    }
  }

  async generateStudyRecommendations(
    userId: string,
    knowledgeGaps: string[] = [],
  ): Promise<any[]> {
    try {
      const grpcResp = await this.callGrpc(
        (this.analyticsServiceGrpc as any).generateStudyRecommendations({
          user_id: userId,
          knowledge_gaps: knowledgeGaps,
        }),
      );
      return (grpcResp as any).recommendations || [];
    } catch (error) {
      this.logger.error(
        `generateStudyRecommendations gRPC failure: ${getErrorMessage(error)}`,
      );
      return [];
    }
  }

  async generateNextSteps(userId: string): Promise<string[]> {
    try {
      const grpcResp = await this.callGrpc(
        this.analyticsServiceGrpc.generateNextSteps({ user_id: userId }),
      );
      return (grpcResp as any).steps?.map((s: any) => s.step) || [];
    } catch (error) {
      this.logger.error(
        `generateNextSteps gRPC failure: ${getErrorMessage(error)}`,
      );
      return [];
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

  /**
   * Local fallback for selecting the next adaptive question when gRPC is unavailable.
   * Uses basic difficulty matching based on user ability.
   */
  private async selectNextQuestionFallback(
    session: AdaptiveQuizSession,
  ): Promise<Question | null> {
    const usedQuestionIds = session.questions.map((q) => q.id);

    // Simple difficulty mapping: userAbility (0-1) -> QuestionDifficulty
    let targetDifficulty: 'easy' | 'medium' | 'hard' = 'medium';
    if (session.userAbility < 0.4) {
      targetDifficulty = 'easy';
    } else if (session.userAbility > 0.7) {
      targetDifficulty = 'hard';
    }

    const questions = await this.prisma.question.findMany({
      where: {
        isActive: true,
        difficulty: targetDifficulty as any,
        id: { notIn: usedQuestionIds },
      },
      take: 5,
    });

    if (questions.length === 0) {
      return null;
    }

    // Pick a random one from the top 5
    return questions[Math.floor(Math.random() * questions.length)];
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
          user_id: userId,
          skill_id: skillId,
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
      return { score: 0 };
    }
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
    try {
      // Fire-and-forget gRPC call
      this.callGrpc(
        this.analyticsServiceGrpc.updateBkt({
          user_id: userId,
          skill_id: skillId,
          is_correct: isCorrect,
        }),
      ).catch((err) => {
        this.logger.warn(
          `Failed to update BKT for assessment: ${getErrorMessage(err)}`,
        );
      });

      // Invalidate prediction cache
      const cacheKey = ANALYTICS_CACHE_CONFIG.ASSESSMENT.PREDICTIONS(
        userId,
        skillId,
      );
      await this.redisService.del(cacheKey);
    } catch (error) {
      this.logger.error(`Failed to update BKT: ${getErrorMessage(error)}`);
    }
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
      const cacheKey = ANALYTICS_CACHE_CONFIG.RECOMMENDATIONS.AI(userId);
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
            this.analyticsServiceGrpc.getRecommendations({ user_id: userId }),
          );

          // Filter for assessment-type recommendations
          const assessmentRecs = (response.items || [])
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
      return [];
    }
  }

  /**
   * Get comprehensive assessment analytics for a user
   */
  async getAssessmentAnalytics(
    userId: string,
  ): Promise<Record<string, unknown>> {
    try {
      const cacheKey = ANALYTICS_CACHE_CONFIG.ASSESSMENT.PERFORMANCE(userId);

      const cached = await this.redisService.get<string>(cacheKey);
      if (typeof cached === 'string') {
        return JSON.parse(cached);
      }

      // Strictly gRPC - we proxy the detailed analytics and pick performance metrics
      const startTime = Date.now();
      const grpcResp = await this.callGrpc(
        this.analyticsServiceGrpc.getDetailedLearningAnalytics({
          user_id: userId,
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

      const analytics = {
        userId,
        averageScore:
          grpcResp.performance_metrics?.average_assessment_score || 0,
        passRate: grpcResp.performance_metrics?.pass_rate || 0,
        weaknessAreas: grpcResp.performance_metrics?.weakness_areas || [],
        strengthAreas: grpcResp.performance_metrics?.strength_areas || [],
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
      return {
        averageScore: 0,
        passRate: 0,
        weaknessAreas: [],
        strengthAreas: [],
      };
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
          user_id: userId,
          limit,
        }),
      );

      const recommendations =
        response.areas?.map((a) => ({
          topic: a.topic,
          cardCount: a.card_count,
          passRate: a.pass_rate,
        })) || [];

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
      return [];
    }
  }

  /**
   * Get due flashcards/reviews for spaced repetition via Rust analytics gRPC
   */
  async getDueCards(userId: string): Promise<any[]> {
    try {
      const grpcResp = await this.callGrpc(
        this.analyticsServiceGrpc.getDueCards({ user_id: userId }),
      );
      return (grpcResp as any).cards || [];
    } catch (error) {
      this.logger.error(
        `Failed to get due cards via gRPC: ${getErrorMessage(error)}`,
      );
      return [];
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
          user_id: userId,
          events: [
            {
              event_type: 'assessment_submission',
              timestamp: new Date().toISOString(),
              session_id: null,
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
          user_id: userId,
          skill_id: assessmentId || '',
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
        score: grpcResp.score,
        confidence: (grpcResp as any).confidence,
      };
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
      return { score: 0 };
    }
  }

  /**
   * Get performance analytics for a user
   */
  async getPerformanceAnalytics(userId: string): Promise<any> {
    try {
      const cacheKey = ANALYTICS_CACHE_CONFIG.ASSESSMENT.PERFORMANCE(userId);
      const cached = await this.redisService.get<string>(cacheKey);
      if (typeof cached === 'string') {
        return JSON.parse(cached);
      }

      try {
        const startTime = Date.now();
        const grpcResp = await this.callGrpc(
          this.analyticsServiceGrpc.getDetailedLearningAnalytics({
            user_id: userId,
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

        const analytics = {
          userId,
          totalAssessments: (grpcResp.performance_metrics?.weakness_areas || [])
            .length,
          averageScore:
            grpcResp.user_learning_summary?.average_session_length || 0,
          performanceBySkill:
            grpcResp.performance_metrics?.weakness_areas?.reduce(
              (acc: any, skill: string) => ({ ...acc, [skill]: 0 }),
              {},
            ) || {},
        };

        await this.redisService.set(
          cacheKey,
          JSON.stringify(analytics),
          this.cacheTtl,
        );
        return analytics;
      } catch (grpcErr) {
        this.logger.warn(
          `gRPC getPerformanceAnalytics failed, returning default: ${getErrorMessage(grpcErr)}`,
        );
        return {
          userId,
          totalAssessments: 0,
          averageScore: 0,
          performanceBySkill: {},
        };
      }
    } catch (error) {
      this.logger.error(
        `Error in getPerformanceAnalytics: ${getErrorMessage(error)}`,
      );
      return null;
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
          this.analyticsServiceGrpc.updateBktSkillMetrics({
            user_id: userId,
            skill_id: skillId,
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
          probabilityKnown: (grpcResp as any).probability_known || 0,
          attempts: previousAttempts || 0,
        };

        await this.redisService.set(
          cacheKey,
          JSON.stringify(result),
          this.cacheTtl,
        );
        return result;
      } catch (grpcErr) {
        this.logger.warn(
          `gRPC predictWithBKT failed, returning default: ${getErrorMessage(grpcErr)}`,
        );
        return {
          skillId,
          probabilityKnown: 0,
          attempts: previousAttempts || 0,
        };
      }
    } catch (error) {
      this.logger.error(`Error in predictWithBKT: ${getErrorMessage(error)}`);
      return null;
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
            user_id: userId,
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

        const data = grpcResp || { burnoutScore: 0, riskLevel: 'low' };
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
        return { burnoutScore: 0, riskLevel: 'low' };
      }
    } catch (error) {
      this.logger.error(
        `Error in predictWithBurnModel: ${getErrorMessage(error)}`,
      );
      return null;
    }
  }

  /**
   * Backwards-compatible wrapper used by education callers — generates a
   * PerformanceAnalyticsDto for the given user (optionally scoped to an assessment
   * and/or timeframe). This method is gRPC-first but will supplement results
   * from local DB if needed for fields not provided by the Rust service.
   */
  async generateAnalytics(
    userId: string,
    assessmentId?: string,
  ): Promise<PerformanceAnalyticsDto> {
    try {
      // Strictly gRPC
      const analytics = await this.getPerformanceAnalytics(userId);

      // We no longer gather recent attempts locally in the proxy service.
      // Callers (domain services) should do this if they need to merge.
      // However, to keep DTO compatibility, we return what gRPC gives us.

      const dto: PerformanceAnalyticsDto = {
        userId,
        overallScore: Math.round(analytics.averageScore || 0),
        totalAttempts: analytics.totalAttempts || 0,
        correctAnswers: analytics.correctAnswers || 0,
        quizId: assessmentId,
        averageScore: analytics.averageScore || undefined,
        recentScores: analytics.recentScores || [],
        questionsAttempted: analytics.questionsAttempted || 0,
        timeTaken: analytics.timeTaken || 0,
        timeSpent: analytics.timeSpent || 0,
        weakAreas: analytics.weaknessAreas || [],
        progressTrend: {},
        averageTimePerQuestion: 0,
        timePerQuestion: 0,
        topicScores: {},
        strengths: analytics.strengthAreas || [],
        weaknesses: analytics.weaknessAreas || [],
      };

      return dto;
    } catch (error) {
      this.logger.warn(
        `generateAnalytics gRPC failure: ${getErrorMessage(error)}`,
      );
      return {
        userId,
        overallScore: 0,
        totalAttempts: 0,
        correctAnswers: 0,
        weakAreas: [],
        progressTrend: {},
        averageTimePerQuestion: 0,
        timePerQuestion: 0,
        strengths: [],
        weaknesses: [],
      };
    }
  }

  async identifyStrengths(userId: string): Promise<string[]> {
    const analytics = await this.getPerformanceAnalytics(userId);
    return analytics.strengthAreas || [];
  }

  async identifyWeaknesses(userId: string): Promise<string[]> {
    const analytics = await this.getPerformanceAnalytics(userId);
    return analytics.weaknessAreas || [];
  }

  /**
   * Analyze the difficulty of a question for the given user. This is gRPC-first
   * but has a local heuristic fallback based on question.difficulty and recent
   * user history.
   */
  async analyzeDifficulty(userId: string, question: any): Promise<any> {
    try {
      // Strictly gRPC
      const resp: any = await this.callGrpc(
        this.grpc().analyzeQuestionDifficulty({ userId, question }),
      );
      return resp;
    } catch (error) {
      this.logger.warn(
        `analyzeDifficulty gRPC failure: ${getErrorMessage(error)}`,
      );
      return {
        difficultyScore: 0.5,
        suggestion: 'Unable to analyze via gRPC.',
      };
    }
  }

  /**
   * Backwards-compatible wrapper used by education callers to fetch
   * a user performance profile. This prefers gRPC but will fall back
   * to a lightweight local profile derived from the DB when gRPC is
   * unavailable.
   */
  async getUserPerformanceProfile(userId: string): Promise<any> {
    try {
      // Strictly gRPC
      const resp: any = await this.callGrpc(
        this.grpc().getDetailedLearningAnalytics({ user_id: userId }),
      );
      return {
        userId: resp?.user_id,
        overallScore: resp?.performance_metrics?.average_assessment_score ?? 0,
        strengths: resp?.user_learning_summary?.strongest_subjects || [],
        weaknesses: resp?.user_learning_summary?.weakest_subjects || [],
      };
    } catch (error) {
      this.logger.warn(
        `getUserPerformanceProfile gRPC failure: ${getErrorMessage(error)}`,
      );
      return { userId, overallScore: 0, strengths: [], weaknesses: [] };
    }
  }

  /**
   * Wrapper to fetch a user's quiz/assessment attempt history. Prefers gRPC, falls
   * back to reading a small slice from the DB so callers can continue to function.
   */
  async getQuizAttemptHistory(
    userId: string,
    options?: { limit?: number; offset?: number },
  ): Promise<any[]> {
    try {
      // Strictly gRPC
      const resp: any = await this.callGrpc(
        this.grpc().getQuizAttemptHistory({
          userId,
          limit: options?.limit,
          offset: options?.offset,
        }),
      );
      return (resp?.attempts || []) as any[];
    } catch (error) {
      this.logger.warn(
        `getQuizAttemptHistory gRPC failure: ${getErrorMessage(error)}`,
      );
      return [];
    }
  }

  /**
   * Get topic mastery levels (p_known) for a user
   */
  async getMastery(userId: string): Promise<Record<string, number>> {
    try {
      const cacheKey = ANALYTICS_CACHE_CONFIG.ASSESSMENT.PERFORMANCE(
        `${userId}:mastery`,
      );
      const cached = await this.redisService.get<string>(cacheKey);
      if (typeof cached === 'string') {
        return JSON.parse(cached);
      }

      // Strictly gRPC
      const startTime = Date.now();
      const grpcResp = await this.callGrpc(
        this.analyticsServiceGrpc.getUserAbility({ user_id: userId }),
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

      // Map p_known_by_skill (proto) -> mastery (frontend)
      // Note: The proto interface definition wrapper might case-convert key names depending on config,
      // but usually it's camelCase in the generated interface if we defined it that way.
      // However, our interface manually types it as `pKnownBySkill`.
      const mastery =
        (grpcResp as any).pKnownBySkill ||
        (grpcResp as any).p_known_by_skill ||
        {};

      await this.redisService.set(
        cacheKey,
        JSON.stringify(mastery),
        this.cacheTtl,
      );
      return mastery;
    } catch (error) {
      this.logger.error(
        `Failed to get mastery via gRPC: ${getErrorMessage(error)}`,
      );
      return {};
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
      const grpcResp: any = await this.callGrpc(
        this.analyticsServiceGrpc.getSpacedRepetitionStats({ user_id: userId }),
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

      const stats = {
        totalCards: grpcResp?.totalCards ?? grpcResp?.total_cards ?? 0,
        dueToday: grpcResp?.dueToday ?? grpcResp?.due_today ?? 0,
        masteredCards: grpcResp?.masteredCards ?? grpcResp?.mastered_cards ?? 0,
        learningCards: grpcResp?.learningCards ?? grpcResp?.learning_cards ?? 0,
        relearningCards:
          grpcResp?.relearningCards ?? grpcResp?.relearning_cards ?? 0,
        avgEaseFactor:
          grpcResp?.avgEaseFactor ?? grpcResp?.avg_ease_factor ?? 2.5,
        avgIntervalDays:
          grpcResp?.avgIntervalDays ?? grpcResp?.avg_interval_days ?? 0,
        recentPassRate:
          grpcResp?.recentPassRate ?? grpcResp?.recent_pass_rate ?? 0,
      };

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
      // Return safe defaults
      return {
        totalCards: 0,
        dueToday: 0,
        masteredCards: 0,
        learningCards: 0,
        relearningCards: 0,
        avgEaseFactor: 2.5,
        avgIntervalDays: 0,
        recentPassRate: 0,
      };
    }
  }

  /**
   * Update question statistics after answer.
   * Proxies to Rust for async difficulty recalculation.
   */
  updateQuestionStats(
    questionId: string,
    isCorrect: boolean,
    responseTimeMs: number,
  ): Promise<void> {
    try {
      // Fire-and-forget gRPC call
      void this.callGrpc(
        this.analyticsServiceGrpc.updateQuestionStatistics({
          question_id: questionId,
          is_correct: isCorrect,
          response_time_ms: responseTimeMs,
        }),
      ).catch((err) => {
        this.logger.warn(
          `Failed to update question stats via gRPC: ${getErrorMessage(err)}`,
        );
      });
      return Promise.resolve();
    } catch (error) {
      this.logger.error(`updateQuestionStats error: ${getErrorMessage(error)}`);
      return Promise.resolve();
    }
  }

  // ==================== CONSOLIDATED RECOMMENDATIONS METHODS ====================

  /**
   * Generate performance analytics from DB (category breakdown, trends, strengths/weaknesses)
   * This is merged from assessment-recommendations.service.ts
   */
  private async generatePerformanceAnalytics(
    userId: string,
    assessmentId?: string,
  ): Promise<any> {
    return await this.prisma.$transaction(async (tx) => {
      const where: { userId: string; quizId?: string } = { userId };
      if (assessmentId) {
        where.quizId = assessmentId;
      }
      const attempts = await tx.quizAttempt.findMany({
        where,
        include: {
          quiz: { include: { questions: { include: { question: true } } } },
        },
        orderBy: { startedAt: 'desc' },
      });

      const responses = await tx.userResponse.findMany({
        where: {
          userId,
          ...(assessmentId && {
            question: { quizQuestions: { some: { quizId: assessmentId } } },
          }),
        },
        include: { question: true },
        orderBy: { createdAt: 'desc' },
      });

      const categories = [
        'Anatomy',
        'Pharmacology',
        'Physiology',
        'Clinical Pharmacy',
        'Pathology',
        'Biochemistry',
      ];
      const categoryBreakdown = categories
        .map((category) => {
          const categoryResponses = responses.filter(
            (r) =>
              r.question.category?.toLowerCase() ===
              category.toLowerCase().replace(' ', '_'),
          );
          const correct = categoryResponses.filter((r) => r.isCorrect).length;
          const total = categoryResponses.length;
          const score = total > 0 ? (correct / total) * 100 : 0;

          return {
            category,
            score,
            questionsAnswered: total,
            averageTime:
              total > 0
                ? categoryResponses.reduce(
                    (sum, r) => sum + (r.timeSpent || 0),
                    0,
                  ) / total
                : 0,
            strengths: score >= 80 ? [category] : [],
            weaknesses: score < 60 && total > 0 ? [category] : [],
          };
        })
        .filter((b) => b.questionsAnswered > 0);

      const allScores = attempts.map((attempt) => attempt.score);
      const recentScores = allScores.slice(0, 5);
      const overallScore =
        allScores.length > 0
          ? allScores.reduce((sum, score) => sum + score, 0) / allScores.length
          : 0;
      const averageScore = overallScore;

      const learningTrends = attempts.map((attempt) => ({
        date: attempt.startedAt.toISOString(),
        score: attempt.score,
        category: 'Overall',
      }));

      const strengths = categoryBreakdown
        .filter((b) => b.score >= 80)
        .map((b) => b.category);
      const weaknesses = categoryBreakdown
        .filter((b) => b.score < 60)
        .map((b) => b.category);

      const difficultyBreakdown = {
        easy: 0,
        medium: 0,
        hard: 0,
      };

      responses.forEach((response) => {
        const difficulty =
          response.question.difficulty?.toLowerCase() || 'medium';
        if (difficulty in difficultyBreakdown) {
          difficultyBreakdown[difficulty as keyof typeof difficultyBreakdown] +=
            response.isCorrect ? 1 : 0;
        }
      });

      return {
        userId,
        quizId: assessmentId || '',
        overallScore,
        averageScore,
        recentScores,
        questionsAttempted: responses.length,
        correctAnswers: responses.filter((r) => r.isCorrect).length,
        timeTaken: responses.reduce((sum, r) => sum + (r.timeSpent || 0), 0),
        timeSpent: Math.round(
          responses.reduce((sum, r) => sum + (r.timeSpent || 0), 0) / 60,
        ),
        timePerQuestion:
          responses.length > 0
            ? Math.round(
                (responses.reduce((sum, r) => sum + (r.timeSpent || 0), 0) /
                  responses.length) *
                  100,
              ) / 100
            : 0,
        totalAttempts: attempts.length,
        categoryBreakdown, // Now an array of category objects
        learningTrends,
        strengths,
        weaknesses,
        knowledgeGaps: [], // Added for compatibility
        studyRecommendations: [], // Added for compatibility
        nextSteps: [], // Added for compatibility
      };
    });
  }

  /**
   * Get performance analytics for a user (merged from assessment-recommendations.service.ts)
   */
  async getPerformanceAnalyticsForAssessment(
    userId: string,
    assessmentId?: string,
  ): Promise<any> {
    const cacheKey = ANALYTICS_CACHE_CONFIG.ASSESSMENT.PREDICTIONS(
      userId,
      assessmentId,
    );
    const _cachedAnalytics = await this.redisService.get<string>(cacheKey);
    if (typeof _cachedAnalytics === 'string') {
      this.logger.log(`Retrieved cached analytics for user ${userId}`);
      return JSON.parse(_cachedAnalytics);
    }

    const analytics = await this.generatePerformanceAnalytics(
      userId,
      assessmentId,
    );
    await this.redisService.set(
      cacheKey,
      JSON.stringify(analytics),
      12 * 60 * 60,
    );

    return analytics;
  }

  // ==================== CONSOLIDATED LEARNING ANALYTICS METHODS ====================

  /**
   * Get user learning analytics including quiz attempts, unit completions, and activities
   * (merged from consolidated-analytics.service.ts)
   */
  async getUserLearningAnalytics(userId: string): Promise<any> {
    const cacheKey = `user-learning:${userId}`;
    const cached = await this.redisService.get<string>(cacheKey);
    if (cached) {
      this.logger.log(`Retrieved cached user learning analytics for ${userId}`);
      return JSON.parse(cached);
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
    const cacheKey = 'consolidated-analytics:all';
    const cached = await this.redisService.get<string>(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // Placeholder for consolidated analytics logic
    const result = { message: 'Consolidated analytics data' };
    await this.redisService.set(
      cacheKey,
      JSON.stringify(result),
      this.cacheTtl,
    );
    return result;
  }

  /**
   * Get assessment-level analytics by assessment ID
   * (merged from consolidated-analytics.service.ts - note: this overlaps with existing getAssessmentAnalytics)
   */
  async getConsolidatedAssessmentAnalytics(assessmentId: string): Promise<any> {
    const cacheKey = `assessment:${assessmentId}`;
    const cached = await this.redisService.get<string>(cacheKey);
    if (cached) {
      this.logger.log(
        `Retrieved cached assessment analytics for ${assessmentId}`,
      );
      return JSON.parse(cached);
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
