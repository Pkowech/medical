import { Injectable, Logger, Inject, OnModuleInit } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { PrismaService } from '#infrastructure/prisma/prisma.service';
import { RedisService } from '#infrastructure/redis/redis.service';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom, timeout, Observable } from 'rxjs';
import { retry } from 'rxjs/operators';
import { AxiosRequestConfig, AxiosResponse } from 'axios';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { getErrorMessage, getErrorStack } from '#common/utils/error.utils';
import { SystemAnalyticsResponseDto } from '#common/dto';
import { LearningPath } from '@prisma/client';
import { LearningAnalyticsService } from '#modules/ai-analytics/services/learning-analytics.service';
import { AiAnalyticsService } from '#modules/ai-analytics/services/ai-analytics.service';
import { RequestDeduplicationService } from '#modules/ai-analytics/services/request-deduplication.service';
import { ANALYTICS_METRICS_CONFIG } from '#modules/ai-analytics/services/analytics-cache.constants';


type JsonObject = { [key: string]: unknown };

@Injectable()
export class AdminAnalyticsService implements OnModuleInit {
  private readonly logger = new Logger(AdminAnalyticsService.name);
  private readonly cacheTtl = 3600; // 1 hour
  private analyticsServiceGrpc!: any;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    @Inject('ANALYTICS_PACKAGE') private readonly client: any,
  ) {}

  onModuleInit() {
    try {
      this.analyticsServiceGrpc = this.client.getService('AnalyticsService');
    } catch (err) {
      this.logger.error(`Failed to get gRPC service from client: ${getErrorMessage(err)}`);
    }
  }

  private async callGrpc<T>(observable: Observable<T>): Promise<T> {
    return firstValueFrom(observable.pipe(timeout(1000), retry(0)));
  }

  /**
   * Main system analytics aggregator.
   * Prefers gRPC/Rust but falls back to local Prisma queries if gRPC is disabled or method is missing.
   */
  async getSystemAnalytics(): Promise<SystemAnalyticsResponseDto> {
    this.logger.log('getSystemAnalytics: Fetching system analytics');
    const cacheKey = 'admin:system-analytics';
    const startTime = Date.now();

    try {
      // 1. Try cache first
      const cached = await this.redisService.get<string>(cacheKey);
      if (typeof cached === 'string') {
        this.logger.log('getSystemAnalytics: Returning cached data');
        return JSON.parse(cached);
      }

      let result: SystemAnalyticsResponseDto | null = null;

      // 2. Try gRPC if enabled
      if (process.env.ENABLE_GRPC === 'true' && this.analyticsServiceGrpc) {
        this.logger.log('getSystemAnalytics: Attempting gRPC call');
        try {
          if (typeof this.analyticsServiceGrpc.getSystemAnalytics === 'function') {
            const grpcResp: any = await this.callGrpc(
              this.analyticsServiceGrpc.getSystemAnalytics({}),
            );
            
            if (grpcResp && Object.keys(grpcResp).length > 0 && (grpcResp.total_users || grpcResp.totalUsers)) {
              result = {
                totalUsers: grpcResp.total_users ?? grpcResp.totalUsers ?? 0,
                activeLearners: grpcResp.active_learners ?? grpcResp.activeLearners ?? 0,
                totalCourses: grpcResp.total_courses ?? grpcResp.totalCourses ?? 0,
                completedCourses: grpcResp.completed_courses ?? grpcResp.completedCourses ?? 0,
                averageCompletionRate: grpcResp.average_completion_rate ?? grpcResp.averageCompletionRate ?? 0,
                totalPaths: grpcResp.total_paths ?? grpcResp.totalPaths ?? 0,
                totalEnrollments: grpcResp.total_enrollments ?? grpcResp.totalEnrollments ?? 0,
                overallCompletionRate: grpcResp.overall_completion_rate ?? grpcResp.overallCompletionRate ?? 0,
              };
            } else {
              this.logger.warn('gRPC getSystemAnalytics returned empty or zero data. Falling back to Prisma.');
            }
          }
        } catch (grpcErr) {
          this.logger.warn(`gRPC getSystemAnalytics failed: ${getErrorMessage(grpcErr)}. Falling back to Prisma.`);
        }
      }

      // 3. Local Fallback (Prisma)
      if (!result) {
        this.logger.log('getSystemAnalytics: Using local Prisma fallback');
        const [activeLearners, totalUsers, totalCourses, completedCourses, totalPaths, totalEnrollments] = await Promise.all([
          this.prisma.user.count({
            where: {
              lastLogin: {
                gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
              },
            },
          }),
          this.prisma.user.count(),
          this.prisma.course.count(),
          this.prisma.courseProgress.count({
            where: { status: 'completed' as any },
          }),
          this.prisma.learningPath.count(),
          this.prisma.courseEnrollment.count(),
        ]);

        const avgRate = totalEnrollments > 0 ? (completedCourses / totalEnrollments) * 100 : 0;

        result = {
          totalUsers,
          activeLearners,
          totalCourses,
          completedCourses,
          averageCompletionRate: avgRate,
          totalPaths,
          totalEnrollments,
          overallCompletionRate: avgRate,
        };
      }

      // 4. Cache results
      await this.redisService.set(cacheKey, JSON.stringify(result), this.cacheTtl);
      
      return result;
    } catch (err) {
      this.logger.error(`getSystemAnalytics failed: ${getErrorMessage(err)}`, getErrorStack(err));
      // Ultimate fallback
      return {
        totalUsers: 0,
        activeLearners: 0,
        totalCourses: 0,
        completedCourses: 0,
        averageCompletionRate: 0,
        totalPaths: 0,
        totalEnrollments: 0,
        overallCompletionRate: 0,
      };
    }
  }

  async getProgressRecordsForPeriod(start: string, end: string) {
    this.logger.log(`getProgressRecordsForPeriod: ${start} to ${end}`);
    return [];
  }

  async processAnalyticsForUsers(userIds: string[]) {
    this.logger.log(`processAnalyticsForUsers: ${userIds.length} users`);
    return { success: true, processed: 0 };
  }

  async getTrendingPaths(limit: number) {
    this.logger.log(`getTrendingPaths: limit ${limit}`);
    return [];
  }

  // Placeholder methods for other analytics functionality
  async getSystemAnalyticsFromAI() {
    return { message: 'AI Analytics not yet fully integrated' };
  }
}
