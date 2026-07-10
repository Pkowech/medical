import { Module, forwardRef } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { AnalyticsQueueModule } from '#modules/queue/analytics-queue.module';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '#infrastructure/prisma/prisma.module';
import { RedisModule } from '#infrastructure/redis/redis.module';
import { GrpcModule } from '#infrastructure/grpc/grpc.module';
import { AuthModule } from '#modules/auth/auth.module';

// Communication Controllers
import { ChatController } from './controllers/chat.controller';
import { NotificationsController } from './controllers/notifications.controller';
import { WeeklyDigestController } from './controllers/weekly-digest.controller';
import { ForumController } from './controllers/forum.controller';

// Communication Services
import { ChatService } from './services/chat.service';
import { NotificationsService } from './services/notifications.service';
import { WeeklyDigestService } from './services/weekly-digest.service';
import { ForumService } from './services/forum.service';

// Engagement Controllers
import { EngagementController } from './controllers/engagement.controller';
import { GamificationController } from './controllers/gamification.controller';
import { RewardsController } from './controllers/rewards.controller';

// Engagement Services
import { GamificationService } from './services/gamification.service';
import { RewardsService } from './services/rewards.service';
import { PeerBenchmarkingService } from './services/peer-benchmarking.service';

// Onboarding Controllers
import { OnboardingController } from './controllers/onboarding.controller';

// Onboarding Services
import { OnboardingService } from './services/onboarding.service';

@Module({
  imports: [
    PrismaModule,
    RedisModule,
    forwardRef(() => AuthModule),
    GrpcModule,
    HttpModule,
    ...(process.env.ENABLE_REDIS === 'true' ? [AnalyticsQueueModule] : []),
    ConfigModule,
  ],
  controllers: [
    ChatController,
    NotificationsController,
    WeeklyDigestController,
    ForumController,
    EngagementController,
    GamificationController,
    RewardsController,
    OnboardingController,
  ],
  providers: [
    ChatService,
    NotificationsService,
    WeeklyDigestService,
    ForumService,
    GamificationService,
    RewardsService,
    PeerBenchmarkingService,
    OnboardingService,
  ],
  exports: [
    ChatService,
    NotificationsService,
    WeeklyDigestService,
    ForumService,
    GamificationService,
    RewardsService,
    PeerBenchmarkingService,
    OnboardingService,
  ],
})
export class EngagementCommunicationModule {}
