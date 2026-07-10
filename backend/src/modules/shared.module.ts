import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { RedisModule } from '#infrastructure/redis/redis.module';
import { PrismaModule } from '#infrastructure/prisma/prisma.module';
import { MonitoringModule } from '#infrastructure/monitoring/monitoring.module';
import { GrpcModule } from '#infrastructure/grpc/grpc.module';
import { UserAnalyticsService } from './ai-analytics/services/user-analytics.service';
import { LearningModule } from './education/courses/modules/learning.module';
import { CacheModule } from '@nestjs/cache-manager';

@Module({
  imports: [
    RedisModule,
    HttpModule,
    PrismaModule,
    GrpcModule,
    MonitoringModule,
    LearningModule,
    CacheModule.register(),
  ],
  providers: [UserAnalyticsService],
  exports: [UserAnalyticsService],
})
export class SharedModule {}
