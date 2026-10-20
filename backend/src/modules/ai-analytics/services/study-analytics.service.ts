import { Injectable, Logger, Inject, OnModuleInit } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { RedisService } from '#infrastructure/redis/redis.service';
import { firstValueFrom, timeout, Observable } from 'rxjs';
import { retry } from 'rxjs/operators';
import { RequestDeduplicationService } from './request-deduplication.service';
import { AnalyticsService } from '#infrastructure/grpc/analytics.client';
import {
  ANALYTICS_CACHE_CONFIG,
  ANALYTICS_METRICS_CONFIG,
} from './analytics-cache.constants';
import { getErrorMessage } from '#common/utils/error.utils';
import { PerformanceMetricsService } from '#infrastructure/monitoring/performance-metrics.service';
import {
  StudyPatternsResponseDto,
  StudyRecommendationDto,
} from '#common/dto';

import { PrismaService } from '#infrastructure/prisma/prisma.service';
import { LearningAnalyticsService } from './learning-analytics.service';

@Injectable()
export class StudyAnalyticsService implements OnModuleInit {
  private readonly logger = new Logger(StudyAnalyticsService.name);
  private readonly cacheTtl = 3600; // 1 hour default TTL
  private analyticsServiceGrpc!: AnalyticsService;

  constructor(
    @Inject('ANALYTICS_PACKAGE') private readonly grpcClient: ClientGrpc,
    private readonly redisService: RedisService,
    private readonly performanceMetrics: PerformanceMetricsService,
    private readonly requestDeduplicationService: RequestDeduplicationService,
    private readonly prisma: PrismaService,
    private readonly learningAnalyticsService: LearningAnalyticsService,
  ) {}

  onModuleInit() {
    this.analyticsServiceGrpc =
      this.grpcClient.getService<AnalyticsService>('AnalyticsService');
  }

  /**
   * Call gRPC method with timeout and error handling
   */
  private async callGrpc<T>(
    call: Observable<T>,
    timeoutMs: number = 30000,
  ): Promise<T> {
    return firstValueFrom(
      call.pipe(timeout(timeoutMs), retry({ count: 2, delay: 500 })),
    );
  }

  /**
   * Analyze study patterns for a user
   * Consolidates implementations from:
   * - ai-analytics.service.ts (gRPC-first approach with caching)
   * - learning-analytics.service.ts (gRPC implementation)
   * - learning-path-recommendations.service.ts (local analysis)
   *
   * This is the primary implementation using gRPC with proper error handling and caching.
   */
  async analyzeStudyPatterns(
    userId: string,
  ): Promise<StudyPatternsResponseDto> {
    const startTime = Date.now();
    const cacheKey = `${ANALYTICS_CACHE_CONFIG.LEARNING.PATTERNS(userId)}:v2`;
    const dedupKey = ANALYTICS_CACHE_CONFIG.DEDUP(cacheKey);

    try {
      const cached = await this.redisService.get<string>(cacheKey);
      if (typeof cached === 'string') {
        await this.performanceMetrics.recordMetric({
          endpoint: ANALYTICS_METRICS_CONFIG.ENDPOINTS.LEARNING,
          method: 'analyzeStudyPatterns',
          provider: ANALYTICS_METRICS_CONFIG.PROVIDERS.GRPC,
          userId,
          responseTimeMs: Date.now() - startTime,
          cacheHit: true,
          success: true,
          timestamp: new Date(),
        });
        return JSON.parse(cached) as StudyPatternsResponseDto;
      }

      return await this.requestDeduplicationService.executeWithDedup(
        dedupKey,
        async () => {
          try {
            const grpcResp = await this.callGrpc(
              this.analyticsServiceGrpc.getStudyPatterns({ userId }),
            );
            if (!grpcResp.studyDuration || !grpcResp.preferredStudyTimes) {
              throw new Error(
                'Rust analytics omitted study duration or preferred study times',
              );
            }
            const mapped: StudyPatternsResponseDto = {
              userId: grpcResp.userId,
              patterns: grpcResp.patterns,
              consistency: grpcResp.consistency,
              timeDistribution: grpcResp.timeDistribution,
              studyDuration: {
                averageDuration: grpcResp.studyDuration.averageDuration,
                longestSession: grpcResp.studyDuration.longestSession,
                shortestSession: grpcResp.studyDuration.shortestSession,
              },
              consistencyScore: grpcResp.consistencyScore,
              preferredStudyTimes: grpcResp.preferredStudyTimes,
              performanceByTopic: grpcResp.performanceByTopic,
            };

            await this.redisService.set(
              cacheKey,
              JSON.stringify(mapped),
              this.cacheTtl,
            );

            await this.performanceMetrics.recordMetric({
              endpoint: ANALYTICS_METRICS_CONFIG.ENDPOINTS.LEARNING,
              method: 'analyzeStudyPatterns',
              provider: ANALYTICS_METRICS_CONFIG.PROVIDERS.GRPC,
              userId,
              responseTimeMs: Date.now() - startTime,
              cacheHit: false,
              success: true,
              timestamp: new Date(),
            });

            return mapped;
          } catch (grpcErr) {
            this.logger.warn(
              `gRPC analyzeStudyPatterns (detailed analytics) failed: ${getErrorMessage(grpcErr)}`,
            );
            throw grpcErr;
          }
        },
      );
    } catch (error) {
      this.logger.error(
        `Error in analyzeStudyPatterns: ${getErrorMessage(error)}`,
      );
      throw error;
    }
  }

  /**
   * Generate personalized study recommendations based on knowledge gaps
   * Consolidates implementations from:
   * - ai-analytics.service.ts (gRPC approach)
   * - assessment-recommendations.service.ts (Prisma local approach with caching)
   *
   * Rust generates recommendations; NestJS applies domain authorization filters.
   */
  async generateStudyRecommendations(
    userId: string,
    knowledgeGaps: string[],
  ): Promise<StudyRecommendationDto[]> {
    return this.learningAnalyticsService.generateStudyRecommendations(
      userId,
      knowledgeGaps,
    );
  }

  /**
   * Get due flashcards/reviews for spaced repetition
   * Wraps gRPC call to Rust analytics
   */
  async getDueCards(userId: string): Promise<any[]> {
    try {
      const grpcResp = await this.callGrpc(
        this.analyticsServiceGrpc.getDueCards({ userId }),
      );
      return grpcResp.cards;
    } catch (error) {
      this.logger.error(`Error getting due cards: ${getErrorMessage(error)}`);
      throw error;
    }
  }

  /**
   * Get focus recommendations based on weak areas
   * Wraps gRPC call to Rust analytics
   */
  async getFocusRecommendations(
    userId: string,
    limit: number = 5,
  ): Promise<any[]> {
    try {
      const grpcResp = await this.callGrpc(
        this.analyticsServiceGrpc.getFocusRecommendations({
          userId,
          limit,
        }),
      );
      const areas = grpcResp.areas;

      if (areas.length > 0) {
        const areaTopicIds = areas.map((area) => area.topic);
        // PERS-001: Filter out topics marked as mandatory in course structure
        const topics = await this.prisma.topic.findMany({
          where: { id: { in: areaTopicIds } },
          select: { id: true, isMandatory: true },
        });

        const mandatoryTopicIds = new Set(
          topics.filter((topic) => topic.isMandatory).map((topic) => topic.id),
        );

        return areas.filter((area) => !mandatoryTopicIds.has(area.topic));
      }

      return areas;
    } catch (error) {
      this.logger.error(
        `Error getting focus recommendations: ${getErrorMessage(error)}`,
      );
      throw error;
    }
  }
}
