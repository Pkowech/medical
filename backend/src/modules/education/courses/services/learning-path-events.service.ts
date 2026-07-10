// src/modules/learning/services/learning-path-events.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { getErrorMessage, getErrorStack } from '#common/utils/error.utils';
import { LearningPathIntegrationService } from './learning-path-integration.service';
import { ProgressData } from '#common/dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class LearningPathEventsService {
  private readonly logger = new Logger(LearningPathEventsService.name);

  constructor(private integrationService: LearningPathIntegrationService) {}

  @OnEvent('course.progress.updated')
  async handleCourseProgressUpdated(payload: {
    userId: string;
    courseId: string;
    progressData: ProgressData;
  }) {
    this.logger.log(
      `Handling course progress update for user ${payload.userId}, course ${payload.courseId}`,
    );

    try {
      await this.integrationService.syncCourseProgress(
        payload.userId,
        payload.courseId,
        payload.progressData,
      );
    } catch (error) {
      this.logger.error(
        `Error handling course progress update: ${getErrorMessage(error)}`,
        getErrorStack(error),
      );
    }
  }

  @OnEvent('course.completed')
  async handleCourseCompleted(payload: {
    userId: string;
    courseId: string;
    completionData: Partial<ProgressData>;
  }) {
    this.logger.log(
      `Handling course completion for user ${payload.userId}, course ${payload.courseId}`,
    );

    try {
      await this.integrationService.syncCourseProgress(
        payload.userId,
        payload.courseId,
        {
          ...payload.completionData,
          status: 'completed',
          completedItems: 1,
          totalItems: 1,
          percentage: 100,
        },
      );
    } catch (error) {
      this.logger.error(
        `Error handling course completion: ${getErrorMessage(error)}`,
        getErrorStack(error),
      );
    }
  }

  @OnEvent('course.enrolled')
  async handleCourseEnrolled(payload: {
    userId: string;
    courseId: string;
    enrollmentData: Prisma.JsonObject;
  }) {
    this.logger.log(
      `Handling course enrollment for user ${payload.userId}, course ${payload.courseId}`,
    );

    try {
      await this.integrationService.autoEnrollInRecommendedPaths(
        payload.userId,
        payload.courseId,
      );
    } catch (error) {
      this.logger.error(
        `Error handling course enrollment: ${getErrorMessage(error)}`,
        getErrorStack(error),
      );
    }
  }

  @OnEvent('assessment.completed')
  async handleAssessmentCompleted(payload: {
    userId: string;
    assessmentId: string;
    attemptData: Prisma.JsonObject;
  }) {
    this.logger.log(
      `Handling assessment completion for user ${payload.userId}, assessment ${payload.assessmentId}`,
    );

    try {
      await this.integrationService.syncAssessmentResults(
        payload.userId,
        payload.assessmentId,
        payload.attemptData as ProgressData,
      );
    } catch (error) {
      this.logger.error(
        `Error handling assessment completion: ${getErrorMessage(error)}`,
        getErrorStack(error),
      );
    }
  }

  @OnEvent('clinical-case.completed')
  async handleClinicalCaseCompleted(payload: {
    userId: string;
    caseId: string;
    attemptData: Prisma.JsonObject;
  }) {
    this.logger.log(
      `Handling clinical case completion for user ${payload.userId}, case ${payload.caseId}`,
    );

    try {
      await this.integrationService.syncClinicalCaseCompletion(
        payload.userId,
        payload.caseId,
        payload.attemptData as ProgressData,
      );
    } catch (error) {
      this.logger.error(
        `Error handling clinical case completion: ${getErrorMessage(error)}`,
        getErrorStack(error),
      );
    }
  }

  @OnEvent('learning-path.enrolled')
  async handleLearningPathEnrolled(payload: {
    userId: string;
    pathId: string;
    enrollmentData: Prisma.JsonObject;
  }) {
    this.logger.log(
      `Handling learning path enrollment for user ${payload.userId}, path ${payload.pathId}`,
    );

    try {
      await this.integrationService.createGoalsFromPathMilestones(
        payload.userId,
        payload.pathId,
      );
    } catch (error) {
      this.logger.error(
        `Error handling learning path enrollment: ${getErrorMessage(error)}`,
        getErrorStack(error),
      );
    }
  }

  @OnEvent('learning-path.milestone.achieved')
  handleMilestoneAchieved(payload: {
    userId: string;
    pathId: string;
    milestoneId: string;
    achievementData: Prisma.JsonObject;
  }) {
    this.logger.log(
      `Handling milestone achievement for user ${payload.userId}, milestone ${payload.milestoneId}`,
    );

    try {
      // Implementation depends on specific business logic
    } catch (error) {
      this.logger.error(
        `Error handling milestone achievement: ${getErrorMessage(error)}`,
        getErrorStack(error),
      );
    }
  }

  @OnEvent('learning-goal.completed')
  handleGoalCompleted(payload: {
    userId: string;
    goalId: string;
    completionData: Prisma.JsonObject;
  }) {
    this.logger.log(
      `Handling goal completion for user ${payload.userId}, goal ${payload.goalId}`,
    );

    try {
      // Implementation depends on specific business logic
    } catch (error) {
      this.logger.error(
        `Error handling goal completion: ${getErrorMessage(error)}`,
        getErrorStack(error),
      );
    }
  }

  @OnEvent('user.study.session')
  async handleStudySession(payload: {
    userId: string;
    sessionData: {
      durationMinutes: number;
      materialsCovered: string[];
      coursesCovered: string[];
      assessmentsCompleted: string[];
      clinicalCasesCompleted: string[];
    };
  }) {
    this.logger.log(`Handling study session for user ${payload.userId}`);

    try {
      const { sessionData } = payload;

      for (const courseId of sessionData.coursesCovered || []) {
        await this.integrationService.syncCourseProgress(
          payload.userId,
          courseId,
          {
            timeSpentMinutes: sessionData.durationMinutes,
            completedItems: 0,
            totalItems: 0,
            percentage: 0,
          },
        );
      }

      for (const assessmentId of sessionData.assessmentsCompleted || []) {
        await this.integrationService.syncAssessmentResults(
          payload.userId,
          assessmentId,
          {
            completed: true,
            timeSpentMinutes: sessionData.durationMinutes,
            completedItems: 1,
            totalItems: 1,
            percentage: 100,
          },
        );
      }

      for (const caseId of sessionData.clinicalCasesCompleted || []) {
        await this.integrationService.syncClinicalCaseCompletion(
          payload.userId,
          caseId,
          {
            completed: true,
            timeSpentMinutes: sessionData.durationMinutes,
            completedItems: 1,
            totalItems: 1,
            percentage: 100,
          },
        );
      }
    } catch (error) {
      this.logger.error(
        `Error handling study session: ${getErrorMessage(error)}`,
        getErrorStack(error),
      );
    }
  }
}
