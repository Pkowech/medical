import {
  Injectable,
  Logger,
  Inject,
  OnModuleInit,
} from '@nestjs/common';
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
 * Analytics calculations are delegated to the Rust service over gRPC.
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
    totalStudyTimeMinutes: number;
    weeklyStudyMinutes: number;
    activeStudyDaysThisWeek: number;
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
        this.analyticsServiceGrpc.getEngagementMetrics({ userId: userId }),
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
        timeSpent: response.timeSpent,
        completionRate: response.completionRate,
        activityFrequency: response.activityFrequency,
        dailyActiveStreak: response.dailyStreak,
        weeklyActiveStreak: response.weeklyStreak,
        sessionCount: response.activityFrequency,
        averageSessionDuration:
          response.activityFrequency > 0
            ? response.timeSpent / response.activityFrequency
            : 0,
        totalStudyTimeMinutes: response.totalStudyTimeMinutes,
        weeklyStudyMinutes: response.weeklyStudyMinutes,
        activeStudyDaysThisWeek: response.activeStudyDaysThisWeek,
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
      throw error;
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
      const cacheKey = `${ANALYTICS_CACHE_CONFIG.LEARNING.FEATURE_VECTOR(userId)}:v2`;

      const cached = await this.redisService.get<string>(cacheKey);
      if (typeof cached === 'string') {
        return JSON.parse(cached);
      }

      // Strictly gRPC
      const response = await this.callGrpc(
        this.analyticsServiceGrpc.getUserFeatureVector({ userId: userId }),
      );

      await this.redisService.set(
        cacheKey,
        JSON.stringify(response),
        this.cacheTtl,
      );
      return {
        userId: response.userId,
        features: response.features,
        featureMap: response.featureMap,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get user feature vector via gRPC: ${getErrorMessage(error)}`,
      );
      throw error;
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
      throw error;
    }
  }

  async getUserInsights(userId: string) {
    return this.learningAnalyticsService.getUserInsights(userId);
  }

  async getSystemAnalytics() {
    return this.callGrpc(this.analyticsServiceGrpc.getSystemAnalytics({}));
  }

  async getCourseStatistics(userId: string) {
    return this.learningAnalyticsService.getCourseStatistics(userId);
  }

  /**
   * Invalidate user analytics caches
   */
  async invalidateUserCache(userId: string): Promise<void> {
    const cacheKeys = [
      ANALYTICS_CACHE_CONFIG.LEARNING.ENGAGEMENT(userId),
      `${ANALYTICS_CACHE_CONFIG.LEARNING.FEATURE_VECTOR(userId)}:v2`,
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
      const [stats, nextSteps] = await Promise.all([
        this.getUserProfileStats(userId),
        this.learningAnalyticsService.generateNextSteps(userId),
      ]);

      return {
        lastActiveDate: stats.lastActiveDate,
        streakDays: stats.currentStreak,
        strongestCategories: stats.strongestSubjects,
        improvementAreas: stats.weakestSubjects,
        recommendedNextSteps: nextSteps,
        coursesEnrolled: stats.coursesEnrolled,
        coursesCompleted: stats.coursesCompleted,
        averageScore: stats.averageScore,
        totalStudyTime: stats.totalStudyTime,
        badges: stats.badges,
        points: stats.points,
        level: null,
        currentStreak: stats.currentStreak,
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
  async getUserProfileStats(userId: string): Promise<{
    coursesEnrolled: number;
    coursesCompleted: number;
    completionRate: number;
    totalStudyTime: number;
    averageScore: number;
    assessmentsTaken: number;
    completedItems: number;
    badges: number;
    points: number;
    level: null;
    currentStreak: number;
    lastActiveDate: string | null;
    strongestSubjects: string[];
    weakestSubjects: string[];
    enrollments: Array<{
      title: string | null;
      status: string;
      progressPercentage: number | null;
    }>;
    recentActivity: Array<{
      id: string;
      type: string;
      description: string;
      createdAt: string;
    }>;
  }> {
    try {
      const [
        studySessions,
        quizAttempts,
        enrollments,
        user,
        badges,
        recentEvents,
      ] = await Promise.all([
        this.prisma.studySession.findMany({
          where: { userId, isValid: true, endTime: { not: null } },
          select: {
            duration: true,
            topic: { select: { name: true } },
          },
        }),
        this.prisma.quizAttempt.findMany({
          where: { userId, completedAt: { not: null } },
          select: {
            percentage: true,
            quiz: { select: { topic: { select: { name: true } } } },
          },
        }),
        this.prisma.courseEnrollment.findMany({
          where: { userId },
          orderBy: { lastAccessed: 'desc' },
          select: {
            status: true,
            progressPercentage: true,
            course: { select: { title: true } },
          },
        }),
        this.prisma.user.findUnique({
          where: { id: userId },
          select: { points: true, lastLogin: true },
        }),
        this.prisma.userBadge.count({ where: { userId } }),
        this.prisma.analyticsEvent.findMany({
          where: { userId },
          orderBy: { timestamp: 'desc' },
          take: 10,
          select: { id: true, eventType: true, timestamp: true },
        }),
      ]);

      if (!user) {
        throw new Error(`User ${userId} does not exist`);
      }

      const [courseStatsResponse, summaryResponse, engagement] =
        await Promise.all([
          this.callGrpc(
            this.analyticsServiceGrpc.getCourseStatistics({ userId }),
          ),
          this.callGrpc(
            this.analyticsServiceGrpc.getUserLearningSummary({
              userId,
              studySessions: studySessions.map((session) => ({
                userId,
                duration: session.duration ?? 0,
                topic: session.topic?.name ?? '',
                score: 0,
              })),
              quizAttempts: quizAttempts.map((attempt) => ({
                userId,
                percentage: attempt.percentage,
                category: attempt.quiz.topic?.name ?? '',
              })),
            }),
          ),
          this.callGrpc(
            this.analyticsServiceGrpc.getEngagementMetrics({ userId }),
          ),
        ]);
      const courseStats = courseStatsResponse.courseStats;
      const summary = summaryResponse.summary;
      if (!courseStats || !summary) {
        throw new Error('Rust analytics returned an incomplete user summary');
      }

      return {
        coursesEnrolled: courseStats.totalCourses,
        coursesCompleted: courseStats.completedCourses,
        completionRate: courseStats.completionRate,
        totalStudyTime: summary.totalStudyTime,
        averageScore: summary.averageScore,
        assessmentsTaken: quizAttempts.length,
        completedItems: courseStats.completedItems,
        badges,
        points: user.points,
        level: null,
        currentStreak: engagement.dailyStreak,
        lastActiveDate: user.lastLogin?.toISOString() ?? null,
        strongestSubjects: summary.strongestSubjects,
        weakestSubjects: summary.weakestSubjects,
        enrollments: enrollments.map((enrollment) => ({
          title: enrollment.course.title,
          status: enrollment.status,
          progressPercentage: enrollment.progressPercentage,
        })),
        recentActivity: recentEvents.map((event) => ({
          id: event.id,
          type: event.eventType,
          description: event.eventType,
          createdAt: event.timestamp.toISOString(),
        })),
      };
    } catch (error) {
      this.logger.error(
        `Failed to get user profile stats via gRPC: ${getErrorMessage(error)}`,
      );
      throw error;
    }
  }

  async generateRecommendations(userId: string) {
    try {
      return this.learningAnalyticsService.getUnifiedRecommendations(
        userId,
        'learning_path',
      );
    } catch (error) {
      this.logger.error(
        `Error generating recommendations via gRPC: ${getErrorMessage(error)}`,
      );
      throw error;
    }
  }

  async analyzeStudyPatterns(
    userId: string,
  ): Promise<StudyPatternsResponseDto> {
    return this.studyAnalyticsService.analyzeStudyPatterns(userId);
  }
}
