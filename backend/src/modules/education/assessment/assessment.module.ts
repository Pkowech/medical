import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '#infrastructure/prisma/prisma.module';
import { RedisModule } from '#infrastructure/redis/redis.module';
import { CoursesModule } from '../courses/modules/courses.module'; // Changed from LearningManagementModule
import { ConfigModule } from '@nestjs/config';
import { AssessmentConfigService } from '../../../config/assessment.config';
import { AuthModule } from '../../auth/auth.module'; // Added AuthModule import
import { GrpcModule } from '#infrastructure/grpc/grpc.module';
import { AiAnalyticsModule } from '../../ai-analytics/ai-analytics.module';
import { AnalyticsServicesModule } from '../../ai-analytics/analytics-services.module';
import { EngagementCommunicationModule } from '../../engagement-communication/engagement-communication.module';

import { QuizController } from './controllers/quiz.controller';
import { FlashcardsController } from './controllers/flashcards.controller';
import { FeedbackController } from './controllers/feedback.controller';
import { BlueprintController } from './controllers/blueprint.controller';

import { AssessmentProgressController } from './controllers/assessment-progress.controller';

import { AssessmentsService } from './services/assessments.service';
import { QuizService } from './services/quiz.service';
import { FlashcardsService } from './services/flashcards.service';
import { AdaptiveQuizService } from './services/adaptive-quiz.service';
import { FeedbackService } from './services/feedback.service';
import { QuestionBankService } from './services/question-bank.service';
import { AssessmentProgressService } from './services/assessment-progress.service';
import { BlueprintService } from './services/blueprint.service';
import { QuizGenerationService } from './services/quiz-generation.service';
import { WeaknessOrchestrationService } from './services/weakness-orchestration.service';

import { SM2AlgorithmService } from './services/sm2-algorithm.service';

@Module({
  imports: [
    PrismaModule,
    RedisModule,
    forwardRef(() => CoursesModule),
    ConfigModule,
    AuthModule,
    GrpcModule,
    AiAnalyticsModule,
    AnalyticsServicesModule,
    EngagementCommunicationModule,
  ],
  controllers: [
    QuizController,
    FlashcardsController,
    FeedbackController,
    BlueprintController,
    AssessmentProgressController,
  ],
  providers: [
    AssessmentsService,
    QuizService,
    FlashcardsService,
    AdaptiveQuizService,
    FeedbackService,
    QuestionBankService,
    AssessmentConfigService,
    AssessmentProgressService,
    BlueprintService,
    SM2AlgorithmService,
    QuizGenerationService,
    WeaknessOrchestrationService,
  ],
  exports: [
    AssessmentsService,
    QuizService,
    FlashcardsService,
    AdaptiveQuizService,
    FeedbackService,
    QuestionBankService,
    FeedbackService,
    BlueprintService,
    // Note: AssessmentAnalyticsService is provided/exported by AiAnalyticsModule
  ],
})
export class AssessmentModule {}
