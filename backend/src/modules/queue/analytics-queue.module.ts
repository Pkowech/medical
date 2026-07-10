import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { buildRedisOptions } from '#infrastructure/redis/redis.helper';
import { Queue } from 'bullmq';
import { RedisOptions } from 'ioredis';

// Provide a single, explicit provider token for the analytics queue.
// This ensures `BullQueue_analytics` is always present in DI (real queue
// when Redis enabled, noop mock when disabled).
const analyticsQueueProvider = {
  provide: 'BullQueue_analytics',
  useFactory: (configService: ConfigService) => {
    if (process.env.ENABLE_REDIS === 'true') {
      const connection = buildRedisOptions(configService) as RedisOptions;
      return new Queue('analytics', { connection });
    }

    // noop mock so other services can inject the queue safely when Redis is off
    return {
      name: 'analytics',
      add: (..._args: any[]): Promise<any> => Promise.resolve(null),
      addBulk: (..._args: any[]): Promise<any> => Promise.resolve(null),
      process: (): void => undefined,
      on: (..._args: any[]): void => undefined,
      close: (): Promise<void> => Promise.resolve(),
      pause: (): Promise<void> => Promise.resolve(),
      resume: (): Promise<void> => Promise.resolve(),
    } as unknown as Queue;
  },
  inject: [ConfigService],
};

@Global()
@Module({
  imports: [ConfigModule],
  providers: [analyticsQueueProvider],
  exports: [analyticsQueueProvider],
})
export class AnalyticsQueueModule {}
