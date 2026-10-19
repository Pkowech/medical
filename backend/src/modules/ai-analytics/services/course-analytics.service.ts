import { Injectable, Logger, Inject, OnModuleInit } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { PrismaService } from '#infrastructure/prisma/prisma.service';
import { RedisService } from '#infrastructure/redis/redis.service';
import { firstValueFrom, timeout, Observable } from 'rxjs';
import { retry } from 'rxjs/operators';
import { AnalyticsService } from '#infrastructure/grpc/analytics.client';
import { PerformanceMetricsService } from '#infrastructure/monitoring/performance-metrics.service';
import { DistributedTracingService } from '#infrastructure/monitoring/distributed-tracing.service';
import { RequestDeduplicationService } from './request-deduplication.service';
import {
  ANALYTICS_CACHE_CONFIG,
  ANALYTICS_METRICS_CONFIG,
} from './analytics-cache.constants';
import { getErrorMessage } from '#common/utils/error.utils';
import { RecommendationItemDto } from '#common/dto/analytics.dto';
import { v4 as uuidv4 } from 'uuid';

/**
 * CourseAnalyticsService
 *
 * Domain-specific service for course-related analytics operations.
 * Provides course recommendations, learning patterns, progress tracking, and engagement metrics.
 * Delegates analytics computation to the Rust service over gRPC.
 *
 * Used by:
 * - progress.service.ts (progress tracking)
 * - study.service.ts (study recommendations)
 * - study-groups.service.ts (group learning analytics)
 * - materials.service.ts (material recommendations)
 * - learning.service.ts (learning path analytics)
 */
@Injectable()
export class CourseAnalyticsService implements OnModuleInit {
  private readonly logger = new Logger(CourseAnalyticsService.name);
  private readonly cacheTtl = 3600;
  private readonly grpcTimeoutMs: number;
  private readonly grpcRetries: number;
  private analyticsServiceGrpc!: AnalyticsService;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    @Inject('ANALYTICS_PACKAGE') private readonly client: ClientGrpc,
    private readonly requestDeduplicationService: RequestDeduplicationService,
    private readonly performanceMetrics: PerformanceMetricsService,
    private readonly tracingService: DistributedTracingService,
  ) {
    this.grpcTimeoutMs = Number(process.env.RUST_GRPC_TIMEOUT_MS ?? 5000);
    this.grpcRetries = Number(process.env.RUST_GRPC_RETRIES ?? 2);
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
   * Get personalized course recommendations for a user
   * Rust gRPC recommendation call
   */
  async getRecommendationsForCourse(
    userId: string,
  ): Promise<RecommendationItemDto[]> {
    try {
      const cacheKey = ANALYTICS_CACHE_CONFIG.RECOMMENDATIONS.COURSE(userId);
      const dedupKey = ANALYTICS_CACHE_CONFIG.DEDUP(cacheKey);

      const cached = await this.redisService.get<string>(cacheKey);
      if (typeof cached === 'string') {
        return JSON.parse(cached) as RecommendationItemDto[];
      }

      return await this.requestDeduplicationService.executeWithDedup(
        dedupKey,
        async () => {
          try {
            // Try gRPC first
            const startTime = Date.now();
            const grpcResponse = await this.callGrpc(
              this.analyticsServiceGrpc.getRecommendations({ userId, limit: 10 }),
            );
            const responseTimeMs = Date.now() - startTime;

            void this.performanceMetrics.recordMetric({
              endpoint: ANALYTICS_METRICS_CONFIG.ENDPOINTS.RECOMMENDATIONS,
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
              JSON.stringify(grpcResponse.items),
              this.cacheTtl,
            );
            return grpcResponse.items;
          } catch (grpcError) {
            this.logger.error(
              `gRPC failed for getRecommendationsForCourse: ${getErrorMessage(grpcError)}`,
            );
            throw grpcError;
          }
        },
      );
    } catch (error) {
      this.logger.error(
        `Failed to get course recommendations: ${getErrorMessage(error)}`,
      );
      throw error;
    }
  }

  /**
   * Get course statistics for a user
   * Includes course completion rates and progress
   */
  async getCourseStatistics(userId: string): Promise<{
    totalCourses: number;
    completedCourses: number;
    totalStudyTimeMinutes: number;
    averageCourseProgress: number;
  }> {
    const cacheKey = ANALYTICS_CACHE_CONFIG.LEARNING.COURSE_STATS(userId);

    try {
      const cached = await this.redisService.get<string>(cacheKey);
      if (typeof cached === 'string') {
        return JSON.parse(cached);
      }

      try {
        // Try gRPC first
        const response = await this.callGrpc(
          this.analyticsServiceGrpc.getCourseStatistics({ userId: userId }),
        );

        const stats = response.courseStats;
        if (!stats) {
          throw new Error('Rust analytics returned no course statistics');
        }
        const result = {
          totalCourses: stats.totalCourses,
          completedCourses: stats.completedCourses,
          totalStudyTimeMinutes: stats.totalStudyTimeMinutes,
          averageCourseProgress: stats.averageCourseProgress,
        };

        await this.redisService.set(
          cacheKey,
          JSON.stringify(result),
          this.cacheTtl,
        );
        return result;
      } catch (grpcError) {
        this.logger.error(
          `gRPC failed for getCourseStatistics: ${getErrorMessage(grpcError)}`,
        );
        throw grpcError;
      }
    } catch (error) {
      this.logger.error(
        `Failed to get course statistics: ${getErrorMessage(error)}`,
      );
      throw error;
    }
  }

  /**
   * Calculate course progress (read-only authoritative compute)
   * Delegates the computation to the Rust analytics engine over gRPC.
   */
  async calculateCourseProgress(
    userId: string,
    courseId: string,
  ): Promise<any> {
    const cacheKey = ANALYTICS_CACHE_CONFIG.COURSE.PROGRESS(userId, courseId);

    try {
      const cached = await this.redisService.get<string>(cacheKey);
      if (typeof cached === 'string') {
        return JSON.parse(cached);
      }

      // Try gRPC
      const response = await this.callGrpc(
        this.analyticsServiceGrpc.calculateCourseProgress({
          userId: userId,
          courseId,
        }),
      );

      await this.redisService.set(
        cacheKey,
        JSON.stringify(response),
        this.cacheTtl,
      );
      return response;
    } catch (error) {
      this.logger.warn(
        `gRPC calculateCourseProgress failed: ${getErrorMessage(error)}`,
      );
      throw error;
    }
  }

  /**
   * Track a course/learning event for analytics
   */
  async trackCourseEvent(
    userId: string,
    eventType: string,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.prisma.analyticsEvent.create({
        data: {
          id: uuidv4(),
          userId,
          eventType,
          data: metadata as any,
          timestamp: new Date(),
        },
      });

      // Fire-and-forget batch event to gRPC/Rust
      void this.callGrpc(
        this.analyticsServiceGrpc.updateBkt({
          userId: userId,
          skillId: metadata.skillId as string,
          isCorrect: (metadata.isCorrect as boolean) || false,
        }),
      ).catch((err) => {
        this.logger.warn(
          `Failed to batch event to Rust: ${getErrorMessage(err)}`,
        );
      });
    } catch (error) {
      this.logger.error(
        `Failed to track course event: ${getErrorMessage(error)}`,
      );
    }
  }

  /**
   * Get learning patterns for a user
   * Shows time-based patterns, preferred study times, etc.
   */
  async getLearningPatterns(userId: string): Promise<Record<string, unknown>> {
    const cacheKey = `learning_patterns:${userId}`;

    try {
      const cached = await this.redisService.get<string>(cacheKey);
      if (typeof cached === 'string') {
        return JSON.parse(cached);
      }

      try {
        // Try gRPC first (via engagement metrics)
        const response = await this.callGrpc(
          this.analyticsServiceGrpc.getEngagementMetrics({ userId: userId }),
        );

        const patterns = {
          dailyActiveStreak: response.dailyStreak,
          sessionCount: response.activityFrequency,
          averageSessionDuration:
            response.activityFrequency > 0
              ? response.timeSpent / response.activityFrequency
              : 0,
          weeklyActiveStreak: response.weeklyStreak,
        };

        await this.redisService.set(
          cacheKey,
          JSON.stringify(patterns),
          this.cacheTtl,
        );
        return patterns;
      } catch (grpcError) {
        this.logger.error(
          `gRPC failed for getLearningPatterns: ${getErrorMessage(grpcError)}`,
        );
        throw grpcError;
      }
    } catch (error) {
      this.logger.error(
        `Failed to get learning patterns: ${getErrorMessage(error)}`,
      );
      throw error;
    }
  }

  async getCourseAnalytics(courseId: string): Promise<{
    enrollmentCount: number;
    completionRate: number;
    averageTimeSpent: number;
    popularUnits: { unitId: string; title: string; accessCount: number }[];
    strugglingStudents: { userId: string; progressPercentage: number }[];
  }> {
    const cacheKey = ANALYTICS_CACHE_CONFIG.COURSE.ANALYTICS(courseId);
    try {
      const cached = await this.redisService.get(cacheKey);
      if (cached) {
        return JSON.parse(cached as string);
      }

      const response = await this.callGrpc(
        this.analyticsServiceGrpc.getCourseAnalytics({ courseId }),
      );

      const result = {
        enrollmentCount: response.enrollmentCount,
        completionRate: Math.round(response.completionRate * 100) / 100,
        averageTimeSpent: Math.round(response.averageTimeSpent),
        popularUnits: response.popularUnits.map((unit) => ({
          unitId: unit.unitId,
          title: unit.title,
          accessCount: unit.accessCount,
        })),
        strugglingStudents: response.strugglingStudents.map((student) => ({
          userId: student.userId,
          progressPercentage: student.progressPercentage,
        })),
      };

      await this.redisService.set(
        cacheKey,
        JSON.stringify(result),
        this.cacheTtl,
      );
      return result;
    } catch (error) {
      this.logger.error('Error getting course analytics', {
        courseId,
        error: getErrorMessage(error),
      });
      throw error;
    }
  }
}
