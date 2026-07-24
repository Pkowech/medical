import { Injectable, Logger, Inject, OnModuleInit } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { PrismaService } from '#infrastructure/prisma/prisma.service';
import { RedisService } from '#infrastructure/redis/redis.service';
import { firstValueFrom, timeout, Observable } from 'rxjs';
import { retry } from 'rxjs/operators';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { getErrorMessage, getErrorStack } from '#common/utils/error.utils';
import { RequestDeduplicationService } from './request-deduplication.service';
import { AnalyticsService } from '#infrastructure/grpc/analytics.client';
import {
  ANALYTICS_CACHE_CONFIG,
  ANALYTICS_METRICS_CONFIG,
} from './analytics-cache.constants';
import { StudyAnalyticsService } from './study-analytics.service';
import { LearningAnalyticsService } from './learning-analytics.service';
import { UserAnalyticsService } from './user-analytics.service';
import { PerformanceMetricsService } from '#infrastructure/monitoring/performance-metrics.service';
import { DistributedTracingService } from '#infrastructure/monitoring/distributed-tracing.service';
import { ProgressiveRolloutService } from '#infrastructure/monitoring/progressive-rollout.service';
import { AssessmentAnalyticsService } from './assessment-analytics.service';
import { AdaptiveQuizAnalyticsService } from './adaptive-quiz-analytics.service';
import {
  UserPerformanceProfileDto,
  AssessmentHistoryDto,
} from '#common/dto/assessment.dto';
import {
  StudyPatternsResponseDto,
  PathAnalyticsResponseDto,
} from '#common/dto';
import {
  LearningAnalyticsDto,
  RecommendationItemDto,
  PerformancePredictionResponseDto,
} from '#common/dto/analytics.dto';

type JsonObject = { [key: string]: unknown };
type JsonArray = JsonObject[];

@Injectable()
export class AiAnalyticsService implements OnModuleInit {
  private readonly logger = new Logger(AiAnalyticsService.name);
  private readonly cacheTtl = 3600;
  private readonly grpcTimeoutMs = Number(
    process.env.RUST_GRPC_TIMEOUT_MS || 5000,
  );
  private readonly grpcRetries = Number(process.env.RUST_GRPC_RETRIES || 2);
  private readonly USE_RUST_RECOMMENDATIONS =
    process.env.USE_RUST_RECOMMENDATIONS !== 'false';

  private analyticsServiceGrpc!: AnalyticsService;

  // Helper to access the gRPC client as `any` to allow calling RPCs
  // that may not be declared in the generated TypeScript interface.
  private grpc(): any {
    return this.analyticsServiceGrpc as any;
  }

  // Accept a permissive observable/any so callers can use a casted `this.grpc()`
  // (some RPCs may not exist on the generated AnalyticsService typing).
  private async callGrpc<T = any>(obs: any): Promise<T> {
    // Try to treat as an Observable first; fall back to Promise if needed.
    try {
      return await firstValueFrom(
        (obs as Observable<T>).pipe(
          timeout(this.grpcTimeoutMs),
          retry(this.grpcRetries),
        ),
      );
    } catch (_e) {
      // If obs isn't an Observable, try awaiting it as a Promise-like value.
      // This keeps runtime behavior flexible while avoiding compile-time errors.

      return await obs;
    }
  }

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    @InjectQueue('analytics') private readonly analyticsQueue: Queue,
    private readonly requestDeduplicationService: RequestDeduplicationService,
    @Inject('ANALYTICS_PACKAGE') private readonly client: ClientGrpc,
    private readonly performanceMetrics: PerformanceMetricsService,
    private readonly tracingService: DistributedTracingService,
    private readonly rolloutService: ProgressiveRolloutService,
    private readonly studyAnalyticsService: StudyAnalyticsService,
    private readonly learningAnalyticsService: LearningAnalyticsService,
    private readonly userAnalyticsService: UserAnalyticsService,
    private readonly assessmentAnalyticsService: AssessmentAnalyticsService,
    private readonly adaptiveQuizAnalyticsService: AdaptiveQuizAnalyticsService,
  ) {}

  onModuleInit() {
    this.analyticsServiceGrpc =
      this.client.getService<AnalyticsService>('AnalyticsService');
  }

  getPersonalizedRecommendations(
    userId: string,
  ): Promise<RecommendationItemDto[]> {
    return this.learningAnalyticsService.getPathRecommendations(userId);
  }

  async getRecommendationsAI(userId: string): Promise<RecommendationItemDto[]> {
    const startTime = Date.now();
    const traceContext = this.tracingService.createTraceContext(userId);
    const span = await this.tracingService.startSpan(
      traceContext,
      'getRecommendations',
      'AiAnalyticsService',
      'grpc',
    );

    try {
      const cacheKey = ANALYTICS_CACHE_CONFIG.RECOMMENDATIONS.AI(userId);
      const cachedRaw = await this.redisService.get<string>(cacheKey);
      if (typeof cachedRaw === 'string') {
        try {
          const cached = JSON.parse(cachedRaw) as RecommendationItemDto[];
          const responseTimeMs = Date.now() - startTime;

          await this.performanceMetrics.recordMetric({
            endpoint: ANALYTICS_METRICS_CONFIG.ENDPOINTS.RECOMMENDATIONS,
            method: 'getRecommendationsAI',
            provider: ANALYTICS_METRICS_CONFIG.PROVIDERS.GRPC,
            userId,
            responseTimeMs,
            cacheHit: true,
            success: true,
            timestamp: new Date(),
          });

          this.tracingService.addTag(span, 'cache', 'hit');
          await this.tracingService.endSpan(span, 'success');
          return cached;
        } catch {
          // Continue to fetch fresh data
        }
      }

      const dedupKey = ANALYTICS_CACHE_CONFIG.DEDUP(cacheKey);
      const recommendations =
        await this.requestDeduplicationService.executeWithDedup(
          dedupKey,
          async () => {
            // Try gRPC
            try {
              const grpcResponse = await this.callGrpc(
                this.analyticsServiceGrpc.getRecommendations({
                  user_id: userId,
                }),
              );

              // Map gRPC RecommendationItem -> local RecommendationItem shape
              const items = (grpcResponse.items || []).map((i: any) => ({
                materialId: i.id ?? i.materialId ?? i.material_id ?? '',
                material_id: i.id ?? i.materialId ?? i.material_id ?? '',
                score: typeof i.score === 'number' ? i.score : 0,
                reason:
                  typeof i.reason === 'string' ? i.reason : (i.reason ?? ''),
              })) as RecommendationItemDto[];

              await this.performanceMetrics.recordMetric({
                endpoint: ANALYTICS_METRICS_CONFIG.ENDPOINTS.RECOMMENDATIONS,
                method: 'getRecommendationsAI',
                provider: ANALYTICS_METRICS_CONFIG.PROVIDERS.GRPC,
                userId,
                responseTimeMs: Date.now() - startTime,
                cacheHit: false,
                success: true,
                timestamp: new Date(),
              });

              return items;
            } catch (grpcError) {
              this.logger.error(
                `gRPC call for getRecommendations failed: ${typeof grpcError === 'object' && grpcError !== null && 'message' in grpcError ? (grpcError as any).message : String(grpcError)}`,
              );
              return [];
            }
          },
        );
      // Save to database
      await this.prisma.learningSuggestion.deleteMany({ where: { userId } });
      await this.prisma.learningSuggestion.createMany({
        data: recommendations
          .filter((rec) => rec.materialId)
          .map((rec) => ({
            userId,
            materialId: rec.materialId!,
            score: rec.score,
            reason: rec.reason ?? '',
          })),
      });

      // Cache result
      await this.redisService.set(
        cacheKey,
        JSON.stringify(recommendations),
        this.cacheTtl,
      );

      const responseTimeMs = Date.now() - startTime;
      // Record success metric
      await this.performanceMetrics.recordMetric({
        endpoint: ANALYTICS_METRICS_CONFIG.ENDPOINTS.RECOMMENDATIONS,
        method: 'getRecommendationsAI',
        provider: ANALYTICS_METRICS_CONFIG.PROVIDERS.GRPC,
        userId,
        responseTimeMs,
        cacheHit: false,
        success: true,
        timestamp: new Date(),
      });

      this.tracingService.addTag(span, 'cache', 'miss');
      await this.tracingService.endSpan(span, 'success');
      return recommendations;
    } catch (error) {
      const responseTimeMs = Date.now() - startTime;

      // Record failure metric
      await this.performanceMetrics.recordMetric({
        endpoint: ANALYTICS_METRICS_CONFIG.ENDPOINTS.RECOMMENDATIONS,
        method: 'getRecommendationsAI',
        provider: ANALYTICS_METRICS_CONFIG.PROVIDERS.GRPC,
        userId,
        responseTimeMs,
        cacheHit: false,
        success: false,
        errorMessage: getErrorMessage(error),
        timestamp: new Date(),
      });

      await this.tracingService.endSpan(span, 'error', getErrorMessage(error));

      this.logger.error(
        `Error in getRecommendationsAI: ${getErrorMessage(error)}`,
        getErrorStack(error),
      );
      return [];
    }
  }

  async trackEvent(
    userId: string,
    eventType: string,
    data: any,
    timestamp: string,
  ) {
    if (!userId || !eventType || !timestamp) {
      throw new Error('Missing required event data');
    }

    try {
      const result = await this.prisma.studyEvent.create({
        data: {
          userId,
          eventType,
          metadata: data,
          createdAt: new Date(timestamp),
        },
      });

      // Invalidate relevant caches when event is tracked
      await this.invalidateUserCaches(userId);

      return result;
    } catch (error) {
      this.logger.error(
        `Failed to track event for user ${userId}: ${getErrorMessage(error)}`,
      );
      throw new Error('Failed to track event');
    }
  }

  async batchTrackEvents(
    events: Array<{
      userId: string;
      eventType: string;
      data: any;
      timestamp: string;
    }>,
  ) {
    if (!events?.length) {
      this.logger.warn('Empty events array provided for batch tracking');
      return []; // Return empty result for empty input instead of throwing
    }

    // Group events by user
    const eventsByUser: Record<string, any[]> = {};
    events.forEach((e) => {
      if (!eventsByUser[e.userId]) {
        eventsByUser[e.userId] = [];
      }
      eventsByUser[e.userId].push(e);
    });

    const batchSize = 100;
    const results = [];

    for (let i = 0; i < events.length; i += batchSize) {
      const batch = events.slice(i, i + batchSize);
      try {
        // Store locally in database
        const studyEvents = await this.prisma.studyEvent.createMany({
          data: batch.map((e) => ({
            userId: e.userId,
            eventType: e.eventType,
            metadata: e.data,
            createdAt: new Date(e.timestamp),
          })),
        });
        results.push(studyEvents);
      } catch (error) {
        this.logger.error(
          `Failed to track batch of events: ${getErrorMessage(error)}`,
        );
        throw new Error('Failed to track batch events');
      }
    }

    // Also send events to Rust analytics service for batch processing
    try {
      for (const [userId, userEvents] of Object.entries(eventsByUser)) {
        await this.callGrpc(
          this.analyticsServiceGrpc.batchTrackEvents({
            user_id: userId,
            events: userEvents.map((e) => ({
              event_type: e.eventType,
              timestamp: e.timestamp,
              session_id: null,
              duration: e.data?.duration,
            })),
          }),
        );
        this.logger.debug(
          `Batch events for user ${userId} forwarded to Rust analytics service via gRPC`,
        );
      }
    } catch (error) {
      this.logger.warn(
        `Warning: Could not forward events to Rust via gRPC: ${getErrorMessage(error)}`,
      );
      // Don't throw - events are already stored locally
    }

    // Invalidate caches for all users involved in the batch
    for (const userId of Object.keys(eventsByUser)) {
      await this.invalidateUserCaches(userId);
    }

    // After forwarding events, refresh aggregated BKT skill metrics via gRPC
    try {
      const updateResp = await this.refreshBktSkillMetrics();
      if (!updateResp.success) {
        this.logger.warn(
          `refreshBktSkillMetrics responded with failure: ${updateResp.message}`,
        );
      }
    } catch (e) {
      this.logger.warn(
        `refreshBktSkillMetrics call failed: ${getErrorMessage(e)}`,
      );
    }

    return results;
  }

  private refreshBktSkillMetrics(): Promise<{
    success: boolean;
    message?: string;
  }> {
    try {
      void this.callGrpc(this.analyticsServiceGrpc.updateBktSkillMetrics({}));
      return Promise.resolve({ success: true });
    } catch (error) {
      return Promise.resolve({
        success: false,
        message: getErrorMessage(error),
      });
    }
  }

  /**
   * Invalidate all relevant caches for a given user.
   * This should be called whenever a user's data changes significantly (e.g., event tracked, quiz completed).
   */
  private async invalidateUserCaches(userId: string): Promise<void> {
    // Invalidate Redis caches
    await this.redisService.del(
      ANALYTICS_CACHE_CONFIG.RECOMMENDATIONS.AI(userId),
    );
    await this.redisService.del(
      ANALYTICS_CACHE_CONFIG.RECOMMENDATIONS.PERSONALIZED(userId),
    );
    await this.redisService.del(
      ANALYTICS_CACHE_CONFIG.LEARNING.PERFORMANCE_PROFILE(userId),
    );
    await this.redisService.del(
      ANALYTICS_CACHE_CONFIG.LEARNING.ANALYTICS(userId),
    );
    await this.redisService.del(
      ANALYTICS_CACHE_CONFIG.LEARNING.PATTERNS(userId),
    );
    // also clear goals/insights caches if present
    await this.redisService.del(ANALYTICS_CACHE_CONFIG.LEARNING.GOALS(userId));

    // Invalidate in-flight request deduplication cache
    this.requestDeduplicationService.invalidatePattern(`dedup:*:${userId}`);

    this.logger.debug(`Caches invalidated for user ${userId}`);
  }

  async getUserEngagementFromPrisma(userId: string): Promise<JsonObject> {
    // Delegate DB-backed engagement computation to UserAnalyticsService
    return this.userAnalyticsService.getUserEngagementFromPrisma(
      userId,
    );
  }

  /**
   * Get collaborative filtering recommendations from Rust service
   * Uses similarity-based filtering to recommend items liked by similar users
   * @deprecated Delegate to LearningAnalyticsService.getCollaborativeRecommendations()
   */
  async getCollaborativeRecommendations(
    userId: string,
    limit: number = 5,
  ): Promise<Array<{ item_id: string; score: number }>> {
    return this.learningAnalyticsService.getCollaborativeRecommendations(
      userId,
      limit,
    );
  }

  async getTrendingPaths(
    limit: number = 5,
  ): Promise<Array<{ path_id: string; enrollments: number }>> {
    // Delegate to consolidated learning analytics service
    return this.learningAnalyticsService.getTrendingPaths(limit);
  }

  /**
   * Get comprehensive user performance profile from Rust service
   * Includes performance metrics, learning patterns, and inferred attributes
   */
  async getUserPerformanceProfile(
    userId: string,
  ): Promise<UserPerformanceProfileDto> {
    // Delegate to AdaptiveQuizAnalyticsService which provides a DB-backed
    // user performance profile implementation used by adaptive flows.
    return this.adaptiveQuizAnalyticsService.getUserPerformanceProfile(userId);
  }

  async calculatePerformanceMetrics(userId: string): Promise<JsonObject> {
    // Delegate to LearningAnalyticsService
    return this.learningAnalyticsService.calculatePerformanceMetrics(
      userId,
    );
  }

  async analyzeStudyPatterns(
    userId: string,
  ): Promise<StudyPatternsResponseDto> {
    return this.studyAnalyticsService.analyzeStudyPatterns(userId);
  }

  async generatePredictions(userId: string): Promise<JsonObject> {
    // Delegate to UserAnalyticsService which provides a gRPC-backed prediction
    return this.userAnalyticsService.generatePredictions(
      userId,
    );
  }

  async getUserEngagement(userId: string): Promise<JsonObject> {
    // Delegate to LearningAnalyticsService
    return this.learningAnalyticsService.getUserEngagement(
      userId,
    );
  }

  async getPathAnalytics(pathId: string): Promise<PathAnalyticsResponseDto> {
    // Delegate to LearningAnalyticsService
    return this.learningAnalyticsService.getPathAnalytics(pathId);
  }

  async getQuizAttemptHistory(
    userId: string,
    options?: { limit?: number; offset?: number },
  ): Promise<AssessmentHistoryDto[]> {
    // Delegate to AssessmentAnalyticsService
    return this.assessmentAnalyticsService.getQuizAttemptHistory(
      userId,
      options,
    ) as Promise<AssessmentHistoryDto[]>;
  }

  async predictPerformance(
    userId: string,
    assessmentId?: string,
  ): Promise<PerformancePredictionResponseDto> {
    // Delegate to AssessmentAnalyticsService and adapt shape
    try {
      const resp =
        await this.assessmentAnalyticsService.predictAssessmentPerformance(
          userId,
          assessmentId ?? '',
        );

      return {
        predictedScore: resp.score,
        confidenceInterval: [0, 0],
        riskLevel: 'unknown',
        successProbability: 0,
      };
    } catch (error) {
      this.logger.error(
        `Error predicting performance: ${getErrorMessage(error)}`,
      );
      return {
        predictedScore: 0,
        confidenceInterval: [0, 0],
        riskLevel: 'unknown',
        successProbability: 0,
      };
    }
  }

  getPerformanceAnalytics(userId: string): Promise<JsonObject> {
    // Delegate to AssessmentAnalyticsService
    return this.assessmentAnalyticsService.getAssessmentAnalytics(
      userId,
    );
  }

  async getRelatedResources(assessmentId: string): Promise<JsonArray> {
    // Delegate to consolidated AssessmentAnalyticsService
    return this.assessmentAnalyticsService.getRelatedResources(
      assessmentId,
    ) as Promise<JsonArray>;
  }

  async generateStudyRecommendations(
    userId: string,
    knowledgeGaps: string[],
  ): Promise<JsonArray> {
    // Delegate to consolidated learning analytics service
    const results =
      await this.learningAnalyticsService.generateStudyRecommendations(
        userId,
        knowledgeGaps,
      );
    return results;
  }

  // Backwards-compatible alias used by some callers/controllers
  // Older code expects `generateRecommendations(userId)` — delegate
  // to the gRPC-first recommendation pipeline.
  async generateRecommendations(userId: string): Promise<any[]> {
    try {
      return await this.getRecommendationsAI(userId);
    } catch (err) {
      this.logger.warn(
        `generateRecommendations fallback to empty for ${userId}: ${String(err)}`,
      );
      return [];
    }
  }

  async generateNextSteps(userId: string): Promise<string[]> {
    try {
      const grpcResp: any = await this.callGrpc(
        this.analyticsServiceGrpc.generateNextSteps({ user_id: userId }),
      );

      return grpcResp?.nextSteps || [];
    } catch (error) {
      this.logger.error(
        `Error generating next steps from Rust (gRPC): ${getErrorMessage(error)}`,
        getErrorStack(error),
      );
      return [];
    }
  }

  async predictWithBKT(
    userId: string,
    skillId: string,
    previousAttempts?: number,
  ): Promise<any> {
    // Delegate to AssessmentAnalyticsService implementation
    return this.assessmentAnalyticsService.predictWithBKT(
      userId,
      skillId,
      previousAttempts,
    );
  }

  async predictWithBurnModel(userId: string): Promise<any> {
    // Delegate to AssessmentAnalyticsService implementation
    return this.assessmentAnalyticsService.predictWithBurnModel(userId);
  }

  async getLearningAnalytics(userId: string): Promise<any> {
    // Delegate to consolidated learning analytics service
    return this.learningAnalyticsService.getLearningAnalytics(userId);
  }

  async getDetailedUserAnalytics(
    userId: string,
  ): Promise<LearningAnalyticsDto> {
    return this.userAnalyticsService.getDetailedUserAnalytics(userId);
  }

  async extractQuizzesFromMaterial(
    materialId: string,
    filePath: string,
  ): Promise<{ success: boolean; questionsCount: number }> {
    try {
      this.logger.log(`Triggering quiz extraction for material ${materialId}`);
      const response = await this.callGrpc(
        this.analyticsServiceGrpc.extractQuizzes({
          material_id: materialId,
          file_path: filePath,
        }),
      );

      this.logger.log(
        `Quiz extraction completed for ${materialId}: ${response.questions_count} questions found.`,
      );

      return {
        success: response.success,
        questionsCount: response.questions_count,
      };
    } catch (error) {
      this.logger.error(
        `Failed to extract quizzes for material ${materialId}: ${getErrorMessage(error)}`,
      );
      return { success: false, questionsCount: 0 };
    }
  }
}
