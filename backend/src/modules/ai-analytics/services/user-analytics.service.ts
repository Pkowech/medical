import { Injectable, Logger, Inject, OnModuleInit } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { RedisService } from '#infrastructure/redis/redis.service';
import { firstValueFrom, timeout, Observable } from 'rxjs';
import { retry } from 'rxjs/operators';
import { AnalyticsService } from '#infrastructure/grpc/analytics.client';
import { PerformanceMetricsService } from '#infrastructure/monitoring/performance-metrics.service';
import { LearningAnalyticsService } from './learning-analytics.service';
import { DistributedTracingService } from '#infrastructure/monitoring/distributed-tracing.service';
import { RequestDeduplicationService } from './request-deduplication.service';
import { PrismaService } from '#infrastructure/prisma/prisma.service';
import { StudyAnalyticsService } from './study-analytics.service';
import {
  ANALYTICS_CACHE_CONFIG,
  ANALYTICS_METRICS_CONFIG,
} from './analytics-cache.constants';
import { getErrorMessage } from '#common/utils/error.utils';
import {
  UserAnalyticsResponseDto,
  StudyPatternsResponseDto,
  LearningAnalyticsDto,
} from '#common/dto';

/**
 * UserAnalyticsService
 *
 * Domain-specific service for user-centric analytics operations.
 * Provides user engagement metrics, feature vectors, learning summaries,
 * and individual user performance tracking.
 * Uses gRPC-first approach with HTTP fallback for Rust analytics service integration.
 *
 * Used by:
 * - User profile pages
 * - User dashboard analytics
 * - Personalization engines
 * - Admin user management
 */
@Injectable()
export class UserAnalyticsService implements OnModuleInit {
  private readonly logger = new Logger(UserAnalyticsService.name);
  private readonly cacheTtl = 3600;
  private readonly shortCacheTtl = 300; // 5 minutes for engagement metrics
  private readonly grpcTimeoutMs = Number(
    process.env.RUST_GRPC_TIMEOUT_MS || 5000,
  );
  private readonly grpcRetries = Number(process.env.RUST_GRPC_RETRIES || 2);

  private analyticsServiceGrpc!: AnalyticsService;

  constructor(
    private readonly redisService: RedisService,
    @Inject('ANALYTICS_PACKAGE') private readonly client: ClientGrpc,
    private readonly requestDeduplicationService: RequestDeduplicationService,
    private readonly studyAnalyticsService: StudyAnalyticsService,
    private readonly performanceMetrics: PerformanceMetricsService,
    private readonly tracingService: DistributedTracingService,
    private readonly prisma: PrismaService,
    private readonly learningAnalyticsService: LearningAnalyticsService,
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
   * Get user engagement metrics (streaks, session counts, etc.)
   * Cached with shorter TTL as this data changes frequently
   */
  async getUserEngagementMetrics(userId: string): Promise<{
    timeSpent: number;
    completionRate: number;
    activityFrequency: number;
    dailyActiveStreak: number;
    weeklyActiveStreak: number;
    sessionCount: number;
    averageSessionDuration: number;
  }> {
    try {
      const cacheKey = ANALYTICS_CACHE_CONFIG.LEARNING.ENGAGEMENT(userId);

      const cached = await this.redisService.get<string>(cacheKey);
      if (typeof cached === 'string') {
        return JSON.parse(cached);
      }

      // Strictly gRPC
      const startTime = Date.now();
      const response = await this.callGrpc(
        this.analyticsServiceGrpc.getEngagementMetrics({ user_id: userId }),
      );
      const responseTimeMs = Date.now() - startTime;

      void this.performanceMetrics.recordMetric({
        endpoint: ANALYTICS_METRICS_CONFIG.ENDPOINTS.LEARNING,
        method: 'GET',
        provider: ANALYTICS_METRICS_CONFIG.PROVIDERS.GRPC,
        userId,
        responseTimeMs,
        cacheHit: false,
        success: true,
        timestamp: new Date(),
      });

      const metrics = {
        timeSpent: response.time_spent || 0,
        completionRate: response.completion_rate || 0,
        activityFrequency: response.activity_frequency || 0,
        dailyActiveStreak: response.daily_active_streak || 0,
        weeklyActiveStreak: response.weekly_active_streak || 0,
        sessionCount: response.session_count || 0,
        averageSessionDuration: response.average_session_duration || 0,
      };

      await this.redisService.set(
        cacheKey,
        JSON.stringify(metrics),
        this.shortCacheTtl,
      );
      return metrics;
    } catch (error) {
      this.logger.error(
        `Failed to get user engagement metrics via gRPC: ${getErrorMessage(error)}`,
      );
      return {
        timeSpent: 0,
        completionRate: 0,
        activityFrequency: 0,
        dailyActiveStreak: 0,
        weeklyActiveStreak: 0,
        sessionCount: 0,
        averageSessionDuration: 0,
      };
    }
  }

  /**
   * Get user feature vector for ML models
   */
  async getUserFeatureVector(userId: string): Promise<{
    userId: string;
    features: number[];
    featureMap: Record<string, number>;
  }> {
    try {
      const cacheKey = ANALYTICS_CACHE_CONFIG.LEARNING.FEATURE_VECTOR(userId);

      const cached = await this.redisService.get<string>(cacheKey);
      if (typeof cached === 'string') {
        return JSON.parse(cached);
      }

      // Strictly gRPC
      const response = await this.callGrpc(
        this.analyticsServiceGrpc.getUserFeatureVector({ user_id: userId }),
      );

      await this.redisService.set(
        cacheKey,
        JSON.stringify(response),
        this.cacheTtl,
      );
      return {
        userId: response.user_id,
        features: response.features,
        featureMap: response.featureMap,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get user feature vector via gRPC: ${getErrorMessage(error)}`,
      );
      return {
        userId,
        features: [],
        featureMap: {},
      };
    }
  }

  /**
   * Get comprehensive user learning analytics
   */
  async getDetailedUserAnalytics(
    userId: string,
  ): Promise<LearningAnalyticsDto> {
    try {
      return await this.learningAnalyticsService.getDetailedLearningAnalytics(
        userId,
      );
    } catch (error) {
      this.logger.error(
        `Failed to fetch detailed learning analytics via gRPC: ${getErrorMessage(error)}`,
      );
      return {} as LearningAnalyticsDto;
    }
  }

  /**
   * Get user engagement derived directly from DB (Prisma) for cases where gRPC
   * is unavailable or callers require an immediate DB-backed view.
   */
  async getUserEngagementFromPrisma(
    userId: string,
  ): Promise<Record<string, unknown>> {
    try {
      const [totalStudyTimeResult, pathProgress] = await Promise.all([
        this.prisma.progress.aggregate({
          where: { userId },
          _sum: { timeSpent: true },
        }),
        this.prisma.learningPathProgress.findMany({ where: { userId } }),
      ]);

      const totalStudyTime =
        (totalStudyTimeResult._sum.timeSpent || 0) +
        pathProgress.reduce(
          (s: number, p: any) => s + (p.totalTimeSpentMinutes || 0),
          0,
        );

      const streakDays = 0;
      const sessions = 0;

      return {
        userId,
        totalStudyTimeMinutes: totalStudyTime,
        sessions,
        streakDays,
      };
    } catch (error) {
      this.logger.error(
        `Error computing engagement for ${userId} from DB: ${getErrorMessage(error)}`,
      );
      throw error;
    }
  }

  /**
   * Invalidate user analytics caches
   */
  async invalidateUserCache(userId: string): Promise<void> {
    const cacheKeys = [
      ANALYTICS_CACHE_CONFIG.LEARNING.ENGAGEMENT(userId),
      ANALYTICS_CACHE_CONFIG.LEARNING.FEATURE_VECTOR(userId),
      ANALYTICS_CACHE_CONFIG.LEARNING.ANALYTICS(userId),
    ];

    try {
      await Promise.all(cacheKeys.map((key) => this.redisService.del(key)));
      this.logger.debug(`Invalidated analytics cache for user ${userId}`);
    } catch (error) {
      this.logger.warn(
        `Failed to invalidate user cache: ${getErrorMessage(error)}`,
      );
    }
  }

  /**
   * Get main user analytics DTO
   */
  async getUserAnalytics(userId: string): Promise<UserAnalyticsResponseDto> {
    try {
      const analytics = await this.getDetailedUserAnalytics(userId);

      return {
        lastActiveDate: analytics.engagementMetrics?.lastActivityDate
          ? typeof analytics.engagementMetrics.lastActivityDate === 'string'
            ? analytics.engagementMetrics.lastActivityDate
            : analytics.engagementMetrics.lastActivityDate.toISOString()
          : new Date().toISOString(),
        streakDays: analytics.engagementMetrics?.dailyActiveStreak || 0,
        strongestCategories:
          analytics.userLearningSummary?.strongestSubjects || [],
        improvementAreas: analytics.userLearningSummary?.weakestSubjects || [],
        recommendedNextSteps: [],
        coursesEnrolled: analytics.courseStats?.totalCourses || 0,
        coursesCompleted: analytics.courseStats?.completedCourses || 0,
        averageScore: analytics.userLearningSummary?.averageScore || 0,
        totalStudyTime: analytics.userLearningSummary?.totalStudyTime || 0,
        badges: 0,
        points: 0,
        level: 1,
        currentStreak: analytics.engagementMetrics?.dailyActiveStreak || 0,
      };
    } catch (error) {
      this.logger.error(
        `Error getting user analytics via gRPC: ${getErrorMessage(error)}`,
      );
      throw error;
    }
  }

  /**
   * Get profile stats via gRPC
   */
  async getUserProfileStats(userId: string): Promise<any> {
    try {
      const resp = await this.callGrpc(
        this.analyticsServiceGrpc.getUserLearningSummary({ user_id: userId }),
      );

      return {
        coursesEnrolled: 0, // Need to merge if needed, but keeping it gRPC proxy
        coursesCompleted: 0,
        totalStudyTime: resp.total_study_time || 0,
        totalCourses: 0,
        averageScore: resp.average_score || 0,
        badges: 0,
        points: 0,
        level: 1,
        currentStreak: resp.current_streak || 0,
        recentActivity: [],
      };
    } catch (error) {
      this.logger.error(
        `Failed to get user profile stats via gRPC: ${getErrorMessage(error)}`,
      );
      return {
        coursesEnrolled: 0,
        coursesCompleted: 0,
        totalStudyTime: 0,
        totalCourses: 0,
        averageScore: 0,
        badges: 0,
        points: 0,
        level: 1,
        currentStreak: 0,
        recentActivity: [],
      };
    }
  }

  async generatePredictions(userId: string) {
    try {
      return await this.callGrpc(
        this.analyticsServiceGrpc.predictPerformance({
          user_id: userId,
          skill_id: '',
        }),
      );
    } catch (error) {
      this.logger.error(
        `Error generating predictions via gRPC: ${getErrorMessage(error)}`,
      );
      return {};
    }
  }

  async generateRecommendations(userId: string) {
    try {
      const response = await this.callGrpc(
        this.analyticsServiceGrpc.getRecommendations({ user_id: userId }),
      );
      return response.items || [];
    } catch (error) {
      this.logger.error(
        `Error generating recommendations via gRPC: ${getErrorMessage(error)}`,
      );
      return [];
    }
  }

  async analyzeStudyPatterns(
    userId: string,
  ): Promise<StudyPatternsResponseDto> {
    return this.studyAnalyticsService.analyzeStudyPatterns(userId);
  }
}
