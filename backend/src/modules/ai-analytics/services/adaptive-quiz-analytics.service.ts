import { Injectable, Logger, Inject, OnModuleInit } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { PrismaService } from '#infrastructure/prisma/prisma.service';
import { RedisService } from '#infrastructure/redis/redis.service';
import {
  UserPerformanceProfileDto,
  SubmitAnswerDto,
  AdaptiveQuizSession,
} from '#common/dto';
import { Question } from '@prisma/client';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { firstValueFrom, timeout, Observable } from 'rxjs';
import { retry } from 'rxjs/operators';
import { RequestDeduplicationService } from './request-deduplication.service';
import { AnalyticsService } from '#infrastructure/grpc/analytics.client';
import { AssessmentAnalyticsService } from './assessment-analytics.service';
import { PerformanceMetricsService } from '#infrastructure/monitoring/performance-metrics.service';

/**
 * AdaptiveQuizAnalyticsService
 *
 * Domain-specific service for adaptive quiz analytics and management.
 * Handles IRT (Item Response Theory) based adaptive testing, session management,
 * and performance tracking.
 *
 * Used by:
 * - adaptive-quiz.service.ts (in education/assessment module)
 * - Quiz controllers in education/assessment
 *
 * This service consolidates adaptive quiz logic and is injected into
 * the education assessment services as needed.
 */
@Injectable()
@ApiTags('adaptive-quiz-analytics')
export class AdaptiveQuizAnalyticsService implements OnModuleInit {
  private readonly logger = new Logger(AdaptiveQuizAnalyticsService.name);
  private readonly cacheTtl = 3600; // 1 hour default TTL
  private readonly grpcTimeoutMs = 30000;
  private readonly grpcRetries = 2;
  private analyticsServiceGrpc!: AnalyticsService;

  constructor(
    @Inject('ANALYTICS_PACKAGE') private readonly grpcClient: ClientGrpc,
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly performanceMetrics: PerformanceMetricsService,
    private readonly requestDeduplicationService: RequestDeduplicationService,
    private readonly assessmentAnalyticsService: AssessmentAnalyticsService,
  ) {}

  onModuleInit() {
    this.analyticsServiceGrpc =
      this.grpcClient.getService<AnalyticsService>('AnalyticsService');
  }

  /**
   * Call gRPC method with timeout and retry logic
   */
  private async callGrpc<T>(
    call: Observable<T>,
    timeoutMs: number = this.grpcTimeoutMs,
  ): Promise<T> {
    return firstValueFrom(
      call.pipe(
        timeout(timeoutMs),
        retry({ count: this.grpcRetries, delay: 500 }),
      ),
    );
  }

  /**
   * Start a new adaptive quiz session using gRPC-first approach
   * Gets user ability from Rust analytics engine
   */
  @ApiOperation({ summary: 'Initialize adaptive quiz session' })
  @ApiResponse({ status: 201, description: 'Session started' })
  async startAdaptiveQuiz(
    userId: string,
    courseId?: string,
    unitId?: string,
  ): Promise<AdaptiveQuizSession> {
    // Delegate to consolidated AssessmentAnalyticsService
    return this.assessmentAnalyticsService.startAdaptiveQuiz(
      userId,
      courseId,
      unitId,
    );
  }

  /**
   * Submit answer and get next question using gRPC-first adaptation
   * Delegates to Rust service for next adaptive question selection based on IRT
   */
  @ApiOperation({ summary: 'Submit answer and get adaptive feedback' })
  @ApiResponse({ status: 200, description: 'Answer processed' })
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
    return this.assessmentAnalyticsService.submitAnswer(
      sessionId,
      dto,
      confidence,
    );
  }

  /**
   * Get user's current performance profile via gRPC-first with caching and dedup
   * Uses Rust analytics engine to compute ability scores and learning metrics
   */
  async getUserPerformanceProfile(
    userId: string,
  ): Promise<UserPerformanceProfileDto> {
    // Delegate to consolidated assessment analytics implementation
    return this.assessmentAnalyticsService.getUserPerformanceProfile(userId);
  }

  /**
   * Finalize quiz session and store results
   */
  async finalizeSession(session: AdaptiveQuizSession): Promise<void> {
    return this.assessmentAnalyticsService.finalizeSession(session);
  }

  /**
   * Check if quiz should continue (IRT stopping criterion)
   */
  private shouldContinueQuiz(session: AdaptiveQuizSession): boolean {
    return this.assessmentAnalyticsService['shouldContinueQuiz'](session);
  }

  /**
   * Get active session
   */
  async getSession(
    userId: string,
    sessionId: string,
  ): Promise<AdaptiveQuizSession | undefined> {
    return this.assessmentAnalyticsService.getSession(userId, sessionId);
  }

  /**
   * Invalidate user's adaptive profile cache
   */
  async invalidateUserProfile(userId: string): Promise<void> {
    return this.assessmentAnalyticsService.invalidateUserProfile(userId);
  }

  /**
   * Get next adaptive question from Rust service (gRPC-first)
   */
  async getNextAdaptiveQuestion(userId: string): Promise<{
    questionId: string;
    recommendedDifficulty: number;
  } | null> {
    return this.assessmentAnalyticsService.getNextAdaptiveQuestion(userId);
  }
}
