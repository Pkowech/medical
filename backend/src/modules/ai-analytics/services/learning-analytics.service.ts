import {
  Injectable,
  Logger,
  Inject,
  OnModuleInit,
  NotFoundException,
} from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { RedisService } from '#infrastructure/redis/redis.service';
import { AnalyticsService } from '#infrastructure/grpc/analytics.client';
import { firstValueFrom, timeout, Observable } from 'rxjs';
import { retry } from 'rxjs/operators';
import {
  PredictionResponseDto,
  StudyPatternsResponseDto,
  GoalAnalytics,
  SystemAnalytics,
  UserInsights,
  LearningPathStats,
  CourseStats,
  LearningAnalyticsDto,
  PathAnalyticsResponseDto,
} from '#common/dto';
import { PredictionType } from '@prisma/client';
import {
  ANALYTICS_CACHE_CONFIG,
  ANALYTICS_METRICS_CONFIG,
} from './analytics-cache.constants';
import { RequestDeduplicationService } from './request-deduplication.service';
import { PerformanceMetricsService } from '#infrastructure/monitoring/performance-metrics.service';
import { getErrorMessage } from '#common/utils/error.utils';
import { CourseAnalyticsService } from './course-analytics.service';

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
    private readonly courseAnalyticsService: CourseAnalyticsService,
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
    const cacheKey = ANALYTICS_CACHE_CONFIG.LEARNING.PATH_ANALYTICS(pathId);

    try {
      const cached = await this.redisService.get<string>(cacheKey);
      if (cached) {
        return JSON.parse(cached) as PathAnalyticsResponseDto;
      }

      const grpcResp: any = await this.callGrpc(
        this.analyticsServiceGrpc.getPathAnalytics({ path_id: pathId }),
      );

      const result: PathAnalyticsResponseDto = {
        pathId,
        title: grpcResp.title ?? '',
        enrolledUsers:
          grpcResp.total_enrollments ?? grpcResp.totalEnrollments ?? 0,
        activeUsers:
          grpcResp.active_enrollments ?? grpcResp.activeEnrollments ?? 0,
        averageCompletionTime:
          grpcResp.avg_completion_time ?? grpcResp.averageCompletionTime ?? 0,
        completionRate:
          grpcResp.completion_rate ?? grpcResp.completionRate ?? 0,
        metrics: {
          completedEnrollments:
            grpcResp.completed_enrollments ??
            grpcResp.completedEnrollments ??
            0,
          averageProgressPercentage:
            grpcResp.average_progress ?? grpcResp.averageProgress ?? 0,
          dropoutRate: grpcResp.dropout_rate ?? grpcResp.dropoutRate ?? 0,
          userSatisfaction: {
            averageRating: 0,
            totalRatings: 0,
            ratingDistribution: {},
          },
          engagementMetrics: {
            averageSessionDuration:
              grpcResp.engagement_metrics?.average_session_duration ?? 0,
            sessionsPerWeek:
              grpcResp.engagement_metrics?.sessions_per_week ?? 0,
            streakData: {
              averageStreak:
                grpcResp.engagement_metrics?.streak_maintenance ?? 0,
              maxStreak: 0,
            },
          },
          milestoneAnalytics: [],
          difficultyFeedback: { tooEasy: 0, justRight: 0, tooHard: 0 },
          bottlenecks: [],
        },
        userProgress: [],
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
      // Return empty default
      return {
        pathId,
        title: '',
        enrolledUsers: 0,
        activeUsers: 0,
        averageCompletionTime: 0,
        completionRate: 0,
        metrics: {},
        userProgress: [],
      };
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
          user_id: userId,
          goals: [],
        }),
      );

      // Transform Rust response to local interface
      const result: GoalAnalytics = {
        userId: response.goal_analytics.user_id,
        totalGoals: response.goal_analytics.total_goals,
        activeGoals: response.goal_analytics.active_goals,
        completedGoals: response.goal_analytics.completed_goals,
        overdueGoals: response.goal_analytics.overdue_goals,
        completionRate: response.goal_analytics.completion_rate,
        averageCompletionTimeDays:
          response.goal_analytics.average_completion_time_days,
        goalsByCategory: response.goal_analytics.goals_by_category,
        goalsByPriority: response.goal_analytics.goals_by_priority,
        streakData: {
          currentStreak: response.goal_analytics.current_streak,
          longestStreak: response.goal_analytics.longest_streak,
        },
        streakGoalIds: response.goal_analytics.streak_goal_ids,
        upcomingDeadlines: (
          response.goal_analytics.upcoming_deadlines || []
        ).map((deadline: any) => ({
          goalId: deadline.goal_id,
          title: deadline.title,
          targetDate: deadline.target_date,
          daysRemaining: deadline.days_remaining,
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
      throw new NotFoundException(
        `Unable to compute goal analytics for user ${userId}`,
      );
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
          user_id: userId,
        }),
      );

      const result: CourseStats = {
        totalCourses: response.course_stats.total_courses,
        completedCourses: response.course_stats.completed_courses,
        totalStudyTimeMinutes: response.course_stats.total_study_time_minutes,
        averageCourseProgress: response.course_stats.average_course_progress,
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
      throw new NotFoundException(
        `Unable to compute course statistics for user ${userId}`,
      );
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
          user_id: userId,
        }),
      );

      const result: LearningPathStats = {
        totalLearningPaths: response.path_stats.total_learning_paths,
        completedLearningPaths: response.path_stats.completed_learning_paths,
        totalStudyTimeMinutes: response.path_stats.total_study_time_minutes,
        averagePathProgress: response.path_stats.average_path_progress,
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
      throw new NotFoundException(
        `Unable to compute learning path statistics for user ${userId}`,
      );
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
          user_id: userId,
        }),
      );

      // Transform Rust response to local interface
      const result: LearningAnalyticsDto = {
        userId: response.user_id,
        userLearningSummary: {
          totalStudyTime: response.user_learning_summary.total_study_time,
          averageSessionLength:
            response.user_learning_summary.average_session_length,
          averageScore: response.user_learning_summary.average_score,
          currentStreak: response.user_learning_summary.current_streak,
          longestStreak: response.user_learning_summary.longest_streak,
          strongestSubjects: response.user_learning_summary.strongest_subjects,
          weakestSubjects: response.user_learning_summary.weakest_subjects,
        },
        goalAnalytics: {
          userId: response.goal_analytics.user_id,
          totalGoals: response.goal_analytics.total_goals,
          activeGoals: response.goal_analytics.active_goals,
          completedGoals: response.goal_analytics.completed_goals,
          overdueGoals: response.goal_analytics.overdue_goals,
          completionRate: response.goal_analytics.completion_rate,
          averageCompletionTimeDays:
            response.goal_analytics.average_completion_time_days,
          goalsByCategory: response.goal_analytics.goals_by_category,
          goalsByPriority: response.goal_analytics.goals_by_priority,
          streakData: {
            currentStreak: response.goal_analytics.current_streak,
            longestStreak: response.goal_analytics.longest_streak,
          },
          streakGoalIds: response.goal_analytics.streak_goal_ids,
          upcomingDeadlines: (
            response.goal_analytics.upcoming_deadlines || []
          ).map((deadline: any) => ({
            goalId: deadline.goal_id,
            title: deadline.title,
            targetDate: deadline.target_date,
            daysRemaining: deadline.days_remaining,
          })),
        },
        courseStats: {
          totalCourses: response.course_stats.total_courses,
          completedCourses: response.course_stats.completed_courses,
          totalStudyTimeMinutes: response.course_stats.total_study_time_minutes,
          averageCourseProgress: response.course_stats.average_course_progress,
        },
        pathStats: {
          totalLearningPaths: response.path_stats.total_learning_paths,
          completedLearningPaths: response.path_stats.completed_learning_paths,
          totalStudyTimeMinutes: response.path_stats.total_study_time_minutes,
          averagePathProgress: response.path_stats.average_path_progress,
        },
        engagementMetrics: {
          userId: response.engagement_metrics.user_id,
          dailyActiveStreak: response.engagement_metrics.daily_active_streak,
          weeklyActiveStreak: response.engagement_metrics.weekly_active_streak,
          lastActivityDate: response.engagement_metrics.last_activity_date,
          sessionCount: response.engagement_metrics.session_count,
          averageSessionDuration:
            response.engagement_metrics.average_session_duration,
          mostActiveTimeOfDay:
            response.engagement_metrics.most_active_time_of_day,
          mostActiveDayOfWeek:
            response.engagement_metrics.most_active_day_of_week,
        },
        performanceMetrics: {
          averageAssessmentScore:
            response.performance_metrics.average_assessment_score,
          passRate: response.performance_metrics.pass_rate,
          weaknessAreas: response.performance_metrics.weakness_areas,
          strengthAreas: response.performance_metrics.strength_areas,
          improvementRate: response.performance_metrics.improvement_rate,
        },
        progressTrends: (response.progress_trends || []).map((trend: any) => ({
          date: trend.date,
          value: trend.value,
          type: trend.type,
          metadata: trend.metadata,
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
      throw new NotFoundException(
        `Unable to compute detailed analytics for user ${userId}`,
      );
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
      return {};
    }
  }

  /**
   * Get system-wide learning analytics via gRPC (stubbed for now to bypass local)
   */
  async getSystemAnalytics(): Promise<SystemAnalytics> {
    try {
      const cacheKey = 'system_analytics';
      const cached = await this.redisService.get<string>(cacheKey);
      if (cached) {
        return JSON.parse(cached) as SystemAnalytics;
      }

      // This would ideally call a gRPC method like getSystemAnalytics
      return {
        totalUsers: 0,
        activeUsers: 0,
        averageEngagementScore: 0,
        averageCompletionRate: 0,
        totalStudyTime: 0,
        topCourses: [],
        topLearningPaths: [],
      };
    } catch (error) {
      this.logger.error('Failed to get system analytics:', String(error));
      throw new NotFoundException('Unable to compute system analytics');
    }
  }

  /**
   * Get user-specific learning insights via gRPC (stubbed for now to bypass local)
   */
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
          user_id: userId,
        }),
      );

      const userLearning = resp.user_learning_summary || {};
      const goalAnalytics = resp.goal_analytics || {};

      const insights: UserInsights = {
        userId,
        recommendedNextSteps: (resp.progress_trends || [])
          .slice(0, 3)
          .map((t: any) => t.metadata || t.type || ''),
        strengths: userLearning.strongest_subjects || [],
        areasForImprovement: userLearning.weakest_subjects || [],
        learningVelocity: userLearning.average_session_length || 0,
        estimatedCompletionDate:
          (goalAnalytics.upcoming_deadlines &&
            goalAnalytics.upcoming_deadlines[0] &&
            goalAnalytics.upcoming_deadlines[0].target_date) ||
          new Date().toISOString(),
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
      throw new NotFoundException(
        `Unable to compute insights for user ${userId}`,
      );
    }
  }

  // ==================== STUDY PATTERNS & ENGAGEMENT ====================

  /**
   * Analyze study patterns for a user (gRPC only)
   * Consolidates implementations from:
   * - ai-analytics.service.ts (original gRPC approach)
   * - learning-path-recommendations.service.ts (local analysis)
   *
   * Returns empty DTO on failure instead of throwing.
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
          const grpcResp: any = await this.callGrpc(
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
                  (grpcResp.user_learning_summary.average_session_length || 0) /
                    60,
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
      // Return empty DTO on failure
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
    const cacheKey = ANALYTICS_CACHE_CONFIG.LEARNING.ENGAGEMENT(userId);

    try {
      const cached = await this.redisService.get<string>(cacheKey);
      if (typeof cached === 'string') {
        return JSON.parse(cached);
      }

      const detailed = await this.getDetailedLearningAnalytics(userId);
      const metrics = detailed.engagementMetrics;

      const mapped = {
        userId,
        totalStudyTimeMinutes:
          detailed.userLearningSummary?.totalStudyTime || 0,
        sessions: metrics?.sessionCount || 0,
        streakDays: metrics?.dailyActiveStreak || 0,
        weeklyActiveStreak: metrics?.weeklyActiveStreak || 0,
        lastActivityDate: metrics?.lastActivityDate
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
      return {
        userId,
        totalStudyTimeMinutes: 0,
        sessions: 0,
        streakDays: 0,
        weeklyActiveStreak: 0,
        lastActivityDate: null,
      };
    }
  }

  // ==================== PREDICTIONS ====================

  /**
   * Predict learning success rate using ML model (gRPC only)
   * Consolidates implementations from:
   * - learning-ai-predictions.service.ts (adapter with HTTP fallback)
   * - learning-prediction-analytics.service.ts (HTTP with local fallback)
   *
   * Now strictly gRPC with graceful fallback to empty prediction.
   */
  async predictSuccessRate(
    userId: string,
    features: number[],
  ): Promise<PredictionResponseDto> {
    const startTime = Date.now();
    const cacheKey = ANALYTICS_CACHE_CONFIG.RECOMMENDATIONS.PREDICTION(userId);
    const dedupKey = ANALYTICS_CACHE_CONFIG.DEDUP(cacheKey);

    try {
      const cached = await this.redisService.get<string>(cacheKey);
      if (typeof cached === 'string') {
        return JSON.parse(cached) as PredictionResponseDto;
      }

      return await this.requestDeduplicationService.executeWithDedup(
        dedupKey,
        async () => {
          const grpcResp: any = await this.callGrpc(
            this.analyticsServiceGrpc.predictSuccessRate({
              user_id: userId,
              features,
            }),
          );

          const mapped: PredictionResponseDto = {
            userId,
            type: PredictionType.successProbability,
            probability: grpcResp.probability || 0.5,
            confidence: grpcResp.confidence || 0.7,
            factors: grpcResp.factors || ['feature_based_estimate'],
            predictedSuccessRate: grpcResp.predicted_success_rate || 0.5,
            recommendedStudyTime: grpcResp.recommended_study_time || 45,
            explanations: this.generateQualitativeExplanations(
              features,
              grpcResp.probability || 0.5,
            ),
          };

          await this.redisService.set(
            cacheKey,
            JSON.stringify(mapped),
            this.cacheTtl,
          );

          await this.performanceMetrics.recordMetric({
            endpoint: ANALYTICS_METRICS_CONFIG.ENDPOINTS.LEARNING,
            method: 'predictSuccessRate',
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
        `gRPC predictSuccessRate failed: ${getErrorMessage(error)}`,
      );
      await this.performanceMetrics.recordMetric({
        endpoint: ANALYTICS_METRICS_CONFIG.ENDPOINTS.LEARNING,
        method: 'predictSuccessRate',
        provider: ANALYTICS_METRICS_CONFIG.PROVIDERS.GRPC,
        userId,
        responseTimeMs: Date.now() - startTime,
        cacheHit: false,
        success: false,
        timestamp: new Date(),
      });
      // Return empty prediction on failure
      return {
        userId,
        type: PredictionType.successProbability,
        probability: 0.5,
        confidence: 0.5,
        factors: ['fallback_estimate'],
        predictedSuccessRate: 0.5,
        recommendedStudyTime: 45,
        explanations: ['Insufficient data available for detailed explanation.'],
      };
    }
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
      return Promise.resolve([0, 0, 0, 0, 0]);
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
          const grpcResp: any = await this.callGrpc(
            (this.analyticsServiceGrpc as any).getRecommendations({
              user_id: userId,
              limit,
            }),
          );

          const mapped = (grpcResp.recommendations || [])
            .slice(0, limit)
            .map((rec: any) => ({
              pathId: rec.path_id || rec.id,
              score: rec.score || 0.7,
              reasons: rec.reasons || ['Recommended based on your profile'],
              confidence: rec.confidence || 0.8,
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
      return [];
    }
  }

  /**
   * Get collaborative filtering recommendations (gRPC only)
   * Uses similarity-based filtering to recommend items liked by similar users.
   */
  async getCollaborativeRecommendations(
    userId: string,
    limit: number = 5,
  ): Promise<Array<{ item_id: string; score: number }>> {
    const startTime = Date.now();
    const cacheKey = ANALYTICS_CACHE_CONFIG.RECOMMENDATIONS.COLLABORATIVE(
      userId,
      limit,
    );

    try {
      const cached = await this.redisService.get<string>(cacheKey);
      if (typeof cached === 'string') {
        return JSON.parse(cached);
      }

      const grpcResp: any = await this.callGrpc(
        this.analyticsServiceGrpc.getCollaborativeRecommendations({
          user_id: userId,
          limit,
        }),
      );

      const mapped = (grpcResp.items || []).slice(0, limit).map((rec: any) => ({
        item_id: rec.item_id || rec.id,
        score: rec.score || 0.7,
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
      return [];
    }
  }

  /**
   * Get study material recommendations for knowledge gaps (gRPC only)
   */
  async generateStudyRecommendations(
    userId: string,
    knowledgeGaps: string[],
  ): Promise<
    Array<{ id: string; type: string; title: string; priority: string }>
  > {
    const cacheKey = ANALYTICS_CACHE_CONFIG.RECOMMENDATIONS.STUDY_WITH_GAPS(
      userId,
      knowledgeGaps,
    );

    try {
      const cached = await this.redisService.get<string>(cacheKey);
      if (typeof cached === 'string') {
        return JSON.parse(cached);
      }

      const grpcResp: any = await this.callGrpc(
        this.analyticsServiceGrpc.generateStudyRecommendations({
          user_id: userId,
          knowledge_gaps: knowledgeGaps,
        }),
      );

      const mapped = (grpcResp.recommendations || []).map((rec: any) => ({
        id: rec.material_id || rec.id,
        type: rec.type || 'MATERIAL',
        title: rec.title || 'Study Material',
        priority: rec.priority || 'MEDIUM',
      }));

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
      return [];
    }
  }

  /**
   * Get trending learning paths (gRPC only)
   */
  async getTrendingPaths(
    limit: number = 5,
  ): Promise<Array<{ path_id: string; enrollments: number }>> {
    const cacheKey = 'trending_paths:all';

    try {
      const cached = await this.redisService.get<string>(cacheKey);
      if (typeof cached === 'string') {
        return JSON.parse(cached);
      }

      const grpcResp: any = await this.callGrpc(
        this.analyticsServiceGrpc.getTrendingPaths({ limit }),
      );

      const mapped = (grpcResp.paths || [])
        .slice(0, limit)
        .map((path: any) => ({
          path_id: path.path_id || path.id,
          enrollments: path.popularity || 0,
        }));

      await this.redisService.set(cacheKey, JSON.stringify(mapped), 3600);

      return mapped;
    } catch (error) {
      this.logger.warn(
        `gRPC getTrendingPaths failed: ${getErrorMessage(error)}`,
      );
      return [];
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
        this.redisService.del(ANALYTICS_CACHE_CONFIG.LEARNING.PATTERNS(userId)),
        this.redisService.del(
          ANALYTICS_CACHE_CONFIG.LEARNING.ENGAGEMENT(userId),
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
    const [avgScore, consistency, studyDuration, engagement, recentScore] =
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
   * Get comprehensive learning analytics combining all metrics
   */
  async getLearningAnalytics(userId: string): Promise<LearningAnalyticsDto> {
    const cacheKey = ANALYTICS_CACHE_CONFIG.LEARNING.ANALYTICS(userId);
    const cached = await this.redisService.get(cacheKey);

    if (cached) {
      return JSON.parse(cached as string) as LearningAnalyticsDto;
    }

    try {
      const enrollments = await this.prisma.courseEnrollment.findMany({
        where: { userId },
        include: {
          course: {
            include: {
              category: { select: { name: true } },
              units: { select: { id: true } },
            },
          },
        },
      });

      const totalCoursesEnrolled = enrollments.length;
      const completedEnrollments = enrollments.filter(
        (e) => e.status === 'completed',
      );
      const totalCoursesCompleted = completedEnrollments.length;

      const unitAccesses = await this.prisma.unitAccess.findMany({
        where: { userId },
      });
      const totalTimeSpent = unitAccesses.reduce(
        (sum, access) => sum + (access.timeSpent || 0),
        0,
      );

      const courseProgresses = await Promise.all(
        enrollments.map((e) =>
          this.courseAnalyticsService.calculateCourseProgress(
            userId,
            e.courseId,
          ),
        ),
      );
      const validProgresses = courseProgresses.filter(
        (cp) => cp !== null && cp !== undefined,
      );
      const averageCompletionRate =
        validProgresses.length > 0
          ? validProgresses.reduce(
              (sum, cp) => sum + (cp?.percentage || 0),
              0,
            ) / validProgresses.length
          : 0;

      const subjectPerformance = new Map<
        string,
        { total: number; completed: number }
      >();
      enrollments.forEach((enrollment) => {
        const categoryName =
          enrollment.course.category?.name || 'Uncategorized';
        const current = subjectPerformance.get(categoryName) || {
          total: 0,
          completed: 0,
        };
        current.total++;
        if (enrollment.status === 'completed') {
          current.completed++;
        }
        subjectPerformance.set(categoryName, current);
      });

      const subjectRates = Array.from(subjectPerformance.entries())
        .map(([subject, performance]) => ({
          subject,
          rate:
            performance.total > 0
              ? performance.completed / performance.total
              : 0,
        }))
        .sort((a, b) => b.rate - a.rate);

      const strongestSubjects = subjectRates.slice(0, 3).map((s) => s.subject);
      const weakestSubjects = subjectRates
        .slice(-3)
        .reverse()
        .map((s) => s.subject);

      const learningStreak = await this.calculateLearningStreak(userId);

      const lastActivity = await this.prisma.unitAccess.findFirst({
        where: { userId },
        orderBy: { accessedAt: 'desc' },
      });

      const learningGoals = await this.prisma.learningGoal.findMany({
        where: { userId },
        include: { LearningGoalProgress: true },
      });

      const totalGoals = learningGoals.length;
      const activeGoals = learningGoals.filter(
        (g) => g.status === 'inProgress',
      ).length;
      const completedGoals = learningGoals.filter(
        (g) => g.status === 'completed',
      ).length;
      const overdueGoals = learningGoals.filter(
        (g) =>
          g.targetDate && g.targetDate < new Date() && g.status !== 'completed',
      ).length;
      const completionRate =
        totalGoals > 0 ? (completedGoals / totalGoals) * 100 : 0;

      const goalsByCategory = learningGoals.reduce(
        (acc, goal) => {
          const category = goal.category ?? 'Uncategorized';
          acc[category] = (acc[category] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      );

      const goalsByPriority = learningGoals.reduce(
        (acc, goal) => {
          const priority = String(goal.priority ?? 'normal');
          acc[priority] = (acc[priority] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      );

      const upcomingDeadlines = learningGoals
        .filter(
          (g) =>
            g.targetDate &&
            g.targetDate > new Date() &&
            g.status !== 'completed',
        )
        .map((g) => {
          const td = g.targetDate!;
          return {
            goalId: g.id,
            title: g.title,
            targetDate: td.toISOString(),
            daysRemaining: Math.ceil(
              (td.getTime() - Date.now()) / (1000 * 3600 * 24),
            ),
          };
        });

      const goalAnalytics: GoalAnalytics = {
        userId,
        totalGoals,
        activeGoals,
        completedGoals,
        overdueGoals,
        completionRate,
        averageCompletionTimeDays: 0, // Placeholder
        goalsByCategory,
        goalsByPriority,
        streakData: {
          currentStreak: 0, // Placeholder
          longestStreak: 0, // Placeholder
        },
        streakGoalIds: [], // Placeholder
        upcomingDeadlines,
      };

      const result: LearningAnalyticsDto = {
        userId,
        totalCourses: totalCoursesEnrolled,
        completedCourses: totalCoursesCompleted,
        totalLearningPaths: 0,
        completedLearningPaths: 0,
        totalStudyTimeMinutes: Math.round(totalTimeSpent / 60),
        averageCourseProgress: Math.round(averageCompletionRate * 100) / 100,
        averagePathProgress: 0,
        totalCoursesEnrolled,
        totalCoursesCompleted,
        totalTimeSpent,
        averageCompletionRate: Math.round(averageCompletionRate * 100) / 100,
        strongestSubjects,
        weakestSubjects,
        learningStreak,
        lastActivityDate: lastActivity?.accessedAt || null,
        engagementMetrics: {
          userId,
          assessmentId: '',
          timeSpent: totalTimeSpent,
          interactions: [],
          dailyActiveStreak: learningStreak,
          weeklyActiveStreak: Math.floor(learningStreak / 7),
          lastActivityDate: lastActivity?.accessedAt || null,
          sessionCount: unitAccesses.length,
          averageSessionDuration:
            unitAccesses.length > 0 ? totalTimeSpent / unitAccesses.length : 0,
          mostActiveTimeOfDay: '',
          mostActiveDayOfWeek: '',
        },
        performanceMetrics: {
          averageAssessmentScore: 0,
          passRate: 0,
          skillMasteryProgress: {},
          weaknessAreas: weakestSubjects,
          strengthAreas: strongestSubjects,
          improvementRate: 0,
        },
        progressTrends: [],
        goalAnalytics,
      };

      await this.redisService.set(
        cacheKey,
        JSON.stringify(result),
        this.cacheTtl,
      );
      return result;
    } catch (error) {
      this.logger.error('Error getting learning analytics', {
        userId,
        error: getErrorMessage(error),
      });
      return this.getDefaultLearningAnalytics(userId);
    }
  }

  private getDefaultLearningAnalytics(userId: string): LearningAnalyticsDto {
    return {
      userId,
      totalCourses: 0,
      completedCourses: 0,
      totalLearningPaths: 0,
      completedLearningPaths: 0,
      totalStudyTimeMinutes: 0,
      averageCourseProgress: 0,
      averagePathProgress: 0,
      totalCoursesEnrolled: 0,
      totalCoursesCompleted: 0,
      totalTimeSpent: 0,
      averageCompletionRate: 0,
      strongestSubjects: [],
      weakestSubjects: [],
      learningStreak: 0,
      lastActivityDate: null,
      engagementMetrics: {
        userId,
        assessmentId: '',
        timeSpent: 0,
        interactions: [],
        dailyActiveStreak: 0,
        weeklyActiveStreak: 0,
        lastActivityDate: null,
        sessionCount: 0,
        averageSessionDuration: 0,
        mostActiveTimeOfDay: '',
        mostActiveDayOfWeek: '',
      },
      performanceMetrics: {
        averageAssessmentScore: 0,
        passRate: 0,
        skillMasteryProgress: {},
        weaknessAreas: [],
        strengthAreas: [],
        improvementRate: 0,
      },
      progressTrends: [],
      goalAnalytics: {} as GoalAnalytics,
    };
  }

  private async calculateLearningStreak(userId: string): Promise<number> {
    try {
      const accesses = await this.prisma.unitAccess.findMany({
        where: { userId },
        select: { accessedAt: true },
        orderBy: { accessedAt: 'desc' },
      });

      if (accesses.length === 0) {
        return 0;
      }

      let streak = 1;
      let currentDate = new Date(accesses[0].accessedAt);

      for (let i = 1; i < accesses.length; i++) {
        const accessDate = new Date(accesses[i].accessedAt);
        const daysDifference = Math.floor(
          (currentDate.getTime() - accessDate.getTime()) /
            (1000 * 60 * 60 * 24),
        );

        if (daysDifference === 1) {
          streak++;
          currentDate = accessDate;
        } else if (daysDifference > 1) {
          break;
        }
      }

      return streak;
    } catch (error) {
      this.logger.error('Error calculating learning streak', {
        userId,
        error: getErrorMessage(error),
      });
      return 0;
    }
  }
}
