import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';
import { LearningPathProgressService } from './learning-path-progress.service';
import { LearningGoalsService } from './learning-goals.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { UserPreferences } from '#common/dto/progress.dto';
import {
  GoalType,
  GoalCategory,
  GoalPriority,
  GoalStatus,
  ProgressEntryType,
  LearningGoal,
  LearningPath,
  LearningPathMilestone,
  Prisma,
  ProgressStatus,
} from '@prisma/client';
import { getErrorMessage, getErrorStack } from '#common/utils/error.utils';
import {
  ProgressData,
  ModuleProgressUpdate,
  PathStructure,
  Phase,
  Module,
  TargetCriteriaDto as TargetCriteria,
  PathProgressWithLearningPath,
  PathProgressWithMilestones,
  ModuleProgress,
  ExtendedMilestone,
} from '#common/dto';
import { LearningPathRecommendationsService } from '../../../ai-analytics/services/learning-path-recommendations.service';

@Injectable()
export class LearningPathIntegrationService {
  private readonly logger = new Logger(LearningPathIntegrationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pathProgressService: LearningPathProgressService,
    private readonly goalsService: LearningGoalsService,
    private readonly recommendationsService: LearningPathRecommendationsService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async syncCourseProgress(
    userId: string,
    courseId: string,
    progressData: ProgressData,
  ): Promise<void> {
    try {
      this.logger.debug(
        `Starting course progress sync for user ${userId}, course ${courseId}`,
      );

      const pathProgresses = await this.getPathProgressesForCourse(
        userId,
        courseId,
      );

      if (pathProgresses.length === 0) {
        this.logger.debug(
          `No learning paths found containing course ${courseId} for user ${userId}`,
        );
        return;
      }

      const syncPromises = [
        ...pathProgresses.map((pathProgress) =>
          this.updatePathProgressFromCourse(
            pathProgress,
            courseId,
            progressData,
          ),
        ),
        this.updateGoalsFromCourseProgress(userId, courseId, progressData),
      ];

      await Promise.allSettled(syncPromises);

      this.eventEmitter.emit('integration.course-progress-synced', {
        userId,
        courseId,
        pathIds: pathProgresses.map((p) => p.learningPath),
        progressData,
      });

      this.logger.log(
        `Successfully synced course progress for user ${userId}, course ${courseId} across ${pathProgresses.length} paths`,
      );
    } catch (error) {
      this.logger.error(
        `Error syncing course progress for user ${userId}, course ${courseId}`,
        {
          error: getErrorMessage(error),
          stack: getErrorStack(error),
          progressData,
        },
      );
      throw new BadRequestException(
        `Failed to sync course progress: ${getErrorMessage(error)}`,
      );
    }
  }

  async syncAssessmentResults(
    userId: string,
    assessmentId: string,
    attemptData: ProgressData,
  ): Promise<void> {
    try {
      this.logger.debug(
        `Starting assessment sync for user ${userId}, assessment ${assessmentId}`,
      );

      const pathProgresses = await this.getPathProgressesForAssessment(
        userId,
        assessmentId,
      );

      if (pathProgresses.length === 0) {
        this.logger.debug(
          `No learning paths found containing assessment ${assessmentId} for user ${userId}`,
        );
        return;
      }

      const syncPromises = [
        ...pathProgresses.map((pathProgress) =>
          this.updatePathProgressFromAssessment(
            pathProgress,
            assessmentId,
            attemptData,
          ),
        ),
        this.updateGoalsFromAssessmentResults(
          userId,
          assessmentId,
          attemptData,
        ),
      ];

      await Promise.allSettled(syncPromises);

      await this.checkAndUpdateMilestones(pathProgresses);

      this.eventEmitter.emit('integration.assessment-synced', {
        userId,
        assessmentId,
        pathIds: pathProgresses.map((p) => p.learningPath),
        attemptData,
      });

      this.logger.log(
        `Successfully synced assessment results for user ${userId}, assessment ${assessmentId} across ${pathProgresses.length} paths`,
      );
    } catch (error) {
      this.logger.error(
        `Error syncing assessment results for user ${userId}, assessment ${assessmentId}`,
        {
          error: getErrorMessage(error),
          stack: getErrorStack(error),
          attemptData,
        },
      );
      throw new BadRequestException(
        `Failed to sync assessment results: ${getErrorMessage(error)}`,
      );
    }
  }

  async syncClinicalCaseCompletion(
    userId: string,
    caseId: string,
    attemptData: ProgressData,
  ): Promise<void> {
    try {
      this.logger.debug(
        `Starting clinical case sync for user ${userId}, case ${caseId}`,
      );

      const pathProgresses = await this.getPathProgressesForClinicalCase(
        userId,
        caseId,
      );

      if (pathProgresses.length === 0) {
        this.logger.debug(
          `No learning paths found containing clinical case ${caseId} for user ${userId}`,
        );
        return;
      }

      const syncPromises = [
        ...pathProgresses.map((pathProgress) =>
          this.updatePathProgressFromClinicalCase(
            pathProgress,
            caseId,
            attemptData,
          ),
        ),
        this.updateGoalsFromClinicalCaseCompletion(userId, caseId, attemptData),
      ];

      await Promise.allSettled(syncPromises);

      await this.checkPhaseCompletion(pathProgresses);

      this.eventEmitter.emit('integration.clinical-case-synced', {
        userId,
        caseId,
        pathIds: pathProgresses.map((p) => p.learningPath),
        attemptData,
      });

      this.logger.log(
        `Successfully synced clinical case completion for user ${userId}, case ${caseId} across ${pathProgresses.length} paths`,
      );
    } catch (error) {
      this.logger.error(
        `Error syncing clinical case completion for user ${userId}, case ${caseId}`,
        {
          error: getErrorMessage(error),
          stack: getErrorStack(error),
          attemptData,
        },
      );
      throw new BadRequestException(
        `Failed to sync clinical case completion: ${getErrorMessage(error)}`,
      );
    }
  }

  async autoEnrollInRecommendedPaths(
    userId: string,
    courseId: string,
  ): Promise<string[]> {
    try {
      this.logger.debug(
        `Starting auto-enrollment process for user ${userId}, course ${courseId}`,
      );

      const [recommendedPaths, userPreferences, currentEnrollments] =
        await Promise.all([
          this.getRecommendedPathsForCourse(courseId),
          this.getUserPreferences(userId),
          this.getUserCurrentEnrollments(userId),
        ]);

      if (recommendedPaths.length === 0) {
        this.logger.debug(`No recommended paths found for course ${courseId}`);
        return [];
      }

      if (!userPreferences.autoEnrollmentEnabled) {
        this.logger.debug(`Auto-enrollment disabled for user ${userId}`);
        return [];
      }

      const enrolledPathIds: string[] = [];
      const maxAutoEnrollments = userPreferences.maxAutoEnrollments || 3;
      const currentEnrollmentCount = currentEnrollments.length;

      const eligiblePaths = recommendedPaths
        .filter(
          (path: LearningPath) =>
            !currentEnrollments.some((e: any) => e.learningPathId === path.id),
        )
        .slice(0, maxAutoEnrollments - currentEnrollmentCount);

      for (const path of eligiblePaths) {
        try {
          await this.enrollUserInPath(userId, path.id, {
            source: 'auto_enrollment',
            triggeredByCourse: courseId,
            timestamp: new Date().toISOString(),
          });

          enrolledPathIds.push(path.id);
          this.logger.log(
            `Auto-enrolled user ${userId} in learning path ${path.id}`,
          );
        } catch (enrollError) {
          this.logger.warn(
            `Failed to auto-enroll user ${userId} in path ${path.id}:`,
            getErrorMessage(enrollError),
          );
        }
      }

      if (enrolledPathIds.length > 0) {
        this.eventEmitter.emit('integration.auto-enrollment-completed', {
          userId,
          courseId,
          enrolledPaths: enrolledPathIds,
          totalRecommended: recommendedPaths.length,
        });
      }

      this.logger.log(
        `Auto-enrollment completed for user ${userId}. Enrolled in ${enrolledPathIds.length} paths`,
      );
      return enrolledPathIds;
    } catch (error) {
      this.logger.error(
        `Error in auto-enrollment for user ${userId}, course ${courseId}`,
        {
          error: getErrorMessage(error),
          stack: getErrorStack(error),
        },
      );
      throw new BadRequestException(
        `Failed to auto-enroll in recommended paths: ${getErrorMessage(error)}`,
      );
    }
  }

  async createGoalsFromPathMilestones(
    userId: string,
    pathId: string,
  ): Promise<string[]> {
    try {
      this.logger.debug(
        `Creating goals from milestones for user ${userId}, path ${pathId}`,
      );

      const pathProgress = await this.getPathProgressWithMilestones(
        userId,
        pathId,
      );

      if (!pathProgress) {
        throw new NotFoundException(
          `Learning path progress not found for user ${userId}, path ${pathId}`,
        );
      }

      if (!pathProgress.learningPath.milestones?.length) {
        this.logger.debug(`No milestones found for learning path ${pathId}`);
        return [];
      }

      const goalIds: string[] = [];
      const existingGoals = await this.getExistingMilestoneGoals(
        userId,
        pathId,
      );

      for (const milestone of pathProgress.learningPath.milestones) {
        const existingGoal = existingGoals.find(
          (goal) => goal.title === `Milestone: ${milestone.title}`,
        );

        if (!existingGoal) {
          try {
            const goalId = await this.createMilestoneGoal(
              userId,
              pathId,
              milestone,
              pathProgress,
            );
            goalIds.push(goalId);

            // Create ScheduleEvent for this milestone
            const targetDate = this.calculateMilestoneTargetDate(
              pathProgress,
              milestone,
            );
            await this.createMilestoneScheduleEvent(
              userId,
              milestone,
              pathProgress.learningPath.title,
              targetDate,
            );
          } catch (goalError) {
            this.logger.warn(
              `Failed to create goal for milestone ${milestone.id}:`,
              getErrorMessage(goalError),
            );
          }
        }
      }

      if (goalIds.length > 0) {
        this.eventEmitter.emit('integration.milestone-goals-created', {
          userId,
          pathId,
          goalIds,
        });
      }

      this.logger.log(
        `Created ${goalIds.length} goals from milestones for user ${userId}, path ${pathId}`,
      );
      return goalIds;
    } catch (error) {
      this.logger.error(
        `Error creating goals from path milestones for user ${userId}, path ${pathId}`,
        {
          error: getErrorMessage(error),
          stack: getErrorStack(error),
        },
      );
      throw new BadRequestException(
        `Failed to create goals from milestones: ${getErrorMessage(error)}`,
      );
    }
  }

  private async createMilestoneScheduleEvent(
    userId: string,
    milestone: LearningPathMilestone,
    learningPathTitle: string,
    targetDate: Date,
  ): Promise<void> {
    try {
      const eventStartDate = new Date(targetDate);
      eventStartDate.setHours(9, 0, 0, 0); // Set to 9 AM

      const eventEndDate = new Date(targetDate);
      eventEndDate.setHours(10, 0, 0, 0); // 1 hour duration

      await this.prisma.scheduleEvent.create({
        data: {
          userId,
          title: `Milestone: ${milestone.title}`,
          description:
            milestone.description ||
            `Complete milestone in learning path: ${learningPathTitle}`,
          date: eventStartDate,
          endDate: eventEndDate,
          type: 'milestone',
          metadata: {
            learningPathMilestone: true,
            milestoneId: milestone.id,
            learningPathTitle,
            order: milestone.order,
          },
        },
      });

      this.logger.debug(
        `Created schedule event for milestone ${milestone.id}, user ${userId}`,
      );
    } catch (error) {
      this.logger.warn(
        `Failed to create schedule event for milestone ${milestone.id}:`,
        getErrorMessage(error),
      );
      // Don't throw - event creation is secondary to goal creation
    }
  }

  async bulkSyncProgress(
    userId: string,
    progressUpdates: Array<{
      resourceType: 'course' | 'assessment' | 'clinical_case';
      resourceId: string;
      progressData: ProgressData;
    }>,
  ): Promise<{ successful: number; failed: number; errors: string[] }> {
    const results = { successful: 0, failed: 0, errors: [] as string[] };

    for (const update of progressUpdates) {
      try {
        switch (update.resourceType) {
          case 'course':
            await this.syncCourseProgress(
              userId,
              update.resourceId,
              update.progressData,
            );
            break;
          case 'assessment':
            await this.syncAssessmentResults(
              userId,
              update.resourceId,
              update.progressData,
            );
            break;
          case 'clinical_case':
            await this.syncClinicalCaseCompletion(
              userId,
              update.resourceId,
              update.progressData,
            );
            break;
        }
        results.successful++;
      } catch (error) {
        results.failed++;
        results.errors.push(
          `${update.resourceType}:${update.resourceId} - ${getErrorMessage(error)}`,
        );
      }
    }

    this.logger.log(
      `Bulk sync completed for user ${userId}: ${results.successful} successful, ${results.failed} failed`,
    );
    return results;
  }

  private async getPathProgressesForCourse(
    userId: string,
    courseId: string,
  ): Promise<any[]> {
    try {
      const pathProgresses = await this.prisma.learningPathProgress.findMany({
        where: {
          userId,
          status: {
            in: [ProgressStatus.inProgress, ProgressStatus.notStarted],
          },
        },
        include: {
          learningPath: {
            select: {
              id: true,
              title: true,
              pathStructure: true,
            },
          },
        },
      });

      return pathProgresses.filter((p) =>
        this.pathContainsResource(
          p.learningPath.pathStructure as unknown as PathStructure,
          'course',
          courseId,
        ),
      );
    } catch (error) {
      this.logger.error(
        `Error fetching path progresses for course ${courseId}:`,
        error,
      );
      return [];
    }
  }

  private async getPathProgressesForAssessment(
    userId: string,
    assessmentId: string,
  ): Promise<any[]> {
    try {
      const pathProgresses = await this.prisma.learningPathProgress.findMany({
        where: {
          userId,
          status: {
            in: [ProgressStatus.inProgress, ProgressStatus.notStarted],
          },
        },
        include: {
          learningPath: {
            select: {
              id: true,
              title: true,
              pathStructure: true,
            },
          },
        },
      });

      return pathProgresses.filter((p) =>
        this.pathContainsResource(
          p.learningPath.pathStructure as unknown as PathStructure,
          'assessment',
          assessmentId,
        ),
      );
    } catch (error) {
      this.logger.error(
        `Error fetching path progresses for assessment ${assessmentId}:`,
        error,
      );
      return [];
    }
  }

  private async getPathProgressesForClinicalCase(
    userId: string,
    caseId: string,
  ): Promise<any[]> {
    try {
      const pathProgresses = await this.prisma.learningPathProgress.findMany({
        where: {
          userId,
          status: {
            in: [ProgressStatus.inProgress, ProgressStatus.notStarted],
          },
        },
        include: {
          learningPath: {
            select: {
              id: true,
              title: true,
              pathStructure: true,
            },
          },
        },
      });

      return pathProgresses.filter((p) =>
        this.pathContainsResource(
          p.learningPath.pathStructure as unknown as PathStructure,
          'clinical_case',
          caseId,
        ),
      );
    } catch (error) {
      this.logger.error(
        `Error fetching path progresses for clinical case ${caseId}:`,
        error,
      );
      return [];
    }
  }

  private async updatePathProgressFromCourse(
    pathProgress: PathProgressWithLearningPath,
    courseId: string,
    progressData: ProgressData,
  ): Promise<void> {
    const moduleInfo = this.findModuleInPathStructure(
      pathProgress.learningPath.pathStructure,
      'course',
      courseId,
    );

    if (moduleInfo) {
      const completedItems = progressData.completed ? 1 : 0;
      const totalItems = 1;
      const percentage = progressData.progressPercentage || 0;

      const updateData: ModuleProgressUpdate = {
        phaseId: moduleInfo.phase.id,
        moduleId: moduleInfo.module.id,
        progressPercentage: percentage,
        timeSpentMinutes: progressData.timeSpentMinutes || 0,
        status: this.mapProgressStatus(
          progressData.status,
          progressData.completed,
        ),
        completedItems,
        totalItems,
        percentage,
      };

      await this.updateModuleProgress(pathProgress, updateData);
    }
  }

  private async updatePathProgressFromAssessment(
    pathProgress: PathProgressWithLearningPath,
    assessmentId: string,
    attemptData: ProgressData,
  ): Promise<void> {
    const moduleInfo = this.findModuleInPathStructure(
      pathProgress.learningPath.pathStructure,
      'assessment',
      assessmentId,
    );

    if (moduleInfo) {
      const progressPercentage = attemptData.passed
        ? 100
        : attemptData.score || 0;
      const moduleStatus = attemptData.passed
        ? 'completed'
        : attemptData.score && attemptData.score > 0
          ? 'inProgress'
          : 'failed';

      const completedItems = attemptData.passed ? 1 : 0;
      const totalItems = 1;
      const percentage = progressPercentage;

      const updateData: ModuleProgressUpdate = {
        phaseId: moduleInfo.phase.id,
        moduleId: moduleInfo.module.id,
        progressPercentage,
        timeSpentMinutes: attemptData.timeSpentMinutes || 0,
        status: moduleStatus,
        score: attemptData.score,
        timestamp: attemptData.timestamp
          ? new Date(attemptData.timestamp)
          : new Date(),
        completedItems,
        totalItems,
        percentage,
      };

      await this.updateModuleProgress(pathProgress, updateData);
    }
  }

  private async updatePathProgressFromClinicalCase(
    pathProgress: PathProgressWithLearningPath,
    caseId: string,
    attemptData: ProgressData,
  ): Promise<void> {
    const moduleInfo = this.findModuleInPathStructure(
      pathProgress.learningPath.pathStructure,
      'clinical_case',
      caseId,
    );

    if (moduleInfo) {
      const progressPercentage = attemptData.completed
        ? 100
        : attemptData.progressPercentage || 0;

      const completedItems = attemptData.completed ? 1 : 0;
      const totalItems = 1;
      const percentage = progressPercentage;

      const updateData: ModuleProgressUpdate = {
        phaseId: moduleInfo.phase.id,
        moduleId: moduleInfo.module.id,
        progressPercentage,
        timeSpentMinutes: attemptData.timeSpentMinutes || 0,
        status: attemptData.completed ? 'completed' : 'inProgress',
        score: attemptData.score,
        completedItems,
        totalItems,
        percentage,
      };

      await this.updateModuleProgress(pathProgress, updateData);
    }
  }

  private findModuleInPathStructure(
    pathStructure: PathStructure,
    moduleType: string,
    resourceId: string,
  ): { phase: Phase; module: Module } | null {
    if (!pathStructure?.phases) {
      return null;
    }

    for (const phase of pathStructure.phases) {
      if (!phase.modules) {
        continue;
      }

      for (const module of phase.modules) {
        if (module.type === moduleType && module.resourceId === resourceId) {
          return { phase, module };
        }
      }
    }
    return null;
  }

  private async updateModuleProgress(
    pathProgress: PathProgressWithLearningPath,
    updateData: ModuleProgressUpdate,
  ): Promise<void> {
    try {
      await this.pathProgressService.updateProgress(
        pathProgress.userId,
        pathProgress.learningPathId,
        updateData,
      );

      this.logger.debug(
        `Updated module progress for path ${pathProgress.learningPathId}, module ${updateData.moduleId}`,
      );
    } catch (error) {
      this.logger.error(`Error updating module progress:`, {
        error: getErrorMessage(error),
        pathId: pathProgress.learningPathId,
        moduleId: updateData.moduleId,
      });
    }
  }

  private async updateGoalsFromCourseProgress(
    userId: string,
    courseId: string,
    progressData: ProgressData,
  ): Promise<void> {
    try {
      const relatedGoals = await this.prisma.learningGoal.findMany({
        where: {
          userId,
          courseId,
          status: GoalStatus.active,
        },
      });

      const goalUpdates = relatedGoals.map(async (goal) => {
        if (
          goal.category === GoalCategory.course_completion &&
          progressData.completed
        ) {
          return this.goalsService.update(
            goal.id,
            {
              status: GoalStatus.completed,
              progressPercentage: 100,
              completedAt: progressData.timestamp || new Date(),
            },
            userId,
          );
        } else if (
          goal.category === GoalCategory.study_time &&
          progressData.timeSpentMinutes
        ) {
          return this.updateStudyTimeGoal(
            goal,
            userId,
            progressData.timeSpentMinutes,
            courseId,
          );
        }
      });

      await Promise.allSettled(goalUpdates);
    } catch (error) {
      this.logger.error(`Error updating goals from course progress:`, error);
    }
  }

  private async updateStudyTimeGoal(
    goal: LearningGoal,
    userId: string,
    timeSpentMinutes: number,
    courseId: string,
  ): Promise<void> {
    try {
      const targetCriteria = (
        goal.metadata as unknown as Record<string, TargetCriteria>
      ).targetCriteria;
      const currentValue = Number(targetCriteria?.currentValue) || 0;
      const newValue = currentValue + timeSpentMinutes;

      await this.goalsService.addProgressEntry(goal.id, userId, {
        entryType: ProgressEntryType.automatic,
        progressValue: newValue,
        notes: `Course progress update: ${courseId}`,
        metadata: {
          source: 'course_progress',
          courseId,
          sessionMinutes: timeSpentMinutes,
        },
      });
    } catch (error) {
      this.logger.error(`Error updating study time goal:`, error);
    }
  }

  private async updateGoalsFromAssessmentResults(
    userId: string,
    assessmentId: string,
    attemptData: ProgressData,
  ): Promise<void> {
    if (!attemptData.score && !attemptData.passed) {
      return;
    }

    try {
      const relatedGoals = await this.prisma.learningGoal.findMany({
        where: {
          userId,
          category: {
            in: [GoalCategory.assessment_score, GoalCategory.skill_mastery],
          },
          status: GoalStatus.active,
        },
        select: {
          id: true,
          userId: true,
          category: true,
          status: true,
          progress: true,
        },
      });

      const goalUpdates = relatedGoals
        .filter((goal) => {
          if (goal.category === GoalCategory.assessment_score) {
            const targetScore = 0;
            return !!attemptData.score && attemptData.score >= targetScore;
          }
          return attemptData.passed;
        })
        .map((goal) =>
          this.goalsService.addProgressEntry(goal.id, userId, {
            entryType: ProgressEntryType.automatic,
            progressValue: attemptData.score || (attemptData.passed ? 100 : 0),
            notes: `Assessment completed: ${assessmentId}`,
            metadata: {
              source: 'assessment_result',
              assessmentId,
              isPassed: attemptData.passed,
              score: attemptData.score,
            },
          }),
        );

      await Promise.allSettled(goalUpdates);
    } catch (error) {
      this.logger.error(`Error updating goals from assessment results:`, error);
    }
  }

  private async updateGoalsFromClinicalCaseCompletion(
    userId: string,
    caseId: string,
    attemptData: ProgressData,
  ): Promise<void> {
    if (!attemptData.completed) {
      return;
    }

    try {
      const relatedGoals = await this.prisma.learningGoal.findMany({
        where: {
          userId,
          category: GoalCategory.clinical_cases,
          status: GoalStatus.active as unknown as ProgressStatus,
        },
        select: {
          id: true,
          userId: true,
          category: true,
          status: true,
          progress: true,
        },
      });

      const goalUpdates = relatedGoals.map((goal) => {
        const currentValue = goal.progress || 0;
        const newValue = currentValue + 1;

        return this.goalsService.addProgressEntry(goal.id, userId, {
          entryType: ProgressEntryType.automatic,
          progressValue: newValue,
          notes: `Clinical case completed: ${caseId}`,
          metadata: {
            source: 'clinical_case_completion',
            caseId,
            completedAt:
              attemptData.timestamp?.toISOString() || new Date().toISOString(),
          },
        });
      });

      await Promise.allSettled(goalUpdates);
    } catch (error) {
      this.logger.error(
        `Error updating goals from clinical case completion:`,
        error,
      );
    }
  }

  private async getRecommendedPathsForCourse(
    courseId: string,
  ): Promise<LearningPath[]> {
    try {
      const course = await this.prisma.course.findUnique({
        where: { id: courseId },
        select: { tags: true, category: true, title: true },
      });

      if (!course) {
        return [];
      }

      return await this.prisma.learningPath.findMany({
        where: {
          status: 'published',
          OR: [{}],
        },
        take: 5,
      });
    } catch (error) {
      this.logger.error(
        `Error getting recommended paths for course ${courseId}:`,
        error,
      );
      return [];
    }
  }

  private async getUserPreferences(userId: string): Promise<UserPreferences> {
    try {
      const preferences = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          preferences: true,
        },
      });
      const userPrefs = preferences?.preferences as Prisma.JsonObject;
      return {
        maxAutoEnrollments: (userPrefs?.maxAutoEnrollments as number) || 3,
        autoEnrollmentEnabled:
          (userPrefs?.autoEnrollmentEnabled as boolean) ?? true,
        learningPreferences: userPrefs?.learningPreferences ?? {},
      };
    } catch (_error) {
      this.logger.debug(`No user preferences found for user ${userId}`);
      return {
        maxAutoEnrollments: 3,
        autoEnrollmentEnabled: true,
        learningPreferences: {},
      };
    }
  }

  private async getUserCurrentEnrollments(
    userId: string,
  ): Promise<{ learningPathId: string }[]> {
    try {
      return await this.prisma.learningPathProgress.findMany({
        where: {
          userId,
          status: {
            in: [ProgressStatus.inProgress, ProgressStatus.notStarted],
          },
        },
        select: { learningPathId: true },
      });
    } catch (error) {
      this.logger.error(
        `Error getting current enrollments for user ${userId}:`,
        error,
      );
      return [];
    }
  }

  private async enrollUserInPath(
    userId: string,
    pathId: string,
    metadata?: Prisma.JsonObject,
  ): Promise<void> {
    try {
      await this.pathProgressService.startLearningPath(userId, {
        learningPathId: pathId,
        preferences: {},
        metadata,
      });
    } catch (error) {
      this.logger.error(
        `Error enrolling user ${userId} in path ${pathId}:`,
        error,
      );
      throw error;
    }
  }

  private async getPathProgressWithMilestones(
    userId: string,
    pathId: string,
  ): Promise<any> {
    try {
      return await this.prisma.learningPathProgress.findUnique({
        where: { userId_learningPathId: { userId, learningPathId: pathId } },
        include: {
          learningPath: {
            include: {
              milestones: {
                orderBy: { order: 'asc' },
              },
            },
          },
        },
      });
    } catch (error) {
      this.logger.error(`Error getting path progress with milestones:`, error);
      return null;
    }
  }

  private async getExistingMilestoneGoals(
    userId: string,
    pathId: string,
  ): Promise<LearningGoal[]> {
    try {
      return await this.prisma.learningGoal.findMany({
        where: {
          userId,
          metadata: { path: ['learningPathId'], equals: pathId },
          title: { startsWith: 'Milestone:' },
        },
      });
    } catch (error) {
      this.logger.error(`Error finding existing milestone goals:`, error);
      return [];
    }
  }

  private async createMilestoneGoal(
    userId: string,
    pathId: string,
    milestone: LearningPathMilestone,
    pathProgress: PathProgressWithMilestones,
  ): Promise<string> {
    try {
      const goal = await this.goalsService.create(
        {
          title: `Milestone: ${milestone.title}`,
          description:
            milestone.description ||
            `Complete milestone in learning path: ${pathProgress.learningPath.title}`,
          type: GoalType.custom,
          category: GoalCategory.learning_path,
          priority: (milestone.required ? 'high' : 'medium') as any, // 2 = high, 1 = medium
          status: GoalStatus.active,
          targetCriteria: {
            type: 'boolean',
            targetValue: true,
            measurementMethod: 'milestone_completion',
            unit: 'milestone',
          },
          startDate: new Date(),
          targetDate: this.calculateMilestoneTargetDate(
            pathProgress,
            milestone,
          ),
          metadata: { learningPathId: pathId, milestoneId: milestone.id },
          smartCriteria: {
            specific: `Complete milestone: ${milestone.title}`,
            measurable: 'Milestone completion status (true/false)',
            achievable: 'Based on learning path structure and timeline',
            relevant: `Part of structured learning journey: ${pathProgress.learningPath.title}`,
            timeBound: `Target completion by ${this.calculateMilestoneTargetDate(pathProgress, milestone).toDateString()}`,
          },
          progressTracking: {
            autoTracking: true,
            manualUpdates: false,
            dataSources: ['learning_path_progress'],
            updateFrequency: 'real_time',
          },
        },
        userId,
      );

      this.logger.debug(
        `Created milestone goal ${goal.id} for user ${userId}, milestone ${milestone.id}`,
      );
      return goal.id;
    } catch (error) {
      this.logger.error(`Error creating milestone goal:`, error);
      throw error;
    }
  }

  private calculateMilestoneTargetDate(
    pathProgress: PathProgressWithMilestones,
    milestone: LearningPathMilestone,
  ): Date {
    const startDate = pathProgress.startedAt || new Date();
    const pathDurationWeeks =
      pathProgress.learningPath.estimatedDurationWeeks || 12;
    const milestoneOrder = milestone.order || 1;
    const totalMilestones = pathProgress.learningPath.milestones?.length || 1;

    const milestoneWeeks =
      (pathDurationWeeks / totalMilestones) * milestoneOrder;
    const targetDate = new Date(startDate);
    targetDate.setDate(targetDate.getDate() + milestoneWeeks * 7);

    return targetDate;
  }

  private pathContainsResource(
    pathStructure: PathStructure,
    resourceType: string,
    resourceId: string,
  ): boolean {
    if (!pathStructure?.phases) {
      return false;
    }

    return pathStructure.phases.some((phase) =>
      phase.modules?.some(
        (module) =>
          module.type === resourceType && module.resourceId === resourceId,
      ),
    );
  }

  private mapProgressStatus(
    status?: string,
    completed?: boolean,
  ): 'notStarted' | 'inProgress' | 'completed' | 'failed' {
    if (completed) {
      return 'completed';
    }
    if (status === 'completed') {
      return 'completed';
    }
    if (status === 'failed' || status === 'failure') {
      return 'failed';
    }
    if (status === 'inProgress') {
      return 'inProgress';
    }
    if (status === 'notStarted') {
      return 'notStarted';
    }
    return 'inProgress';
  }

  private async checkAndUpdateMilestones(
    pathProgresses: PathProgressWithLearningPath[],
  ): Promise<void> {
    for (const pathProgress of pathProgresses) {
      try {
        const fullPathProgress = await this.getPathProgressWithMilestones(
          pathProgress.userId,
          pathProgress.learningPathId,
        );
        if (
          fullPathProgress &&
          fullPathProgress.learningPath.milestones?.length > 0
        ) {
          const completedModules =
            this.getCompletedModulesCount(fullPathProgress);
          const totalModules = this.getTotalModulesCount(
            fullPathProgress.learningPath.pathStructure,
          );
          const completionPercentage =
            totalModules > 0 ? (completedModules / totalModules) * 100 : 0;

          const achievedIds =
            fullPathProgress.milestonesAchieved?.map(
              (m: any) => m.milestoneId,
            ) || [];

          for (const milestone of fullPathProgress.learningPath.milestones) {
            const extendedMilestone = milestone as ExtendedMilestone;
            if (
              !achievedIds.includes(milestone.id) &&
              completionPercentage >=
                (extendedMilestone.requiredPercentage || 100)
            ) {
              await this.achieveMilestone(
                fullPathProgress.userId,
                fullPathProgress.learningPathId,
                milestone.id,
              );
            }
          }
        }
      } catch (error) {
        this.logger.error(
          `Error checking milestones for path ${pathProgress.learningPathId}:`,
          error,
        );
      }
    }
  }

  private async checkPhaseCompletion(
    pathProgresses: PathProgressWithLearningPath[],
  ): Promise<void> {
    for (const pathProgress of pathProgresses) {
      try {
        const pathStructure = pathProgress.learningPath.pathStructure;
        if (!pathStructure?.phases) {
          continue;
        }

        const phaseProgresses = pathProgress.phaseProgress || {};

        for (const phase of pathStructure.phases) {
          const phaseProgress = phaseProgresses[phase.id];
          if (!phaseProgress?.completed) {
            const isPhaseCompleted = this.checkIfPhaseCompleted(
              phase,
              pathProgress.moduleProgress || {},
            );

            if (isPhaseCompleted) {
              await this.markPhaseAsCompleted(
                pathProgress.userId,
                pathProgress.learningPathId,
                phase.id,
              );

              this.eventEmitter.emit('integration.phase-completed', {
                userId: pathProgress.userId,
                pathId: pathProgress.learningPathId,
                phaseId: phase.id,
                phaseTitle: phase.title,
              });
            }
          }
        }
      } catch (error) {
        this.logger.error(
          `Error checking phase completion for path ${pathProgress.learningPathId}:`,
          error,
        );
      }
    }
  }

  private getCompletedModulesCount(
    pathProgress: PathProgressWithMilestones,
  ): number {
    const moduleProgress = pathProgress.moduleProgress || {};
    return Object.values(moduleProgress).filter(
      (progress: ModuleProgress) => progress.status === 'completed',
    ).length;
  }

  private getTotalModulesCount(pathStructure: PathStructure): number {
    if (!pathStructure?.phases) {
      return 0;
    }

    return pathStructure.phases.reduce(
      (total: number, phase: Phase) => total + (phase.modules?.length || 0),
      0,
    );
  }

  private checkIfPhaseCompleted(
    phase: Phase,
    moduleProgress: Record<string, ModuleProgress>,
  ): boolean {
    if (!phase.modules?.length) {
      return true;
    }

    const requiredModules = phase.modules.filter(
      (module) => module.required !== false,
    );
    const completedRequiredModules = requiredModules.filter(
      (module) => moduleProgress[module.id]?.status === 'completed',
    );

    const minRequired =
      phase.requirements?.minModulesCompleted || requiredModules.length;
    return completedRequiredModules.length >= minRequired;
  }

  private async achieveMilestone(
    userId: string,
    pathId: string,
    milestoneId: string,
  ): Promise<void> {
    try {
      await this.prisma.learningPathProgress.update({
        where: { userId_learningPathId: { userId, learningPathId: pathId } },
        data: {
          milestonesAchieved: {
            push: {
              milestoneId,
              achievedAt: new Date(),
              metadata: { source: 'integration_service' },
            },
          },
        },
      });

      const milestoneGoal = await this.prisma.learningGoal.findFirst({
        where: {
          userId,
          metadata: { path: ['milestoneId'], equals: milestoneId },
        },
      });

      if (milestoneGoal) {
        await this.goalsService.update(
          milestoneGoal.id,
          {
            status: GoalStatus.completed,
            progressPercentage: 100,
            completedAt: new Date(),
          },
          userId,
        );
      }

      this.eventEmitter.emit('integration.milestone-achieved', {
        userId,
        pathId,
        milestoneId,
        achievedAt: new Date(),
      });

      this.logger.log(
        `Milestone ${milestoneId} achieved for user ${userId} in path ${pathId}`,
      );
    } catch (error) {
      this.logger.error(`Error achieving milestone ${milestoneId}:`, error);
    }
  }

  private async markPhaseAsCompleted(
    userId: string,
    pathId: string,
    phaseId: string,
  ): Promise<void> {
    try {
      const currentProgress = await this.prisma.learningPathProgress.findUnique(
        {
          where: { userId_learningPathId: { userId, learningPathId: pathId } },
          select: { phaseProgress: true },
        },
      );

      const currentPhaseProgress =
        (currentProgress?.phaseProgress as Prisma.JsonObject) || {};
      const updatedPhaseProgress = {
        ...currentPhaseProgress,
        [phaseId]: {
          ...((currentPhaseProgress[phaseId] as Prisma.JsonObject) || {}),
          completed: true,
          completedAt: new Date().toISOString(),
        },
      };

      await this.prisma.learningPathProgress.update({
        where: { userId_learningPathId: { userId, learningPathId: pathId } },
        data: { phaseProgress: updatedPhaseProgress },
      });

      this.logger.debug(
        `Marked phase ${phaseId} as completed for user ${userId} in path ${pathId}`,
      );
    } catch (error) {
      this.logger.error(`Error marking phase ${phaseId} as completed:`, error);
    }
  }

  async getIntegrationStatus(userId: string): Promise<{
    totalPaths: number;
    activeSyncs: number;
    lastSyncAt: Date | null;
    errorCount: number;
    recentEvents: any[];
  }> {
    try {
      const pathProgresses = await this.prisma.learningPathProgress.findMany({
        where: { userId },
        include: { learningPath: { select: { title: true } } },
      });

      const recentEvents = this.getRecentIntegrationEvents(userId);

      return {
        totalPaths: pathProgresses.length,
        activeSyncs: pathProgresses.filter(
          (p) => p.status === ProgressStatus.inProgress,
        ).length,
        lastSyncAt: pathProgresses.reduce(
          (latest, progress) => {
            const lastUpdate = progress.lastAccessedAt;
            return !latest || (lastUpdate && lastUpdate > latest)
              ? lastUpdate
              : latest;
          },
          null as Date | null,
        ),
        errorCount: recentEvents.filter((event) => event.type === 'error')
          .length,
        recentEvents: recentEvents.slice(0, 10),
      };
    } catch (error) {
      this.logger.error(
        `Error getting integration status for user ${userId}:`,
        error,
      );
      throw new BadRequestException(
        `Failed to get integration status: ${getErrorMessage(error)}`,
      );
    }
  }

  private getRecentIntegrationEvents(_userId: string): any[] {
    return [];
  }

  retryFailedIntegrations(
    userId: string,
  ): Promise<{ retried: number; successful: number; failed: number }> {
    try {
      this.logger.log(`Retrying failed integrations for user ${userId}`);
      return Promise.resolve({
        retried: 0,
        successful: 0,
        failed: 0,
      });
    } catch (error) {
      this.logger.error(
        `Error retrying failed integrations for user ${userId}:`,
        error,
      );
      throw new BadRequestException(
        `Failed to retry integrations: ${getErrorMessage(error)}`,
      );
    }
  }

  async getRecommendedPaths(userId: string, limit: number = 5): Promise<any[]> {
    try {
      const recommendations =
        await this.recommendationsService.getRecommendations(userId, limit);

      if (recommendations.length === 0) {
        // Fallback to simple logic if Rust service returns nothing
        const enrolledPaths = await this.prisma.pathProgress.findMany({
          where: { userId },
          select: { learningPathId: true },
        });

        const enrolledPathIds = enrolledPaths.map(
          (p: { learningPathId: string }) => p.learningPathId,
        );

        const fallbackPaths = await this.prisma.learningPath.findMany({
          where: {
            id: { notIn: enrolledPathIds },
            status: 'published' as any,
          },
          take: limit,
          orderBy: { createdAt: 'desc' },
        });

        return fallbackPaths.map((path) => ({
          id: path.id,
          title: path.title,
          description: path.description,
          difficulty: path.difficulty,
          estimatedDurationWeeks: path.estimatedDurationWeeks,
          estimatedHours: path.estimatedHours,
        }));
      }

      // Already enriched by LearningPathRecommendationsService
      const pathIds = recommendations.map((r) => r.pathId);
      const paths = await this.prisma.learningPath.findMany({
        where: { id: { in: pathIds } },
      });

      return paths.map((path) => ({
        id: path.id,
        title: path.title,
        description: path.description,
        difficulty: path.difficulty,
        estimatedDurationWeeks: path.estimatedDurationWeeks,
        estimatedHours: path.estimatedHours,
        recommendationScore: recommendations.find((r) => r.pathId === path.id)
          ?.score,
      }));
    } catch (error) {
      this.logger.error(
        `Error getting recommended paths for user ${userId}: ${getErrorMessage(error)}`,
      );
      return [];
    }
  }

  private mapPriorityToNumber(priority: GoalPriority): number {
    switch (priority) {
      case 'low':
        return 1;
      case 'medium':
        return 2;
      case 'high':
        return 3;
      case 'critical':
        return 4;
      default:
        return 2;
    }
  }
}
