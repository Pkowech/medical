import { Injectable } from '@nestjs/common';
import { PrismaService } from '#infrastructure/prisma/prisma.service';
import { RedisService } from '#infrastructure/redis/redis.service';

@Injectable()
export abstract class BaseAnalyticsService {
  constructor(
    protected readonly prisma: PrismaService,
    protected readonly redis: RedisService,
  ) {}

  protected async cacheAnalytics<T>(
    key: string,
    data: T,
    ttl: number = 3600,
  ): Promise<T> {
    await this.redis.set(key, data, ttl);
    return data;
  }

  protected async getCachedAnalytics<T>(key: string): Promise<T | null> {
    const cached = await this.redis.get(key);
    return cached ? JSON.parse(cached) : null;
  }

  protected generateCacheKey(
    prefix: string,
    userId?: string,
    entityId?: string,
  ): string {
    return `analytics:${prefix}:${userId || '*'}:${entityId || '*'}`;
  }
}
