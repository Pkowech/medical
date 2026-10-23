import { Injectable, Logger, Inject, OnModuleInit } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { AnalyticsService } from '#infrastructure/grpc/analytics.client';
import { RedisService } from '#infrastructure/redis/redis.service';
import { firstValueFrom, timeout, Observable } from 'rxjs';
import { retry } from 'rxjs/operators';
import { getErrorMessage, getErrorStack } from '#common/utils/error.utils';
import { SystemAnalyticsResponseDto } from '#common/dto';

@Injectable()
export class AdminAnalyticsService implements OnModuleInit {
  private readonly logger = new Logger(AdminAnalyticsService.name);
  private readonly cacheTtl = 3600; // 1 hour
  private analyticsServiceGrpc!: AnalyticsService;

  constructor(
    private readonly redisService: RedisService,
    @Inject('ANALYTICS_PACKAGE') private readonly client: ClientGrpc,
  ) {}

  onModuleInit() {
    this.analyticsServiceGrpc =
      this.client.getService<AnalyticsService>('AnalyticsService');
  }

  private async callGrpc<T>(observable: Observable<T>): Promise<T> {
    return firstValueFrom(observable.pipe(timeout(1000), retry(0)));
  }

  /** Fetch system-wide analytics from the Rust analytics service. */
  async getSystemAnalytics(): Promise<SystemAnalyticsResponseDto> {
    this.logger.log('getSystemAnalytics: Fetching system analytics');
    const cacheKey = 'admin:system-analytics';

    try {
      // 1. Try cache first
      const cached = await this.redisService.get<SystemAnalyticsResponseDto | string>(cacheKey);
      if (cached) {
        this.logger.log('getSystemAnalytics: Returning cached data');
        if (typeof cached === 'string') {
          try {
            return JSON.parse(cached) as SystemAnalyticsResponseDto;
          } catch {
            // ignore JSON error and refetch
          }
        } else {
          return cached;
        }
      }

      const grpcResp = await this.callGrpc(
        this.analyticsServiceGrpc.getSystemAnalytics({}),
      );
      const result: SystemAnalyticsResponseDto = {
        totalUsers: grpcResp.totalUsers,
        activeLearners: grpcResp.activeLearners,
        totalCourses: grpcResp.totalCourses,
        completedCourses: grpcResp.completedCourses,
        averageCompletionRate: grpcResp.averageCompletionRate,
        totalPaths: grpcResp.totalPaths,
        totalEnrollments: grpcResp.totalEnrollments,
        overallCompletionRate: grpcResp.overallCompletionRate,
      };

      await this.redisService.set(cacheKey, JSON.stringify(result), this.cacheTtl);
      return result;
    } catch (err) {
      this.logger.error(`getSystemAnalytics failed: ${getErrorMessage(err)}`, getErrorStack(err));
      throw err;
    }
  }

  getProgressRecordsForPeriod(start: string, end: string) {
    this.logger.log(`getProgressRecordsForPeriod: ${start} to ${end}`);
    return this.callGrpc(
      this.analyticsServiceGrpc.getProgressRecordsForPeriod({ start, end }),
    );
  }

  processAnalyticsForUsers(userIds: string[]) {
    this.logger.log(`processAnalyticsForUsers: ${userIds.length} users`);
    return this.callGrpc(
      this.analyticsServiceGrpc.processAnalyticsForUsers({ userIds }),
    );
  }

  getTrendingPaths(limit: number) {
    this.logger.log(`getTrendingPaths: limit ${limit}`);
    return this.callGrpc(
      this.analyticsServiceGrpc.getTrendingPaths({ limit }),
    );
  }

  getSystemAnalyticsFromAI() {
    return this.getSystemAnalytics();
  }
}
