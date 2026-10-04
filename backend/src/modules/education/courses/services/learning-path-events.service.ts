// src/modules/learning/services/learning-path-events.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { getErrorMessage, getErrorStack } from '#common/utils/error.utils';
import { LearningPathIntegrationService } from './learning-path-integration.service';
import { ProgressData } from '#common/dto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '#infrastructure/prisma/prisma.service';

@Injectable()
export class LearningPathEventsService {
  private readonly logger = new Logger(LearningPathEventsService.name);

  constructor(
    private readonly integrationService: LearningPathIntegrationService,
    private readonly prisma: PrismaService,
  ) {}

  private async resolveGoalScheduleEvent(
    userId: string,
    goalId: string,
  ) {
    return this.prisma.scheduleEvent.findFirst({
      where: {
        userId,
        metadata: {
          path: ['goalId'],
          equals: goalId,
        },
      },
    });
  }

  private async resolveMilestoneScheduleEvent(
    userId: string,
    milestoneId: string,
  ) {
    return this.prisma.scheduleEvent.findFirst({
      where: {
        userId,
        metadata: {
          path: ['milestoneId'],
          equals: milestoneId,
        },
      },
    });
  }

  private async createGoalScheduleEvent(
    userId: string,
    goalId: string,
    title: string,
    targetDate?: Date | string | null,
    metadata?: Prisma.JsonObject | null,
  ): Promise<void> {
    if (!targetDate) {
      return;
    }

    const existing = await this.resolveGoalScheduleEvent(userId, goalId);
    if (existing) {
      return;
    }

    const eventDate = new Date(targetDate);
    const startDate = new Date(eventDate);
    startDate.setHours(9, 0, 0, 0);
    const endDate = new Date(eventDate);
    endDate.setHours(10, 0, 0, 0);

    const milestoneId = metadata?.milestoneId as string | undefined;
    const learningPathId = metadata?.learningPathId as string | undefined;

    await this.prisma.scheduleEvent.create({
      data: {
        userId,
        title: `Goal: ${title}`,
        description: `Target date for goal: ${title}`,
        date: startDate,
        endDate,
        type: milestoneId ? 'milestone' : 'goal',
        status: 'pending',
        category: 'academic',
        metadata: {
          goalId,
          createdFromGoal: true,
          goalTitle: title,
          ...(milestoneId ? { milestoneId, learningPathMilestone: true } : {}),
          ...(learningPathId ? { learningPathId } : {}),
        },
      },
    });
  }

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
        payload.attemptData,
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
        payload.attemptData,
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

  @OnEvent('learning-goal.created')
  async handleGoalCreated(payload: {
    userId: string;
    goalId: string;
    data: {
      title: string;
      targetDate?: Date | string | null;
      metadata?: Prisma.JsonObject | null;
    };
  }) {
    this.logger.log(
      `Handling goal creation for user ${payload.userId}, goal ${payload.goalId}`,
    );

    try {
      await this.createGoalScheduleEvent(
        payload.userId,
        payload.goalId,
        payload.data.title,
        payload.data.targetDate,
        payload.data.metadata ?? null,
      );
    } catch (error) {
      this.logger.error(
        `Error handling goal creation: ${getErrorMessage(error)}`,
        getErrorStack(error),
      );
    }
  }

  @OnEvent('integration.milestone-achieved')
  async handleMilestoneAchieved(payload: {
    userId: string;
    pathId: string;
    milestoneId: string;
    achievedAt?: Date;
  }) {
    this.logger.log(
      `Handling milestone achievement for user ${payload.userId}, milestone ${payload.milestoneId}`,
    );

    try {
      await this.integrationService.syncMilestoneAchievement(
        payload.userId,
        payload.milestoneId,
      );

      const milestoneEvent = await this.resolveMilestoneScheduleEvent(
        payload.userId,
        payload.milestoneId,
      );

      if (milestoneEvent) {
        await this.prisma.scheduleEvent.update({
          where: { id: milestoneEvent.id },
          data: {
            completed: true,
            status: 'completed',
            metadata: {
              ...(milestoneEvent.metadata as Prisma.JsonObject | null),
              achievedAt: (payload.achievedAt ?? new Date()).toISOString(),
            },
          },
        });
      }
    } catch (error) {
      this.logger.error(
        `Error handling milestone achievement: ${getErrorMessage(error)}`,
        getErrorStack(error),
      );
    }
  }

  @OnEvent('learning-goal.completed')
  async handleGoalCompleted(payload: {
    userId: string;
    goalId: string;
    completionData: Prisma.JsonObject;
  }) {
    this.logger.log(
      `Handling goal completion for user ${payload.userId}, goal ${payload.goalId}`,
    );

    try {
      const goal = await this.prisma.learningGoal.findUnique({
        where: { id: payload.goalId },
        select: { title: true, targetDate: true },
      });

      if (!goal) {
        return;
      }

      const scheduleEvent = await this.resolveGoalScheduleEvent(
        payload.userId,
        payload.goalId,
      );

      if (scheduleEvent) {
        await this.prisma.scheduleEvent.update({
          where: { id: scheduleEvent.id },
          data: {
            completed: true,
            status: 'completed',
            metadata: {
              ...(scheduleEvent.metadata as Prisma.JsonObject | null),
              completedAt: (payload.completionData?.completedAt as Date | string | undefined)?.toString?.() ?? new Date().toISOString(),
            },
          },
        });
      }
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
