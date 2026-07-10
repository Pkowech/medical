import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../../infrastructure/prisma/prisma.module';
import { RedisModule } from '../../../../infrastructure/redis/redis.module';
import { MetricsModule } from '#infrastructure/metrics/metrics.module';
import { HttpModule } from '@nestjs/axios';
import { AnalyticsServicesModule } from '../../../ai-analytics/analytics-services.module';
import { EngagementCommunicationModule } from '#modules/engagement-communication/engagement-communication.module';
import { LearningController } from '../controllers/learning.controller';
import { LearningPathsController } from '../controllers/learning-paths.controller';
import { LearningGoalsController } from '../controllers/learning-goals.controller';
import { LearningGoalsService } from '../services/learning-goals.service';
import { XapiService } from '../services/xapi.service';
import { XapiController } from '../controllers/xapi.controller';
import { LearningPathEventsService } from '../services/learning-path-events.service';
import { LearningPathIntegrationService } from '../services/learning-path-integration.service';
import { ProgressService } from '../services/progress.service';
import { LearningPathProgressService } from '../services/learning-path-progress.service';
import { LearningPathsService } from '../services/learning-paths.service';
import { LearningService } from '../services/learning.service';

import { XapiListeners } from '../listeners/xapi.listeners';

@Module({
  imports: [
    PrismaModule,
    RedisModule,
    MetricsModule,
    HttpModule,
    AnalyticsServicesModule,
    EngagementCommunicationModule,
  ],
  controllers: [
    LearningController,
    LearningPathsController,
    LearningGoalsController,
    XapiController,
  ],
  providers: [
    LearningGoalsService,
    LearningPathEventsService,
    LearningPathIntegrationService,
    ProgressService,
    LearningPathProgressService,
    XapiService,
    XapiListeners,
    // ensure Prisma and other providers available via module imports
    LearningPathsService,
    LearningService,
  ],
  exports: [
    LearningGoalsService,
    LearningPathEventsService,
    LearningPathIntegrationService,
    ProgressService,
    LearningPathProgressService,
    LearningPathsService,
    LearningService,
    XapiService,
  ],
})
export class LearningModule {}
