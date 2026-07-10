import { Module, forwardRef } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { AnalyticsQueueModule } from '#modules/queue/analytics-queue.module';
import { RedisModule } from '#infrastructure/redis/redis.module';
import { GrpcModule } from '#infrastructure/grpc/grpc.module';
import { MonitoringModule } from '#infrastructure/monitoring/monitoring.module';
import { AdminAnalyticsService } from './services/admin-analytics.service';
import { AiAnalyticsModule } from '#modules/ai-analytics/ai-analytics.module';
import { AdminAnalyticsController } from './controllers/admin-analytics.controller';
import { AdminService } from './services/admin.service';
import { AdminController } from './controllers/admin.controller';

@Module({
  imports: [
    HttpModule,
    RedisModule,
    forwardRef(() => AiAnalyticsModule),
    GrpcModule,
    MonitoringModule,
    ...(process.env.ENABLE_REDIS === 'true' ? [AnalyticsQueueModule] : []),
  ],
  providers: [AdminAnalyticsService, AdminService],
  controllers: [AdminAnalyticsController, AdminController],
})
export class AdminModule {}
