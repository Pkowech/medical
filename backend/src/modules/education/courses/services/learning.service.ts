// src/modules/learning/services/learning.service.ts
import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '#infrastructure/prisma/prisma.service';
import { ProgressStatus } from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { LearningRecommendation } from '#common/dto/learning.dto';
import { PrerequisiteCheck } from '#common/dto/prerequisites.dto';
import {
  UserLearningStatus,
  UserCourseProgress,
  UserLearningPathProgress,
  ValidatedCourse,
  ValidatedLearningPath,
  ProgressResponse,
  ProgressUpdateData,
  ProgressUpdateDto,
} from '#common/dto/progress.dto';
import { ProgressService } from './progress.service';
import { LearningPathProgressService } from './learning-path-progress.service';
import { getErrorMessage, getErrorStack } from '#common/utils/error.utils';
import { LearningAnalyticsService } from '../../../ai-analytics/services/learning-analytics.service';
import { StudyAnalyticsService } from '../../../ai-analytics/services/study-analytics.service';

@Injectable()
export class LearningService {
  protected readonly logger = new Logger(LearningService.name);

  constructor(
    protected readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly progressService: ProgressService,
    private readonly learningPathProgressService: LearningPathProgressService,
    private readonly learningAnalyticsService: LearningAnalyticsService,
    private readonly studyAnalyticsService: StudyAnalyticsService,
  ) {}

  async enrollInCourse(userId: string, courseId: string): Promise<void> {
    try {
      await this.validateCourseAvailability(courseId);

      const prerequisiteCheck = this.checkPrerequisites(
        userId,
        courseId,
        'COURSE',
      );
      if (!prerequisiteCheck.satisfied) {
        throw new BadRequestException(
          `Prerequisites not satisfied. Missing: ${prerequisiteCheck.missingPrerequisites
            ?.map((p) => p.title)
            .join(', ')}`,
        );
      }

      const existingProgress = await this.prisma.progress.findFirst({
        where: { userId, courseId, topicId: null, materialId: null },
      });

      if (existingProgress) {
        this.logger.warn(
          `User ${userId} already enrolled in course ${courseId}`,
        );
        return;
      }

      await this.prisma.progress.create({
        data: {
          userId,
          topicId: null as any,
          materialId: null as any,
          unitId: null as any,
          courseId,
          progressPercentage: 0,
          timeSpent: 0,
          status: ProgressStatus.notStarted,
          lastAccessedAt: new Date(),
        },
      });

      this.eventEmitter.emit('course.enrolled', {
        userId,
        courseId,
        enrollmentData: { timestamp: new Date() },
      });

      this.logger.log(
        `User ${userId} successfully enrolled in course ${courseId}`,
      );
    } catch (error) {
      this.logger.error(
        `Error enrolling user ${userId} in course ${courseId}`,
        {
          error: getErrorMessage(error),
          stack: getErrorStack(error),
        },
      );
      throw error;
    }
  }

  async enrollInLearningPath(userId: string, pathId: string): Promise<void> {
    try {
      await this.validateLearningPathAvailability(pathId);

      const prerequisiteCheck = this.checkPrerequisites(
        userId,
        pathId,
        'LEARNING_PATH',
      );
      if (!prerequisiteCheck.satisfied) {
        throw new BadRequestException(
          `Prerequisites not satisfied. Missing: ${prerequisiteCheck.missingPrerequisites
            ?.map((p) => p.title)
            .join(', ')}`,
        );
      }

      const existingProgress =
        await this.prisma.learningPathProgress.findUnique({
          where: { userId_learningPathId: { userId, learningPathId: pathId } },
        });

      if (existingProgress) {
        this.logger.warn(
          `User ${userId} already enrolled in learning path ${pathId}`,
        );
        return;
      }

      await this.prisma.learningPathProgress.create({
        data: {
          userId,
          learningPathId: pathId,
          overallProgressPercentage: 0,
          totalTimeSpentMinutes: 0,
          status: ProgressStatus.notStarted,
          lastAccessedAt: new Date(),
          moduleProgress: {},
          phaseProgress: {},
          milestonesAchieved: [],
        },
      });

      this.eventEmitter.emit('learning-path.enrolled', {
        userId,
        pathId,
        enrollmentData: { timestamp: new Date() },
      });

      this.logger.log(
        `User ${userId} successfully enrolled in learning path ${pathId}`,
      );
    } catch (error) {
      this.logger.error(
        `Error enrolling user ${userId} in learning path ${pathId}`,
        {
          error: getErrorMessage(error),
          stack: getErrorStack(error),
        },
      );
      throw error;
    }
  }

  async updateProgress(
    userId: string,
    data: ProgressUpdateData,
  ): Promise<ProgressResponse> {
    const { courseId, learningPathId, progressData, completed } = data;
    const progress = progressData?.percentage ?? 0;

    if (progress < 0 || progress > 100) {
      throw new BadRequestException('Progress must be between 0 and 100');
    }

    try {
      let result: ProgressResponse | undefined;

      if (courseId) {
        const progressUpdateDto: ProgressUpdateDto = {
          courseId,
          unitId: data.unitId,
          materialId: data.materialId,
          topicId: data.topicId,
          status: data.status,
          progressPercentage: progress,
          timeSpent: progressData.timeSpent || 0,
        };

        const courseProgress =
          await this.progressService.updateUnitMaterialTopicProgress(
            userId,
            progressUpdateDto,
          );

        if (courseProgress) {
          result = {
            type: 'course',
            currentValue: courseProgress.progressPercentage,
            targetValue: 100,
            percentageComplete: courseProgress.progressPercentage,
            data: courseProgress,
          };
        }

        this.eventEmitter.emit('course.progress.updated', {
          userId,
          courseId,
          progressData: data,
        });

        this.eventEmitter.emit('learning-path.progress.updated', {
          userId,
          learningPathId,
          progressData: data,
        });
      } else if (learningPathId) {
        result = await this.updateLearningPathProgress(
          userId,
          learningPathId,
          data,
        );
      } else {
        throw new BadRequestException(
          'Either courseId or learningPathId must be provided',
        );
      }

      if (completed || progress === 100) {
        if (courseId) {
          this.eventEmitter.emit('course.completed', {
            userId,
            courseId,
            completionData: data,
          });
        } else if (learningPathId) {
          this.eventEmitter.emit('learning-path.completed', {
            userId,
            learningPathId,
            completionData: data,
          });
        }
      }

      return result!;
    } catch (error) {
      this.logger.error(`Error updating progress for user ${userId}`, {
        error: getErrorMessage(error),
        courseId,
        learningPathId,
        stack: getErrorStack(error),
      });
      throw error;
    }
  }

  async getUserLearningStatus(userId: string): Promise<UserLearningStatus> {
    try {
      const [courseProgress, pathProgress] = await Promise.all([
        this.getCourseProgressForUser(userId),
        this.getLearningPathProgressForUser(userId),
      ]);

      return {
        userId,
        courses: courseProgress,
        learningPaths: pathProgress,
        lastUpdated: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`Error getting learning status for user ${userId}`, {
        error: getErrorMessage(error),
        stack: getErrorStack(error),
      });
      throw error;
    }
  }

  async getRecommendedNextSteps(
    userId: string,
    limit: number = 5,
  ): Promise<LearningRecommendation[]> {
    try {
      const status = await this.getUserLearningStatus(userId);
      const recommendations: LearningRecommendation[] = [];

      const inProgressCourses = status.courses
        .filter(
          (course) =>
            course.status === ProgressStatus.inProgress &&
            course.progress < 100,
        )
        .map((course: UserCourseProgress) => ({
          type: 'course' as const,
          id: course.courseId,
          title: course.title || '',
          action: 'Continue course',
          progress: course.progress,
          priority: this.calculateCoursePriority(course),
          reason: `${Math.round(100 - course.progress)}% remaining`,
        }));

      recommendations.push(...inProgressCourses);

      const inProgressPaths = status.learningPaths
        .filter(
          (path) =>
            path.status === ProgressStatus.inProgress && path.progress < 100,
        )
        .map((path: UserLearningPathProgress) => ({
          type: 'learningPath' as const,
          id: path.pathId,
          title: path.title || '',
          action: 'Continue learning path',
          progress: path.progress,
          priority: this.calculatePathPriority(path),
          reason: `${Math.round(100 - path.progress)}% remaining`,
        }));

      recommendations.push(...inProgressPaths);

      return recommendations
        .sort((a, b) => (b.priority || 0) - (a.priority || 0))
        .slice(0, limit);
    } catch (error) {
      this.logger.error(
        `Error getting recommended next steps for user ${userId}`,
        {
          error: getErrorMessage(error),
          stack: getErrorStack(error),
        },
      );
      throw error;
    }
  }

  private async validateCourseAvailability(
    courseId: string,
  ): Promise<ValidatedCourse> {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: {
        id: true,
        name: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!course) {
      throw new NotFoundException('Course not found');
    }

    if (course.status !== 'published') {
      throw new BadRequestException('Course is not available for enrollment');
    }

    return course;
  }

  private async validateLearningPathAvailability(
    pathId: string,
  ): Promise<ValidatedLearningPath> {
    const path = await this.prisma.learningPath.findUnique({
      where: { id: pathId },
      select: {
        id: true,
        title: true,
        difficulty: true,
        estimatedHours: true,
        estimatedDurationWeeks: true,
      },
    });

    if (!path) {
      throw new NotFoundException('Learning path not found');
    }

    return path;
  }

  private async updateLearningPathProgress(
    userId: string,
    learningPathId: string,
    data: ProgressUpdateData,
  ): Promise<ProgressResponse> {
    const pathProgress = await this.prisma.learningPathProgress.upsert({
      where: { userId_learningPathId: { userId, learningPathId } },
      update: {
        overallProgressPercentage: data.progressData.percentage,
        totalTimeSpentMinutes: data.progressData.timeSpent
          ? { increment: data.progressData.timeSpent }
          : undefined,
        lastAccessedAt: new Date(),
        completedAt: data.completed
          ? data.completedAt || new Date()
          : undefined,
        status:
          data.status ||
          (data.progressData.percentage === 100
            ? ProgressStatus.completed
            : ProgressStatus.inProgress),
      },
      create: {
        userId,
        learningPathId,
        overallProgressPercentage: data.progressData.percentage,
        totalTimeSpentMinutes: data.progressData.timeSpent || 0,
        completedAt: data.completed
          ? data.completedAt || new Date()
          : undefined,
        status:
          data.status ||
          (data.progressData.percentage === 100
            ? ProgressStatus.completed
            : ProgressStatus.inProgress),
        lastAccessedAt: new Date(),
        moduleProgress: {},
        phaseProgress: {},
        milestonesAchieved: [],
      },
      include: {
        learningPath: {
          select: {
            title: true,
            estimatedDurationWeeks: true,
          },
        },
      },
    });

    return {
      type: 'learningPath',
      currentValue: pathProgress.overallProgressPercentage || 0,
      targetValue: 100,
      percentageComplete: pathProgress.overallProgressPercentage || 0,
      data: pathProgress,
    };
  }

  private async getCourseProgressForUser(
    userId: string,
  ): Promise<UserCourseProgress[]> {
    const courseProgress = await this.prisma.progress.findMany({
      where: {
        userId,
        courseId: { not: null },
        materialId: null,
        topicId: null,
      },
      include: {
        course: {
          select: {
            name: true,
            description: true,
            difficulty: true,
          },
        },
      },
      orderBy: { lastAccessedAt: 'desc' },
    });

    return courseProgress.map((p: any) => ({
      courseId: p.courseId!,
      title: p.course?.name || undefined,
      description: p.course?.description,
      difficulty: p.course?.difficulty || undefined,
      progress: p.progressPercentage,
      status: p.status,
      timeSpent: p.timeSpent,
      completedAt: p.completedAt,
      lastAccessedAt: p.lastAccessedAt,
    }));
  }

  private async getLearningPathProgressForUser(
    userId: string,
  ): Promise<UserLearningPathProgress[]> {
    const pathProgress = await this.prisma.learningPathProgress.findMany({
      where: { userId },
      include: {
        learningPath: {
          select: {
            title: true,
            description: true,
            difficulty: true,
            estimatedDurationWeeks: true,
          },
        },
      },
      orderBy: { lastAccessedAt: 'desc' },
    });

    return pathProgress.map((p) => ({
      pathId: p.learningPathId,
      title: p.learningPath?.title || undefined,
      description: p.learningPath?.description,
      difficulty: p.learningPath?.difficulty || undefined,
      progress: p.overallProgressPercentage,
      status: p.status,
      timeSpent: p.totalTimeSpentMinutes,
      completedAt: p.completedAt,
      lastAccessedAt: p.lastAccessedAt,
      estimatedDuration: p.learningPath?.estimatedDurationWeeks,
      streakDays: p.streakDays,
      milestonesAchieved: p.milestonesAchieved,
    }));
  }

  private calculateCoursePriority(course: UserCourseProgress): number {
    let priority = 50;

    priority += course.progress * 0.3;

    const daysSinceAccess = Math.floor(
      (Date.now() - new Date(course.lastAccessedAt).getTime()) /
        (1000 * 60 * 60 * 24),
    );
    priority += Math.max(0, 10 - daysSinceAccess);

    return Math.round(priority);
  }

  private calculatePathPriority(path: UserLearningPathProgress): number {
    let priority = 60;

    priority += path.progress * 0.4;
    priority += Math.min(path.streakDays || 0, 20);

    const daysSinceAccess = path.lastAccessedAt
      ? Math.floor(
          (Date.now() - new Date(path.lastAccessedAt).getTime()) /
            (1000 * 60 * 60 * 24),
        )
      : 0;
    priority += Math.max(0, 15 - daysSinceAccess);

    return Math.round(priority);
  }

  protected checkPrerequisites(
    _userId: string,
    itemId: string,
    type: 'COURSE' | 'LEARNING_PATH',
  ): PrerequisiteCheck {
    try {
      // Placeholder implementation - prerequisites not yet in schema
      const result: PrerequisiteCheck = {
        satisfied: true,
        missingPrerequisites: [],
        completedPrerequisites: [],
      };
      return result;
    } catch (error) {
      this.logger.error(`Error checking prerequisites for ${type} ${itemId}`, {
        error: getErrorMessage(error),
        stack: getErrorStack(error),
      });
      throw error;
    }
  }

  /**
   * Get user's learning analytics including study patterns, engagement metrics
   * Delegates to learning-analytics service for gRPC-based insights
   */
  async getLearningAnalytics(userId: string) {
    if (!userId) {
      throw new BadRequestException('User ID is required');
    }

    try {
      // Get user engagement metrics from analytics service
      const engagement =
        await this.learningAnalyticsService.getUserEngagement(userId);

      // Get study pattern analysis
      const studyPatterns =
        await this.learningAnalyticsService.analyzeStudyPatterns(userId);

      return {
        userId,
        engagement,
        studyPatterns,
        generatedAt: new Date(),
      };
    } catch (error) {
      this.logger.warn(`Error fetching analytics for user ${userId}:`, error);
      // Return graceful empty engagement data
      return {
        userId,
        engagement: {
          userId,
          totalStudyTime: 0,
          totalSessions: 0,
          lastActive: null,
          engagementScore: 0,
          averageSessionDuration: 0,
        },
        studyPatterns: {
          userId,
          peakStudyHours: [],
          averageSessionDuration: 0,
          consistencyScore: 0,
        },
        generatedAt: new Date(),
      };
    }
  }

  /**
   * Get predictions for user success in courses/paths
   * Uses learning-analytics service for ML-based predictions
   */
  async getPredictions(userId: string, features?: number[]) {
    if (!userId) {
      throw new BadRequestException('User ID is required');
    }

    try {
      // Extract learning history features if not provided
      let extractedFeatures = features || [];
      if (!extractedFeatures.length) {
        // Get default feature extraction with stub data if not provided
        extractedFeatures =
          await this.learningAnalyticsService.extractPredictionFeatures(
            userId,
            [],
            0,
            0.5,
          );
      }

      // Get success rate prediction from analytics
      const prediction = await this.learningAnalyticsService.predictSuccessRate(
        userId,
        extractedFeatures,
      );

      return {
        userId,
        prediction,
        generatedAt: new Date(),
      };
    } catch (error) {
      this.logger.warn(`Error getting predictions for user ${userId}:`, error);
      // Return graceful default prediction
      return {
        userId,
        prediction: {
          userId,
          probability: 0.5,
          confidence: 0.0,
          factors: [],
        },
        generatedAt: new Date(),
      };
    }
  }

  /**
   * Get study focus recommendations
   * Delegates to study-analytics service for material-specific insights
   */
  async getStudyFocusRecommendations(userId: string) {
    if (!userId) {
      throw new BadRequestException('User ID is required');
    }

    try {
      const focusRecs =
        await this.studyAnalyticsService.getFocusRecommendations(userId);
      const dueCards = await this.studyAnalyticsService.getDueCards(userId);

      return {
        userId,
        focusRecommendations: focusRecs,
        dueReviewCards: dueCards,
        generatedAt: new Date(),
      };
    } catch (error) {
      this.logger.warn(`Error getting study focus for user ${userId}:`, error);
      return {
        userId,
        focusRecommendations: [],
        dueReviewCards: [],
        generatedAt: new Date(),
      };
    }
  }
}
