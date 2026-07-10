import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../../infrastructure/prisma/prisma.module';
import { RedisModule } from '../../../../infrastructure/redis/redis.module';
import { MetricsModule } from '#infrastructure/metrics/metrics.module';
import { LearningModule } from './learning.module';
import { AuthModule } from '../../../auth/auth.module';
import { CoursesService } from '../services/courses.service';
import { CoursesController } from '../controllers/courses.controller';
import { CPDController } from '../controllers/cpd.controller';
import { ProgressController } from '../controllers/progress.controller';
import { StudyController } from '../controllers/study.controller';
import { StudyGroupsController } from '../controllers/study-groups.controller';
import { XapiHealthController } from '../controllers/xapi.health.controller';
import { CPDService } from '../services/cpd.service';
import { MasteryGateService } from '../services/mastery-gate.service';
import { ProgressService } from '../services/progress.service';
import { StudyGroupsService } from '../services/study-groups.service';
import { StudyService } from '../services/study.service';
import { CoursesCacheWarmerService } from '../services/courses-cache-warmer.service';
import { ProgressListeners } from '../listeners/progress.listeners';

import { AutonomyLevelService } from '../services/autonomy-level.service';
import { CoursePredictionHandler } from '../handlers/course-prediction.handler';
import { WorkloadService } from '../services/workload.service';
import { EngagementScorerService } from '../services/engagement-scorer.service';
import { StruggleDetectorService } from '../services/struggle-detector.service';
import { BridgingMaterialService } from '../services/bridging-material.service';
import { EffortEstimatorService } from '../services/effort-estimator.service';
import { GoalEscalationJob } from '../jobs/goal-escalation.job';
// Architecture Batch 2 new services
import { CompetenceCalculatorService } from '../services/competence-calculator.service';
import { QuestionFlagService } from '../services/question-flag.service';
import { InstructorOverrideService } from '../services/instructor-override.service';
import { SyncService } from '../services/sync.service';

@Module({
  imports: [
    PrismaModule,
    RedisModule,
    MetricsModule,
    AuthModule,
    LearningModule,
  ],
  controllers: [
    CoursesController,
    CPDController,
    ProgressController,
    StudyController,
    StudyGroupsController,
    XapiHealthController,
  ],
  providers: [
    CoursesService,
    CPDService,
    MasteryGateService,
    ProgressService,
    StudyGroupsService,
    StudyService,
    ProgressListeners,
    CoursesCacheWarmerService,
    AutonomyLevelService,
    CoursePredictionHandler,
    WorkloadService,
    EngagementScorerService,
    StruggleDetectorService,
    BridgingMaterialService,
    EffortEstimatorService,
    // Architecture Batch 2
    CompetenceCalculatorService,
    QuestionFlagService,
    InstructorOverrideService,
    SyncService,
  ],
  exports: [
    CoursesService,
    CPDService,
    MasteryGateService,
    ProgressService,
    StudyGroupsService,
    StudyService,
    AutonomyLevelService,
    WorkloadService,
    EngagementScorerService,
    StruggleDetectorService,
    BridgingMaterialService,
    EffortEstimatorService,
    CompetenceCalculatorService,
    QuestionFlagService,
    InstructorOverrideService,
    SyncService,
  ],
})
export class CoursesModule {}
