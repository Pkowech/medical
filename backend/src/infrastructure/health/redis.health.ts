import { Injectable } from '@nestjs/common';
import {
  HealthIndicator,
  HealthIndicatorResult,
  HealthCheckError,
} from '@nestjs/terminus';

import { getErrorMessage } from '#common/utils/error.utils';

@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
  constructor() {
    super();
  }

  isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      // Temporarily disable Redis health check
      // await this.redis.ping();
      return Promise.resolve(
        this.getStatus(key, true, {
          message: 'Redis check temporarily disabled',
        }),
      );
    } catch (error) {
      throw new HealthCheckError(
        'Redis check failed',
        this.getStatus(key, false, { message: getErrorMessage(error) }),
      );
    }
  }
}
