import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { PrismaModule } from '#infrastructure/prisma/prisma.module';
import { RedisModule } from '#infrastructure/redis/redis.module';
import { GrpcModule } from '#infrastructure/grpc/grpc.module';
import { MonitoringModule } from '#infrastructure/monitoring/monitoring.module';

// Import only the consolidated ML/AI Services without any education module dependencies
import { LearningAnalyticsService } from './services/learning-analytics.service';
import { LearningPathRecommendationsService } from './services/learning-path-recommendations.service';
import { RequestDeduplicationService } from './services/request-deduplication.service';

/**
 * AnalyticsServicesModule provides analytics services to education modules
 * without creating circular dependencies with AiAnalyticsModule.
 *
 * This module can be safely imported by LearningModule and other education
 * modules since it doesn't import any education-related modules back.
 */
@Module({
  imports: [
    HttpModule,
    PrismaModule,
    RedisModule,
    GrpcModule,
    MonitoringModule,
  ],
  providers: [
    RequestDeduplicationService,
    LearningAnalyticsService,
    LearningPathRecommendationsService,
  ],
  exports: [LearningAnalyticsService, LearningPathRecommendationsService],
})
export class AnalyticsServicesModule {}
