import { Injectable } from '@nestjs/common';
import {
  HealthIndicator,
  HealthIndicatorResult,
  HealthCheckError,
} from '@nestjs/terminus';
import { RedisService } from '#infrastructure/redis/redis.service';
import { getErrorMessage } from '#common/utils/error.utils';

@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
  constructor(private readonly redisService: RedisService) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    if (!this.redisService.isEnabled) {
      return this.getStatus(key, true, { message: 'Redis is disabled' });
    }

    try {
      await this.redisService.ping();
      return this.getStatus(key, true);
    } catch (error) {
      throw new HealthCheckError(
        'Redis check failed',
        this.getStatus(key, false, { message: getErrorMessage(error) }),
      );
    }
  }
}
