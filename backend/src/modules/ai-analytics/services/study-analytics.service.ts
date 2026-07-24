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
import { StudyPatternsResponseDto } from '#common/dto';

import { PrismaService } from '#infrastructure/prisma/prisma.service';

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
   * - learning-analytics.service.ts (gRPC with local fallback)
   * - learning-path-recommendations.service.ts (local analysis)
   *
   * This is the primary implementation using gRPC with proper error handling and caching.
   */
  async analyzeStudyPatterns(
    userId: string,
  ): Promise<StudyPatternsResponseDto> {
    const startTime = Date.now();
    const cacheKey = ANALYTICS_CACHE_CONFIG.LEARNING.PATTERNS(userId);
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
          // Try gRPC first
          try {
            const grpcResp = await this.callGrpc(
              this.analyticsServiceGrpc.getDetailedLearningAnalytics({
                user_id: userId,
              }),
            );

            const mapped: StudyPatternsResponseDto = {
              userId,
              patterns:
                (grpcResp.progress_trends || []).map((t: any) =>
                  (t.type || '').toUpperCase(),
                ) || [],
              consistency:
                (grpcResp.user_learning_summary?.average_session_length as
                  | number
                  | undefined) ?? 0,
              timeDistribution: {},
              studyDuration: {
                averageDuration:
                  grpcResp.user_learning_summary?.average_session_length || 0,
                longestSession: 0,
                shortestSession: 0,
              },
              consistencyScore: grpcResp.user_learning_summary
                ? Math.min(
                    1,
                    (grpcResp.user_learning_summary.average_session_length ||
                      0) / 60,
                  )
                : 0,
              preferredStudyTimes: { morning: 0, afternoon: 0, evening: 0 },
              performanceByTopic:
                grpcResp.performance_metrics?.weakness_areas?.reduce(
                  (acc: any, cur: string) => {
                    acc[cur] = 0;
                    return acc;
                  },
                  {},
                ) || {},
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
            // Return empty DTO on gRPC failure
            return {
              userId,
              patterns: [],
              consistency: 0,
              timeDistribution: {},
              studyDuration: {
                averageDuration: 0,
                longestSession: 0,
                shortestSession: 0,
              },
              preferredStudyTimes: { morning: 0, afternoon: 0, evening: 0 },
              performanceByTopic: {},
              consistencyScore: 0,
            };
          }
        },
      );
    } catch (error) {
      this.logger.error(
        `Error in analyzeStudyPatterns: ${getErrorMessage(error)}`,
      );
      return {
        userId,
        patterns: [],
        consistency: 0,
        timeDistribution: {},
        studyDuration: {
          averageDuration: 0,
          longestSession: 0,
          shortestSession: 0,
        },
        preferredStudyTimes: { morning: 0, afternoon: 0, evening: 0 },
        performanceByTopic: {},
        consistencyScore: 0,
      };
    }
  }

  /**
   * Generate personalized study recommendations based on knowledge gaps
   * Consolidates implementations from:
   * - ai-analytics.service.ts (gRPC approach)
   * - assessment-recommendations.service.ts (Prisma local approach with caching)
   *
   * Uses hybrid approach: gRPC for AI recommendations, Prisma fallback for local materials.
   */
  async generateStudyRecommendations(
    userId: string,
    knowledgeGaps: string[],
  ): Promise<
    Array<{
      id: string;
      type: string;
      title: string;
      url?: string;
      priority: string;
    }>
  > {
    try {
      const cacheKey = ANALYTICS_CACHE_CONFIG.RECOMMENDATIONS.STUDY_WITH_GAPS(
        userId,
        knowledgeGaps,
      );
      const cached = await this.redisService.get<string>(cacheKey);
      if (typeof cached === 'string') {
        return JSON.parse(cached);
      }

      // Strictly gRPC
      const grpcResp: any = await this.callGrpc(
        this.analyticsServiceGrpc.generateStudyRecommendations({
          user_id: userId,
          knowledge_gaps: knowledgeGaps,
        }),
      );

      const recommendations = (grpcResp?.recommendations || []).map(
        (rec: any) => ({
          id: rec.materialId || rec.id,
          type: rec.type || 'MATERIAL',
          title: rec.title || 'Study Material',
          url: rec.url,
          priority: rec.priority || 'MEDIUM',
        }),
      );

      await this.redisService.set(
        cacheKey,
        JSON.stringify(recommendations),
        24 * 60 * 60, // 1 day TTL
      );

      return recommendations;
    } catch (error) {
      this.logger.error(
        `Error generating study recommendations via gRPC: ${getErrorMessage(error)}`,
      );
      return [];
    }
  }

  /**
   * Get due flashcards/reviews for spaced repetition
   * Wraps gRPC call to Rust analytics
   */
  async getDueCards(userId: string): Promise<any[]> {
    try {
      const grpcResp = await this.callGrpc(
        this.analyticsServiceGrpc.getDueCards({ user_id: userId }),
      );
      return grpcResp.cards || [];
    } catch (error) {
      this.logger.error(`Error getting due cards: ${getErrorMessage(error)}`);
      return [];
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
          user_id: userId,
          limit,
        }),
      );
      const areas = grpcResp.areas || [];

      if (areas.length > 0) {
        const areaTopicIds = areas.map((a: any) => a.topic);
        // PERS-001: Filter out topics marked as mandatory in course structure
        const topics = await this.prisma.topic.findMany({
          where: { id: { in: areaTopicIds } },
          select: { id: true, isMandatory: true },
        });

        const mandatoryTopicIds = new Set(
          topics.filter((t: any) => t.isMandatory).map((t: any) => t.id),
        );

        return areas.filter((area: any) => !mandatoryTopicIds.has(area.topic));
      }

      return areas;
    } catch (error) {
      this.logger.error(
        `Error getting focus recommendations: ${getErrorMessage(error)}`,
      );
      return [];
    }
  }
}
