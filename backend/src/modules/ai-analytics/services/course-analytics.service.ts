import { Injectable, Logger, Inject, OnModuleInit } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { PrismaService } from '#infrastructure/prisma/prisma.service';
import { RedisService } from '#infrastructure/redis/redis.service';
import { HttpService } from '@nestjs/axios';
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

/**
 * CourseAnalyticsService
 *
 * Domain-specific service for course-related analytics operations.
 * Provides course recommendations, learning patterns, progress tracking, and engagement metrics.
 * Uses gRPC-first approach with HTTP fallback for Rust analytics service integration.
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
  private readonly rustAnalyticsUrl =
    process.env.RUST_ANALYTICS_URL || 'http://rust-analytics:8000';
  private readonly rustApiKey = process.env.RUST_API_KEY || '';
  private readonly httpTimeoutMs = Number(
    process.env.RUST_HTTP_TIMEOUT_MS || 5000,
  );
  private readonly httpRetries = Number(process.env.RUST_HTTP_RETRIES || 2);
  private readonly grpcTimeoutMs = Number(
    process.env.RUST_GRPC_TIMEOUT_MS || 5000,
  );
  private readonly grpcRetries = Number(process.env.RUST_GRPC_RETRIES || 2);

  private analyticsServiceGrpc!: AnalyticsService;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly httpService: HttpService,
    @Inject('ANALYTICS_PACKAGE') private readonly client: ClientGrpc,
    private readonly requestDeduplicationService: RequestDeduplicationService,
    private readonly performanceMetrics: PerformanceMetricsService,
    private readonly tracingService: DistributedTracingService,
  ) {}

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
   * gRPC call with HTTP fallback
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
              this.analyticsServiceGrpc.getRecommendations({ user_id: userId }),
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
            return [];
          }
        },
      );
    } catch (error) {
      this.logger.error(
        `Failed to get course recommendations: ${getErrorMessage(error)}`,
      );
      return [];
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
          this.analyticsServiceGrpc.getCourseStatistics({ user_id: userId }),
        );

        const stats = response.course_stats;
        const result = {
          totalCourses: stats.total_courses,
          completedCourses: stats.completed_courses,
          totalStudyTimeMinutes: stats.total_study_time_minutes,
          averageCourseProgress: stats.average_course_progress,
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

        return {
          totalCourses: 0,
          completedCourses: 0,
          totalStudyTimeMinutes: 0,
          averageCourseProgress: 0,
        };
      }
    } catch (error) {
      this.logger.error(
        `Failed to get course statistics: ${getErrorMessage(error)}`,
      );
      return {
        totalCourses: 0,
        completedCourses: 0,
        totalStudyTimeMinutes: 0,
        averageCourseProgress: 0,
      };
    }
  }

  /**
   * Calculate course progress (read-only authoritative compute)
   * Delegates the computation to the Rust analytics engine over gRPC.
   * Local DB fallbacks were removed to prevent duplication and drift; callers must
   * handle null/undefined return values when Rust is unavailable.
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
          user_id: userId,
          course_id: courseId,
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
      // Return null to indicate fallback neded
      return null;
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
          userId,
          eventType,
          data: metadata as any,
          timestamp: new Date(),
        },
      });

      // Fire-and-forget batch event to gRPC/Rust
      void this.callGrpc(
        this.analyticsServiceGrpc.updateBkt({
          user_id: userId,
          skill_id: metadata.skillId as string,
          is_correct: (metadata.isCorrect as boolean) || false,
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
          this.analyticsServiceGrpc.getEngagementMetrics({ user_id: userId }),
        );

        const patterns = {
          dailyActiveStreak: response.daily_active_streak,
          sessionCount: response.session_count,
          averageSessionDuration: response.average_session_duration,
          weeklyActiveStreak: response.weekly_active_streak,
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
        return {};
      }
    } catch (error) {
      this.logger.error(
        `Failed to get learning patterns: ${getErrorMessage(error)}`,
      );
      return {};
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

      const enrollments = await this.prisma.courseEnrollment.findMany({
        where: { courseId },
      });

      const enrollmentCount = enrollments.length;
      const completedCount = enrollments.filter(
        (e) => e.status === 'completed',
      ).length;
      const completionRate =
        enrollmentCount > 0 ? (completedCount / enrollmentCount) * 100 : 0;

      const unitAccesses = await this.prisma.unitAccess.findMany({
        where: { unit: { courseId } },
      });
      const totalTime = unitAccesses.reduce(
        (sum, access) => sum + (access.timeSpent || 0),
        0,
      );
      const averageTimeSpent =
        enrollmentCount > 0 ? totalTime / enrollmentCount : 0;

      const unitAccessCounts = await this.prisma.unitAccess.groupBy({
        by: ['unitId'],
        where: { unit: { courseId } },
        _count: { id: true },
      });

      const unitsWithTitles = await this.prisma.unit.findMany({
        where: {
          courseId,
          id: { in: unitAccessCounts.map((uac) => uac.unitId) },
        },
        select: { id: true, title: true },
      });

      const popularUnits = unitAccessCounts
        .map((uac) => {
          const unit = unitsWithTitles.find((u) => u.id === uac.unitId);
          return {
            unitId: uac.unitId,
            title: unit?.title || 'Unknown Unit',
            accessCount: uac._count.id,
          };
        })
        .sort((a, b) => b.accessCount - a.accessCount)
        .slice(0, 5);

      const courseProgresses = await Promise.all(
        enrollments.map(async (enrollment) => {
          const progress = await this.calculateCourseProgress(
            enrollment.userId,
            courseId,
          );
          return {
            userId: enrollment.userId,
            progressPercentage: progress?.progressPercentage || 0,
          };
        }),
      );

      const strugglingStudents = courseProgresses
        .filter((cp) => cp.progressPercentage < 30)
        .sort((a, b) => a.progressPercentage - b.progressPercentage)
        .slice(0, 10);

      const result = {
        enrollmentCount,
        completionRate: Math.round(completionRate * 100) / 100,
        averageTimeSpent: Math.round(averageTimeSpent),
        popularUnits,
        strugglingStudents,
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
      return {
        enrollmentCount: 0,
        completionRate: 0,
        averageTimeSpent: 0,
        popularUnits: [],
        strugglingStudents: [],
      };
    }
  }

  private async postWithTimeoutAndRetry(
    url: string,
    data: unknown,
  ): Promise<any> {
    const config = {
      timeout: this.httpTimeoutMs,
      headers: this.rustApiKey
        ? { Authorization: `Bearer ${this.rustApiKey}` }
        : {},
    };

    try {
      const response = await this.httpService
        .post(url, data, config)
        .toPromise();
      return response;
    } catch (error) {
      if (this.httpRetries > 0) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return this.postWithTimeoutAndRetry(url, data);
      }
      throw error;
    }
  }
}
