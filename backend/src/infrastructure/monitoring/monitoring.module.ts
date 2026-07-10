import { Module } from '@nestjs/common';
import { RedisModule } from '../redis/redis.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PerformanceMetricsService } from './performance-metrics.service';
import { DistributedTracingService } from './distributed-tracing.service';
import { ProgressiveRolloutService } from './progressive-rollout.service';

@Module({
  imports: [RedisModule, PrismaModule],
  providers: [
    PerformanceMetricsService,
    DistributedTracingService,
    ProgressiveRolloutService,
  ],
  exports: [
    PerformanceMetricsService,
    DistributedTracingService,
    ProgressiveRolloutService,
  ],
})
export class MonitoringModule {}
