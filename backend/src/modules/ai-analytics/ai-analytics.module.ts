import { Global, Module, forwardRef } from '@nestjs/common';
import { CoursesModule } from '../education/courses/modules/courses.module';
import { HttpModule } from '@nestjs/axios';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from '#infrastructure/prisma/prisma.module';
import { RedisModule } from '#infrastructure/redis/redis.module';
import { GrpcModule } from '#infrastructure/grpc/grpc.module';
import { MonitoringModule } from '#infrastructure/monitoring/monitoring.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { buildRedisOptions } from '../../infrastructure/redis/redis.helper';
import { RedisOptions } from 'ioredis';
import { MetricsModule } from '#infrastructure/metrics/metrics.module';
import { AnalyticsAlertService } from './services/analytics-alert.service';
// AI Controllers

// AI Services
import { AiAnalyticsService } from './services/ai-analytics.service';
import { RequestDeduplicationService } from './services/request-deduplication.service';
import { AIFeaturesService } from './services/ai-features.service';
// Domain-Specific gRPC Analytics Services
import { CourseAnalyticsService } from './services/course-analytics.service';
import { AssessmentAnalyticsService } from './services/assessment-analytics.service';
// NOTE: the gRPC shim `user-analytics-grpc.service` was removed/replaced;
// use the canonical `UserAnalyticsService` provider instead for DI.
// Consolidated ML/AI Services (moved from education modules)
import { AdaptiveQuizAnalyticsService } from './services/adaptive-quiz-analytics.service';
import { LearningPathRecommendationsService } from './services/learning-path-recommendations.service';
// Analytics Services (Legacy - being phased out)
import { LearningAnalyticsService } from './services/learning-analytics.service';
import { UserAnalyticsService } from './services/user-analytics.service';
import { StudyAnalyticsService } from './services/study-analytics.service';
import { PrescriptiveAnalyticsService } from './services/prescriptive-analytics.service';

// Architecture Batch 2 new services
import { PredictionValidatorService } from './services/prediction-validator.service';
import { AbTestingService } from './services/ab-testing.service';
import { SkillTrajectoryService } from './services/skill-trajectory.service';
import { WeaknessChainService } from './services/weakness-chain.service';

// Define the BullMQ module registration in a constant.
// Export it so other modules (that need the raw queue provider) can import
// the same dynamic module and get access to the queue provider token.
// This allows us to reuse the dynamic module in both imports and exports.
export const bullModuleForAnalytics = BullModule.registerQueueAsync({
  name: 'analytics',
  imports: [ConfigModule],
  useFactory: (configService: ConfigService) => ({
    connection: buildRedisOptions(configService) as RedisOptions,
  }),
  inject: [ConfigService],
});

@Global()
@Module({
  imports: [
    HttpModule,
    GrpcModule,
    MonitoringModule,
    ...(process.env.ENABLE_REDIS === 'true' ? [bullModuleForAnalytics] : []),
    RedisModule,
    ConfigModule,
    MetricsModule,
    forwardRef(() => CoursesModule),
  ],
  controllers: [],

  providers: [
    // AI Services
    AiAnalyticsService,
    {
      provide: 'AI_ANALYTICS_SERVICE',
      useExisting: AiAnalyticsService,
    },
    RequestDeduplicationService,
    AIFeaturesService,
    // Domain-Specific gRPC Analytics Services
    CourseAnalyticsService,
    AssessmentAnalyticsService,
    // Consolidated ML/AI Services (moved from education modules)
    AdaptiveQuizAnalyticsService,
    LearningPathRecommendationsService,
    // Analytics Services (Legacy - being phased out)
    LearningAnalyticsService,
    // Study Analytics Consolidation
    StudyAnalyticsService,
    UserAnalyticsService,
    PrescriptiveAnalyticsService,
    AnalyticsAlertService,
    // Architecture Batch 2
    PredictionValidatorService,
    AbTestingService,
    SkillTrajectoryService,
    WeaknessChainService,
    // Provide a noop/mock queue when Redis is disabled so DI still resolves
    ...(process.env.ENABLE_REDIS === 'true'
      ? []
      : [
          {
            provide: 'BullQueue_analytics',
            useValue: {
              name: 'analytics',
              add: (_: any): Promise<any> => Promise.resolve(null),
              addBulk: (_: any): Promise<any> => Promise.resolve(null),
              process: (): any => undefined,
              on: (_: any): any => undefined,
              close: (): Promise<void> => Promise.resolve(),
              pause: (): Promise<void> => Promise.resolve(),
              resume: (): Promise<void> => Promise.resolve(),
            },
          },
        ]),
  ],
  exports: [
    // AI Services
    AiAnalyticsService,
    RequestDeduplicationService,
    AIFeaturesService,
    // Domain-Specific gRPC Analytics Services
    CourseAnalyticsService,
    AssessmentAnalyticsService,
    // Consolidated ML/AI Services (moved from education modules)
    AdaptiveQuizAnalyticsService,
    LearningPathRecommendationsService,
    // Analytics Services (Legacy)
    LearningAnalyticsService,
    UserAnalyticsService,
    // Study Analytics Consolidation
    StudyAnalyticsService,
    PrescriptiveAnalyticsService,
    PredictionValidatorService,
    AbTestingService,
    SkillTrajectoryService,
    WeaknessChainService,
    // Re-export the BullMQ module so the queue provider token
    // (BullQueue_analytics) is available to other modules that don't
    // explicitly register the queue themselves (like AdminModule).
    ...(process.env.ENABLE_REDIS === 'true' ? [bullModuleForAnalytics] : []),
  ],
})
export class AiAnalyticsModule {}
