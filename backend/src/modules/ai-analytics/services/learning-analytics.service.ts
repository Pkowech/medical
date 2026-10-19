import {
  Injectable,
  Logger,
  Inject,
  OnModuleInit,
} from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { RedisService } from '#infrastructure/redis/redis.service';
import { AnalyticsService } from '#infrastructure/grpc/analytics.client';
import { firstValueFrom, timeout, Observable } from 'rxjs';
import { retry } from 'rxjs/operators';
import {
  StudyPatternsResponseDto,
  GoalAnalytics,
  UserInsights,
  LearningPathStats,
  CourseStats,
  LearningAnalyticsDto,
  PathAnalyticsResponseDto,
  StudyRecommendationDto,
} from '#common/dto';
import {
  ANALYTICS_CACHE_CONFIG,
  ANALYTICS_METRICS_CONFIG,
} from './analytics-cache.constants';
import { RequestDeduplicationService } from './request-deduplication.service';
import { PerformanceMetricsService } from '#infrastructure/monitoring/performance-metrics.service';
import { getErrorMessage } from '#common/utils/error.utils';

import { PrismaService } from '#infrastructure/prisma/prisma.service';

@Injectable()
export class LearningAnalyticsService implements OnModuleInit {
  private readonly logger = new Logger(LearningAnalyticsService.name);
  private readonly cacheTtl = 3600; // 1 hour
  private analyticsServiceGrpc!: AnalyticsService;
  private readonly grpcTimeoutMs = 5000;
  private readonly grpcRetries = 2;

  constructor(
    @Inject('ANALYTICS_PACKAGE') private readonly client: ClientGrpc,
    private readonly redisService: RedisService,
    private readonly requestDeduplicationService: RequestDeduplicationService,
    private readonly performanceMetrics: PerformanceMetricsService,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit() {
    this.analyticsServiceGrpc =
      this.client.getService<AnalyticsService>('AnalyticsService');
  }

  /**
   * Helper to call gRPC with timeout and retry
   * Consistent with study-analytics pattern
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
   * Get learning path analytics for a specific path
   */
  async getPathAnalytics(pathId: string): Promise<PathAnalyticsResponseDto> {
    const startTime = Date.now();
    const cacheKey = `${ANALYTICS_CACHE_CONFIG.LEARNING.PATH_ANALYTICS(pathId)}:v2`;

    try {
      const cached = await this.redisService.get<string>(cacheKey);
      if (cached) {
        return JSON.parse(cached) as PathAnalyticsResponseDto;
      }

      const grpcResp = await this.callGrpc(
        this.analyticsServiceGrpc.getPathAnalytics({ pathId }),
      );
      const result: PathAnalyticsResponseDto = {
        pathId: grpcResp.pathId,
        averageCompletionRate: grpcResp.averageCompletionRate,
        averageTimeToComplete: grpcResp.averageTimeToComplete,
      };

      await this.redisService.set(
        cacheKey,
        JSON.stringify(result),
        this.cacheTtl,
      );

      this.performanceMetrics
        .recordMetric({
          endpoint: ANALYTICS_METRICS_CONFIG.ENDPOINTS.LEARNING,
          method: 'getPathAnalytics',
          provider: ANALYTICS_METRICS_CONFIG.PROVIDERS.GRPC,
          userId: pathId,
          responseTimeMs: Date.now() - startTime,
          cacheHit: false,
          success: true,
          timestamp: new Date(),
        })
        .catch((err) => this.logger.error('Error recording metric', err));

      return result;
    } catch (error) {
      this.logger.error(
        `Error getting path analytics: ${getErrorMessage(error)}`,
      );
      throw error;
    }
  }

  /**
   * Get learning goal analytics for a user
   */
  async getGoalAnalytics(userId: string): Promise<GoalAnalytics> {
    try {
      const cacheKey = ANALYTICS_CACHE_CONFIG.LEARNING.GOALS(userId);
      const cached = await this.redisService.get<string>(cacheKey);
      if (cached) {
        return JSON.parse(cached) as GoalAnalytics;
      }

      // Call Rust service via gRPC
      const response = await this.callGrpc(
        this.analyticsServiceGrpc.getGoalAnalytics({
          userId: userId,
          goals: [],
        }),
      );
      const goalAnalytics = response.goalAnalytics;
      if (!goalAnalytics) {
        throw new Error('Analytics service returned no goal analytics payload');
      }

      // Transform Rust response to local interface
      const result: GoalAnalytics = {
        userId: goalAnalytics.userId,
        totalGoals: goalAnalytics.totalGoals,
        activeGoals: goalAnalytics.activeGoals,
        completedGoals: goalAnalytics.completedGoals,
        overdueGoals: goalAnalytics.overdueGoals,
        completionRate: goalAnalytics.completionRate,
        averageCompletionTimeDays:
          goalAnalytics.averageCompletionTimeDays,
        goalsByCategory: goalAnalytics.goalsByCategory,
        goalsByPriority: goalAnalytics.goalsByPriority,
        streakData: {
          currentStreak: goalAnalytics.currentStreak,
          longestStreak: goalAnalytics.longestStreak,
        },
        streakGoalIds: goalAnalytics.streakGoalIds,
        upcomingDeadlines: goalAnalytics.upcomingDeadlines.map((deadline) => ({
          goalId: deadline.goalId,
          title: deadline.title,
          targetDate: deadline.targetDate,
          daysRemaining: deadline.daysRemaining,
        })),
      };

      // Cache the result
      await this.redisService.set(
        cacheKey,
        JSON.stringify(result),
        this.cacheTtl,
      );

      return result;
    } catch (error) {
      this.logger.error(
        `Failed to get goal analytics from Rust via gRPC for user ${userId}: ${String(error)}`,
      );
      throw error;
    }
  }

  /**
   * Get course statistics for a user
   */
  async getCourseStatistics(userId: string): Promise<CourseStats> {
    try {
      const cacheKey = ANALYTICS_CACHE_CONFIG.LEARNING.COURSE_STATS(userId);
      const cached = await this.redisService.get<string>(cacheKey);
      if (cached) {
        return JSON.parse(cached) as CourseStats;
      }

      // Call Rust service via gRPC
      const response = await this.callGrpc(
        this.analyticsServiceGrpc.getCourseStatistics({
          userId: userId,
        }),
      );
      if (!response.courseStats) {
        throw new Error('Rust analytics returned no course statistics');
      }

      const result: CourseStats = {
        totalCourses: response.courseStats.totalCourses,
        completedCourses: response.courseStats.completedCourses,
        completedItems: response.courseStats.completedItems,
        totalStudyTimeMinutes: response.courseStats.totalStudyTimeMinutes,
        averageCourseProgress: response.courseStats.averageCourseProgress,
        completionRate: response.courseStats.completionRate,
      };

      await this.redisService.set(
        cacheKey,
        JSON.stringify(result),
        this.cacheTtl,
      );

      return result;
    } catch (error) {
      this.logger.error(
        `Failed to get course statistics from Rust via gRPC for user ${userId}: ${String(error)}`,
      );
      throw error;
    }
  }

  /**
   * Get learning path statistics for a user
   */
  async getLearningPathStatistics(userId: string): Promise<LearningPathStats> {
    try {
      const cacheKey = ANALYTICS_CACHE_CONFIG.LEARNING.PATH_STATS(userId);
      const cached = await this.redisService.get<string>(cacheKey);
      if (cached) {
        return JSON.parse(cached) as LearningPathStats;
      }

      // Call Rust service via gRPC
      const response = await this.callGrpc(
        this.analyticsServiceGrpc.getLearningPathStatistics({
          userId: userId,
        }),
      );
      if (!response.pathStats) {
        throw new Error('Rust analytics returned no learning-path statistics');
      }

      const result: LearningPathStats = {
        totalLearningPaths: response.pathStats.totalLearningPaths,
        completedLearningPaths: response.pathStats.completedLearningPaths,
        totalStudyTimeMinutes: response.pathStats.totalStudyTimeMinutes,
        averagePathProgress: response.pathStats.averagePathProgress,
      };

      await this.redisService.set(
        cacheKey,
        JSON.stringify(result),
        this.cacheTtl,
      );

      return result;
    } catch (error) {
      this.logger.error(
        `Failed to get learning path statistics from Rust via gRPC for user ${userId}: ${String(error)}`,
      );
      throw error;
    }
  }

  /**
   * Get comprehensive learning analytics for a user
   */
  async getDetailedLearningAnalytics(
    userId: string,
  ): Promise<LearningAnalyticsDto> {
    try {
      const cacheKey = ANALYTICS_CACHE_CONFIG.LEARNING.ANALYTICS(userId);
      const cached = await this.redisService.get<string>(cacheKey);
      if (cached) {
        return JSON.parse(cached) as LearningAnalyticsDto;
      }

      // Call Rust service via gRPC
      const response = await this.callGrpc(
        this.analyticsServiceGrpc.getDetailedLearningAnalytics({
          userId: userId,
        }),
      );

      // Transform Rust response to local interface
      const userSummary = response.userLearningSummary;
      const goalAnalytics = response.goalAnalytics;
      const courseStats = response.courseStats;
      const pathStats = response.pathStats;
      const engagementMetrics = response.engagementMetrics;
      const performanceMetrics = response.performanceMetrics;
      if (
        !response.userId ||
        !userSummary ||
        !goalAnalytics ||
        !courseStats ||
        !pathStats ||
        !engagementMetrics ||
        !performanceMetrics
      ) {
        throw new Error('Rust analytics returned an incomplete learning summary');
      }

      const result: LearningAnalyticsDto = {
        userId: response.userId,
        userLearningSummary: {
          totalStudyTime: userSummary.totalStudyTime,
          averageSessionLength: userSummary.averageSessionLength,
          averageScore: userSummary.averageScore,
          currentStreak: userSummary.currentStreak,
          longestStreak: userSummary.longestStreak,
          strongestSubjects: userSummary.strongestSubjects,
          weakestSubjects: userSummary.weakestSubjects,
        },
        goalAnalytics: {
          userId: goalAnalytics.userId,
          totalGoals: goalAnalytics.totalGoals,
          activeGoals: goalAnalytics.activeGoals,
          completedGoals: goalAnalytics.completedGoals,
          overdueGoals: goalAnalytics.overdueGoals,
          completionRate: goalAnalytics.completionRate,
          averageCompletionTimeDays: goalAnalytics.averageCompletionTimeDays,
          goalsByCategory: goalAnalytics.goalsByCategory,
          goalsByPriority: goalAnalytics.goalsByPriority,
          streakData: {
            currentStreak: goalAnalytics.currentStreak,
            longestStreak: goalAnalytics.longestStreak,
          },
          streakGoalIds: goalAnalytics.streakGoalIds,
          upcomingDeadlines: goalAnalytics.upcomingDeadlines.map((deadline: {
            goalId: string;
            title: string;
            targetDate: string;
            daysRemaining: number;
          }) => ({
            goalId: deadline.goalId,
            title: deadline.title,
            targetDate: deadline.targetDate,
            daysRemaining: deadline.daysRemaining,
          })),
        },
        courseStats: {
          totalCourses: courseStats.totalCourses,
          completedCourses: courseStats.completedCourses,
          completedItems: courseStats.completedItems,
          totalStudyTimeMinutes: courseStats.totalStudyTimeMinutes,
          averageCourseProgress: courseStats.averageCourseProgress,
          completionRate: courseStats.completionRate,
        },
        pathStats: {
          totalLearningPaths: pathStats.totalLearningPaths,
          completedLearningPaths: pathStats.completedLearningPaths,
          totalStudyTimeMinutes: pathStats.totalStudyTimeMinutes,
          averagePathProgress: pathStats.averagePathProgress,
        },
        engagementMetrics: {
          userId: engagementMetrics.userId,
          dailyActiveStreak: engagementMetrics.dailyActiveStreak,
          weeklyActiveStreak: engagementMetrics.weeklyActiveStreak,
          lastActivityDate: engagementMetrics.lastActivityDate || null,
          sessionCount: engagementMetrics.sessionCount,
          averageSessionDuration: engagementMetrics.averageSessionDuration,
          mostActiveTimeOfDay: engagementMetrics.mostActiveTimeOfDay,
          mostActiveDayOfWeek: engagementMetrics.mostActiveDayOfWeek,
        },
        performanceMetrics: {
          averageAssessmentScore: performanceMetrics.averageAssessmentScore,
          passRate: performanceMetrics.passRate,
          weaknessAreas: performanceMetrics.weaknessAreas,
          strengthAreas: performanceMetrics.strengthAreas,
          improvementRate: performanceMetrics.improvementRate,
        },
        progressTrends: response.progressTrends.map((trend) => ({
          date: trend.date ? new Date(trend.date) : undefined,
          value: trend.value,
          type: trend.type,
        })),
        courseProgressTrends: response.courseProgressTrends.map((trend) => ({
          date: trend.date ? new Date(trend.date) : undefined,
          value: trend.value,
          type: trend.type,
        })),
      };

      await this.redisService.set(
        cacheKey,
        JSON.stringify(result),
        this.cacheTtl,
      );

      return result;
    } catch (error) {
      this.logger.error(
        `Failed to get detailed analytics from Rust via gRPC for user ${userId}: ${String(error)}`,
      );
      throw error;
    }
  }

  /**
   * Return only the performance_metrics block from detailed learning analytics
   * (convenience helper for callers that only need performance metrics)
   */
  async calculatePerformanceMetrics(
    userId: string,
  ): Promise<Record<string, unknown>> {
    try {
      const detailed = await this.getDetailedLearningAnalytics(userId);
      return (detailed.performanceMetrics || {}) as unknown as Record<
        string,
        unknown
      >;
    } catch (err) {
      this.logger.warn(
        `calculatePerformanceMetrics failed for ${userId}: ${getErrorMessage(err)}`,
      );
      throw err;
    }
  }

  /** Get user-specific learning insights from Rust. */
  async getUserInsights(userId: string): Promise<UserInsights> {
    const startTime = Date.now();
    const cacheKey = ANALYTICS_CACHE_CONFIG.LEARNING.USER_INSIGHTS(userId);

    try {
      const cached = await this.redisService.get<string>(cacheKey);
      if (cached) {
        return JSON.parse(cached) as UserInsights;
      }

      // Delegate to Rust detailed analytics for robust insights
      const resp: any = await this.callGrpc(
        this.analyticsServiceGrpc.getDetailedLearningAnalytics({
          userId: userId,
        }),
      );

      const userLearning = resp.userLearningSummary;
      const goalAnalytics = resp.goalAnalytics;
      if (!userLearning || !goalAnalytics) {
        throw new Error('Rust analytics returned an incomplete user insight response');
      }

      const insights: UserInsights = {
        userId,
        recommendedNextSteps: resp.progressTrends
          .slice(0, 3)
          .map((trend: { metadata: string; type: string }) =>
            trend.metadata || trend.type,
          ),
        strengths: userLearning.strongestSubjects,
        areasForImprovement: userLearning.weakestSubjects,
        learningVelocity: userLearning.averageSessionLength,
        goalAchievementRate: goalAnalytics.completionRate,
        estimatedCompletionDate:
          goalAnalytics?.upcomingDeadlines[0]?.targetDate ?? null,
      };

      await this.redisService.set(
        cacheKey,
        JSON.stringify(insights),
        this.cacheTtl,
      );

      await this.performanceMetrics.recordMetric({
        endpoint: ANALYTICS_METRICS_CONFIG.ENDPOINTS.LEARNING,
        method: 'getUserInsights',
        provider: ANALYTICS_METRICS_CONFIG.PROVIDERS.GRPC,
        userId,
        responseTimeMs: Date.now() - startTime,
        cacheHit: false,
        success: true,
        timestamp: new Date(),
      });

      return insights;
    } catch (error) {
      this.logger.warn(`gRPC getUserInsights failed: ${String(error)}`);
      await this.performanceMetrics.recordMetric({
        endpoint: ANALYTICS_METRICS_CONFIG.ENDPOINTS.LEARNING,
        method: 'getUserInsights',
        provider: ANALYTICS_METRICS_CONFIG.PROVIDERS.GRPC,
        userId,
        responseTimeMs: Date.now() - startTime,
        cacheHit: false,
        success: false,
        timestamp: new Date(),
      });
      throw error;
    }
  }

  // ==================== STUDY PATTERNS & ENGAGEMENT ====================

  /**
   * Analyze study patterns for a user (gRPC only)
   * Consolidates implementations from:
   * - ai-analytics.service.ts (original gRPC approach)
   * - learning-path-recommendations.service.ts (local analysis)
   *
   * Propagates Rust gRPC failures to callers.
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
        },
      );
    } catch (error) {
      this.logger.warn(
        `gRPC analyzeStudyPatterns failed: ${getErrorMessage(error)}`,
      );
      await this.performanceMetrics.recordMetric({
        endpoint: ANALYTICS_METRICS_CONFIG.ENDPOINTS.LEARNING,
        method: 'analyzeStudyPatterns',
        provider: ANALYTICS_METRICS_CONFIG.PROVIDERS.GRPC,
        userId,
        responseTimeMs: Date.now() - startTime,
        cacheHit: false,
        success: false,
        timestamp: new Date(),
      });
      throw error;
    }
  }

  /**
   * Get user engagement metrics (gRPC only)
   */
  async getUserEngagement(userId: string): Promise<{
    userId: string;
    totalStudyTimeMinutes: number;
    sessions: number;
    streakDays: number;
    weeklyActiveStreak: number;
    lastActivityDate: string | null;
  }> {
    const startTime = Date.now();
    const cacheKey = `${ANALYTICS_CACHE_CONFIG.LEARNING.ENGAGEMENT(userId)}:v2`;

    try {
      const cached = await this.redisService.get<string>(cacheKey);
      if (typeof cached === 'string') {
        return JSON.parse(cached);
      }

      const detailed = await this.getDetailedLearningAnalytics(userId);
      const summary = detailed.userLearningSummary;
      const metrics = detailed.engagementMetrics;
      if (!summary || !metrics) {
        throw new Error(
          'Rust analytics omitted user learning summary or engagement metrics',
        );
      }

      const mapped = {
        userId,
        totalStudyTimeMinutes: summary.totalStudyTime,
        sessions: metrics.sessionCount,
        streakDays: metrics.dailyActiveStreak,
        weeklyActiveStreak: metrics.weeklyActiveStreak,
        lastActivityDate: metrics.lastActivityDate
          ? typeof metrics.lastActivityDate === 'string'
            ? metrics.lastActivityDate
            : metrics.lastActivityDate.toISOString()
          : null,
      };

      await this.redisService.set(
        cacheKey,
        JSON.stringify(mapped),
        this.cacheTtl,
      );

      await this.performanceMetrics.recordMetric({
        endpoint: ANALYTICS_METRICS_CONFIG.ENDPOINTS.LEARNING,
        method: 'getUserEngagement',
        provider: ANALYTICS_METRICS_CONFIG.PROVIDERS.GRPC,
        userId,
        responseTimeMs: Date.now() - startTime,
        cacheHit: false,
        success: true,
        timestamp: new Date(),
      });

      return mapped;
    } catch (error) {
      this.logger.warn(
        `getUserEngagement failed for ${userId}: ${getErrorMessage(error)}`,
      );
      await this.performanceMetrics.recordMetric({
        endpoint: ANALYTICS_METRICS_CONFIG.ENDPOINTS.LEARNING,
        method: 'getUserEngagement',
        provider: ANALYTICS_METRICS_CONFIG.PROVIDERS.GRPC,
        userId,
        responseTimeMs: Date.now() - startTime,
        cacheHit: false,
        success: false,
        timestamp: new Date(),
      });
      throw error;
    }
  }

  // ==================== PREDICTIONS ====================

  async getBktPredictions(userId: string) {
    const states = await this.prisma.userSkillState.findMany({
      where: { userId },
      select: {
        skillId: true,
        pKnown: true,
        attempts: true,
        skill: { select: { name: true } },
      },
      orderBy: { pKnown: 'asc' },
      take: 50,
    });

    const skills = await Promise.all(
      states.map(async (state) => {
        const result = await this.callGrpc(
          this.analyticsServiceGrpc.predictBkt({
            userId,
            skillId: state.skillId,
            featureVector: [],
          }),
        );
        return {
          skillId: state.skillId,
          skillName: state.skill.name,
          masteryProbability: result.pKnown,
          nextCorrectProbability: result.pNextCorrect,
          observedAttempts: state.attempts,
        };
      }),
    );

    return { userId, skills, generatedAt: new Date() };
  }

  /**
   * Extract features from user learning history for prediction
   */
  extractPredictionFeatures(
    userId: string,
    recentScores: number[],
    studyDuration: number,
    engagementScore: number,
  ): Promise<number[]> {
    try {
      const avgScore =
        recentScores.length > 0
          ? recentScores.reduce((a, b) => a + b, 0) / recentScores.length
          : 0;

      const scoreVariance = this.calculateVariance(recentScores);
      const consistency = scoreVariance > 0 ? 1 / (1 + scoreVariance) : 0.5;

      return Promise.resolve([
        avgScore,
        consistency,
        studyDuration,
        engagementScore,
        recentScores.length > 0 ? recentScores[recentScores.length - 1] : 0,
      ]);
    } catch (error) {
      this.logger.error(
        `Failed to extract features for user ${userId}: ${String(error)}`,
      );
      throw error;
    }
  }

  // ==================== RECOMMENDATIONS ====================

  /**
   * Get personalized learning path recommendations (gRPC only)
   * Consolidates implementations from:
   * - learning-path-recommendations.service.ts (with local scoring)
   * - learning-path-recommendation-analytics.service.ts (ML-based with fallback)
   * - ai-analytics.service.ts (via gRPC client)
   *
   * Now strictly gRPC-first.
   */
  async getPathRecommendations(
    userId: string,
    limit: number = 10,
  ): Promise<
    Array<{
      pathId: string;
      score: number;
      reasons: string[];
      confidence: number;
    }>
  > {
    const startTime = Date.now();
    const cacheKey = ANALYTICS_CACHE_CONFIG.RECOMMENDATIONS.PATH(userId, limit);
    const dedupKey = ANALYTICS_CACHE_CONFIG.DEDUP(cacheKey);

    try {
      const cached = await this.redisService.get<string>(cacheKey);
      if (typeof cached === 'string') {
        return JSON.parse(cached);
      }

      return await this.requestDeduplicationService.executeWithDedup(
        dedupKey,
        async () => {
          const grpcResp = await this.callGrpc(
            this.analyticsServiceGrpc.getRecommendations({
              userId: userId,
              limit,
            }),
          );

          const mapped = grpcResp.items
            .slice(0, limit)
            .filter((rec) => Boolean(rec.id))
            .map((rec) => ({
              pathId: rec.id,
              score: rec.score,
              reasons: rec.reason
                ? [rec.reason]
                : ['Recommended based on your profile'],
              confidence: rec.score,
            }));

          await this.redisService.set(
            cacheKey,
            JSON.stringify(mapped),
            this.cacheTtl,
          );

          await this.performanceMetrics.recordMetric({
            endpoint: ANALYTICS_METRICS_CONFIG.ENDPOINTS.LEARNING,
            method: 'getPathRecommendations',
            provider: ANALYTICS_METRICS_CONFIG.PROVIDERS.GRPC,
            userId,
            responseTimeMs: Date.now() - startTime,
            cacheHit: false,
            success: true,
            timestamp: new Date(),
          });

          return mapped;
        },
      );
    } catch (error) {
      this.logger.warn(
        `gRPC getPathRecommendations failed: ${getErrorMessage(error)}`,
      );
      await this.performanceMetrics.recordMetric({
        endpoint: ANALYTICS_METRICS_CONFIG.ENDPOINTS.LEARNING,
        method: 'getPathRecommendations',
        provider: ANALYTICS_METRICS_CONFIG.PROVIDERS.GRPC,
        userId,
        responseTimeMs: Date.now() - startTime,
        cacheHit: false,
        success: false,
        timestamp: new Date(),
      });
      throw error;
    }
  }

  /**
   * Get collaborative filtering recommendations (gRPC only)
   * Uses similarity-based filtering to recommend items liked by similar users.
   */
  async getCollaborativeRecommendations(
    userId: string,
    limit: number = 5,
  ): Promise<Array<{ item_id: string; score: number; reason: string }>> {
    const startTime = Date.now();
    const cacheKey = `${ANALYTICS_CACHE_CONFIG.RECOMMENDATIONS.COLLABORATIVE(
      userId,
      limit,
    )}:v2`;

    try {
      const cached = await this.redisService.get<string>(cacheKey);
      if (typeof cached === 'string') {
        return JSON.parse(cached) as Array<{
          item_id: string;
          score: number;
          reason: string;
        }>;
      }

      const grpcResp = await this.callGrpc(
        this.analyticsServiceGrpc.getCollaborativeRecommendations({
          userId,
          limit,
        }),
      );

      const mapped = grpcResp.items.slice(0, limit).map((recommendation) => ({
        item_id: recommendation.itemId,
        score: recommendation.score,
        reason: recommendation.reason,
      }));

      await this.redisService.set(
        cacheKey,
        JSON.stringify(mapped),
        this.cacheTtl,
      );

      await this.performanceMetrics.recordMetric({
        endpoint: ANALYTICS_METRICS_CONFIG.ENDPOINTS.LEARNING,
        method: 'getCollaborativeRecommendations',
        provider: ANALYTICS_METRICS_CONFIG.PROVIDERS.GRPC,
        userId,
        responseTimeMs: Date.now() - startTime,
        cacheHit: false,
        success: true,
        timestamp: new Date(),
      });

      return mapped;
    } catch (error) {
      this.logger.warn(
        `gRPC getCollaborativeRecommendations failed: ${getErrorMessage(error)}`,
      );
      await this.performanceMetrics.recordMetric({
        endpoint: ANALYTICS_METRICS_CONFIG.ENDPOINTS.LEARNING,
        method: 'getCollaborativeRecommendations',
        provider: ANALYTICS_METRICS_CONFIG.PROVIDERS.GRPC,
        userId,
        responseTimeMs: Date.now() - startTime,
        cacheHit: false,
        success: false,
        timestamp: new Date(),
      });
      throw error;
    }
  }

  /**
   * Get study material recommendations for knowledge gaps (gRPC only)
   */
  async generateStudyRecommendations(
    userId: string,
    knowledgeGaps: string[],
  ): Promise<StudyRecommendationDto[]> {
    const cacheKey = `${ANALYTICS_CACHE_CONFIG.RECOMMENDATIONS.STUDY_WITH_GAPS(
      userId,
      knowledgeGaps,
    )}:v2`;

    try {
      const cached = await this.redisService.get<string>(cacheKey);
      if (typeof cached === 'string') {
        return JSON.parse(cached) as StudyRecommendationDto[];
      }

      const grpcResp = await this.callGrpc(
        this.analyticsServiceGrpc.generateStudyRecommendations({
          userId,
          knowledgeGaps,
        }),
      );
      const mapped: StudyRecommendationDto[] = grpcResp.recommendations;

      await this.redisService.set(
        cacheKey,
        JSON.stringify(mapped),
        24 * 60 * 60, // 1 day TTL
      );

      return mapped;
    } catch (error) {
      this.logger.warn(
        `gRPC generateStudyRecommendations failed: ${getErrorMessage(error)}`,
      );
      throw error;
    }
  }

  /**
   * Get trending learning paths (gRPC only)
   */
  async getTrendingPaths(
    limit: number = 5,
  ): Promise<Array<{ path_id: string; enrollments: number }>> {
    const cacheKey = `trending_paths:${limit}:v2`;

    try {
      const cached = await this.redisService.get<string>(cacheKey);
      if (typeof cached === 'string') {
        return JSON.parse(cached);
      }

      const grpcResp = await this.callGrpc(
        this.analyticsServiceGrpc.getTrendingPaths({ limit }),
      );

      const mapped = grpcResp.paths
        .slice(0, limit)
        .map((path) => ({
          path_id: path.pathId,
          enrollments: path.popularity,
        }));

      await this.redisService.set(cacheKey, JSON.stringify(mapped), 3600);

      return mapped;
    } catch (error) {
      this.logger.warn(
        `gRPC getTrendingPaths failed: ${getErrorMessage(error)}`,
      );
      throw error;
    }
  }

  // ==================== CACHE INVALIDATION ====================

  /**
   * Invalidate all learning analytics caches for a user
   */
  async invalidateUserCaches(userId: string): Promise<void> {
    try {
      await Promise.all([
        this.redisService.del(ANALYTICS_CACHE_CONFIG.LEARNING.GOALS(userId)),
        this.redisService.del(
          ANALYTICS_CACHE_CONFIG.LEARNING.COURSE_STATS(userId),
        ),
        this.redisService.del(
          ANALYTICS_CACHE_CONFIG.LEARNING.PATH_STATS(userId),
        ),
        this.redisService.del(
          ANALYTICS_CACHE_CONFIG.LEARNING.ANALYTICS(userId),
        ),
        this.redisService.del(
          `${ANALYTICS_CACHE_CONFIG.LEARNING.PATTERNS(userId)}:v2`,
        ),
        this.redisService.del(
          `${ANALYTICS_CACHE_CONFIG.LEARNING.ENGAGEMENT(userId)}:v2`,
        ),
        this.redisService.del(
          ANALYTICS_CACHE_CONFIG.RECOMMENDATIONS.PATH(userId, 10),
        ),
        this.redisService.del(
          ANALYTICS_CACHE_CONFIG.RECOMMENDATIONS.PREDICTION(userId),
        ),
      ]);
      this.requestDeduplicationService.invalidatePattern(`dedup:*:${userId}`);
      this.logger.debug(`Caches invalidated for user ${userId}`);
    } catch (error) {
      this.logger.warn(
        `Failed to invalidate caches for ${userId}: ${getErrorMessage(error)}`,
      );
    }
  }

  // ==================== HELPER METHODS ====================

  /**
   * Calculate variance of array values
   */
  private calculateVariance(arr: number[]): number {
    if (!arr || arr.length === 0) {
      return 0;
    }

    const mean = arr.reduce((s, v) => s + v, 0) / arr.length;
    const variance =
      arr.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / arr.length;
    return variance;
  }

  /**
   * Generate human-readable explanations for predictions based on input features.
   */
  private generateQualitativeExplanations(
    features: number[],
    probability: number,
  ): string[] {
    const explanations: string[] = [];
    const [avgScore, consistency,  engagement, recentScore] =
      features;

    // 1. Performance-based explanations
    if (avgScore > 80) {
      explanations.push('High average scores across recent assessments.');
    } else if (avgScore < 60) {
      explanations.push(
        'Assessment scores indicate potential gaps in foundational knowledge.',
      );
    }

    // 2. Consistency-based
    if (consistency > 0.7) {
      explanations.push(
        'Strong performance consistency suggests stable mastery.',
      );
    } else if (consistency < 0.4) {
      explanations.push(
        'Volatile performance across topics suggests inconsistent grasp of material.',
      );
    }

    // 3. Engagement-based
    if (engagement > 0.7) {
      explanations.push(
        'High platform engagement is a strong indicator of success.',
      );
    } else if (engagement < 0.3) {
      explanations.push(
        'Increased active study time is recommended to improve target outcomes.',
      );
    }

    // 4. Trend-based
    if (recentScore > avgScore + 10) {
      explanations.push(
        'Recent improvement trend detected; positive momentum.',
      );
    }

    // 5. General conclusion
    if (probability > 0.8) {
      explanations.push(
        'Current trajectory strongly aligns with exam readiness.',
      );
    } else if (probability < 0.4) {
      explanations.push(
        'Prioritizing review of "High-Risk" areas is advised to bridge gaps.',
      );
    }

    if (explanations.length === 0) {
      explanations.push(
        'Performance metrics are currently within normal baseline ranges.',
      );
    }

    return explanations;
  }

  /**
   * Get comprehensive learning analytics from Rust.
   */
  async getLearningAnalytics(userId: string): Promise<LearningAnalyticsDto> {
    const detailed = await this.getDetailedLearningAnalytics(userId);
    const courseStats = detailed.courseStats;
    const pathStats = detailed.pathStats;
    const summary = detailed.userLearningSummary;
    if (!courseStats || !pathStats || !summary) {
      throw new Error('Rust analytics returned an incomplete learning summary');
    }

    return {
      ...detailed,
      totalCourses: courseStats.totalCourses,
      completedCourses: courseStats.completedCourses,
      totalLearningPaths: pathStats.totalLearningPaths,
      completedLearningPaths: pathStats.completedLearningPaths,
      totalStudyTimeMinutes: summary.totalStudyTime,
      averageCourseProgress: courseStats.averageCourseProgress,
      averagePathProgress: pathStats.averagePathProgress,
      totalCoursesEnrolled: courseStats.totalCourses,
      totalCoursesCompleted: courseStats.completedCourses,
      totalTimeSpent: summary.totalStudyTime,
      averageCompletionRate: courseStats.averageCourseProgress,
      strongestSubjects: summary.strongestSubjects,
      weakestSubjects: summary.weakestSubjects,
      learningStreak: summary.currentStreak,
      lastActivityDate: detailed.engagementMetrics?.lastActivityDate ?? null,
    };
  }
}
