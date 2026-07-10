// src/modules/learning/services/learning-paths.service.ts
import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  CreateLearningPathDto,
  UpdateLearningPathDto,
  LearningPathFiltersDto,
} from '../../../../common/dto/learning-paths.dto';
import { getErrorMessage } from '#common/utils/error.utils';
import {
  LearningPath,
  Prisma,
  CourseDifficulty,
  LearningPathStatus,
  LearningPathCategory,
  ProgressStatus,
} from '@prisma/client';
import { PathStructure } from '../../../../common/dto/learning.dto';
import { LearningAnalyticsService } from '../../../ai-analytics/services/learning-analytics.service';

@Injectable()
export class LearningPathsService {
  private readonly logger = new Logger(LearningPathsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly learningAnalyticsService: LearningAnalyticsService,
  ) {}

  async create(
    createDto: CreateLearningPathDto,
    userId: string,
  ): Promise<LearningPath> {
    await this.validateUser(userId);
    this.validatePathStructure(createDto.pathStructure);

    try {
      const learningPath = await this.prisma.learningPath.create({
        data: {
          title: createDto.title,
          description: createDto.description,
          categoryId: createDto.category,
          difficulty: createDto.difficulty as CourseDifficulty,
          estimatedDurationWeeks: createDto.estimatedDurationWeeks,
          estimatedHoursPerWeek: createDto.estimatedHoursPerWeek,
          pathStructure:
            createDto.pathStructure as unknown as Prisma.JsonObject,
          createdBy: userId,
          status: LearningPathStatus.draft,
        },
        include: {
          milestones: true,
        },
      });

      this.eventEmitter.emit('learning-path.created', {
        learningPathId: learningPath.id,
        userId,
        data: learningPath,
      });

      return learningPath;
    } catch (error) {
      throw new BadRequestException(
        `Failed to create learning path: ${getErrorMessage(error)}`,
      );
    }
  }

  async findAll(filters: LearningPathFiltersDto = {}): Promise<LearningPath[]> {
    const whereClause = this.buildWhereClause(filters);

    try {
      return await this.prisma.learningPath.findMany({
        where: whereClause,
        include: {
          _count: {
            select: {
              progress: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    } catch (error) {
      throw new BadRequestException(
        `Failed to retrieve learning paths: ${getErrorMessage(error)}`,
      );
    }
  }

  async findOne(id: string, userId?: string): Promise<LearningPath> {
    try {
      const learningPath = await this.prisma.learningPath.findUnique({
        where: { id },
        include: {
          progress: userId ? { where: { userId } } : false,
          milestones: {
            orderBy: { order: 'asc' },
          },
          _count: {
            select: {
              progress: true,
            },
          },
        },
      });

      if (!learningPath) {
        throw new NotFoundException('Learning path not found');
      }

      return learningPath;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(
        `Failed to retrieve learning path: ${getErrorMessage(error)}`,
      );
    }
  }

  async update(
    id: string,
    updateDto: UpdateLearningPathDto,
    userId: string,
  ): Promise<LearningPath> {
    const learningPath = await this.findOne(id);

    if (learningPath.createdBy !== userId) {
      throw new ForbiddenException(
        'You do not have permission to update this learning path',
      );
    }

    if (updateDto.pathStructure) {
      this.validatePathStructure(updateDto.pathStructure);
    }

    try {
      const updatedPath = await this.prisma.learningPath.update({
        where: { id },
        data: {
          title: updateDto.title,
          description: updateDto.description,
          pathStructure:
            updateDto.pathStructure as unknown as Prisma.JsonObject,
          updatedAt: new Date(),
        },
        include: {
          milestones: true,
        },
      });

      this.eventEmitter.emit('learning-path.updated', {
        learningPathId: id,
        userId,
        data: updatedPath,
        changes: updateDto,
      });

      return updatedPath;
    } catch (error) {
      throw new BadRequestException(
        `Failed to update learning path: ${getErrorMessage(error)}`,
      );
    }
  }

  async remove(id: string, userId: string): Promise<void> {
    const learningPath = await this.findOne(id);

    if (learningPath.createdBy !== userId) {
      throw new ForbiddenException(
        'You do not have permission to delete this learning path',
      );
    }

    const activeEnrollments = await this.prisma.learningPathProgress.count({
      where: {
        learningPathId: id,
        status: { in: [ProgressStatus.notStarted, ProgressStatus.inProgress] },
      },
    });

    if (activeEnrollments > 0) {
      throw new BadRequestException(
        'Cannot delete learning path with active enrollments',
      );
    }

    try {
      await this.prisma.learningPath.delete({ where: { id } });

      this.eventEmitter.emit('learning-path.deleted', {
        learningPathId: id,
        userId,
        data: learningPath,
      });
    } catch (error) {
      throw new BadRequestException(
        `Failed to delete learning path: ${getErrorMessage(error)}`,
      );
    }
  }

  async duplicate(
    id: string,
    userId: string,
    customizations?: Partial<CreateLearningPathDto>,
  ): Promise<LearningPath> {
    const originalPath = await this.findOne(id);

    const duplicateData: CreateLearningPathDto = {
      title: customizations?.title || `${originalPath.title} (Copy)`,
      description:
        customizations?.description ?? originalPath.description ?? undefined,
      category: (customizations?.category ||
        originalPath.categoryId ||
        'medicine') as LearningPathCategory,
      difficulty: customizations?.difficulty || originalPath.difficulty,
      estimatedDurationWeeks:
        customizations?.estimatedDurationWeeks ??
        originalPath.estimatedDurationWeeks ??
        0,
      estimatedHoursPerWeek:
        customizations?.estimatedHoursPerWeek ??
        originalPath.estimatedHoursPerWeek ??
        0,
      pathStructure: (customizations?.pathStructure ||
        originalPath.pathStructure) as any,
    };

    return this.create(duplicateData, userId);
  }

  async enroll(userId: string, pathId: string): Promise<void> {
    try {
      const path = await this.prisma.learningPath.findUnique({
        where: { id: pathId },
        select: { id: true, status: true },
      });

      if (!path) {
        throw new NotFoundException('Learning path not found');
      }

      if (path.status !== LearningPathStatus.published) {
        throw new BadRequestException('Learning path is not available for enrollment');
      }

      const existingProgress = await this.prisma.learningPathProgress.findUnique({
        where: { userId_learningPathId: { userId, learningPathId: pathId } },
      });

      if (existingProgress) {
        this.logger.warn(`User ${userId} already enrolled in learning path ${pathId}`);
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

      this.logger.log(`User ${userId} successfully enrolled in learning path ${pathId}`);
    } catch (error) {
      this.logger.error(`Error enrolling user ${userId} in learning path ${pathId}`, {
        error: getErrorMessage(error),
      });
      throw error;
    }
  }

  async getByCategory(category: string): Promise<LearningPath[]> {
    try {
      return await this.prisma.learningPath.findMany({
        where: {
          categoryId: category,
          status: LearningPathStatus.published,
        },
        include: {
          _count: {
            select: {
              progress: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    } catch (error) {
      throw new BadRequestException(
        `Failed to get paths by category: ${getErrorMessage(error)}`,
      );
    }
  }

  async publish(id: string, userId: string): Promise<LearningPath> {
    const learningPath = await this.findOne(id);

    if (learningPath.createdBy !== userId) {
      throw new ForbiddenException(
        'You do not have permission to publish this learning path',
      );
    }

    this.validatePathForPublishing(learningPath);

    try {
      const publishedPath = await this.prisma.learningPath.update({
        where: { id },
        data: {
          status: LearningPathStatus.published,
        },
      });

      this.eventEmitter.emit('learning-path.published', {
        learningPathId: id,
        userId,
        data: publishedPath,
      });

      return publishedPath;
    } catch (error) {
      throw new BadRequestException(
        `Failed to publish learning path: ${getErrorMessage(error)}`,
      );
    }
  }

  async unpublish(id: string, userId: string): Promise<LearningPath> {
    const learningPath = await this.findOne(id);

    if (learningPath.createdBy !== userId) {
      throw new ForbiddenException(
        'You do not have permission to unpublish this learning path',
      );
    }

    try {
      const unpublishedPath = await this.prisma.learningPath.update({
        where: { id },
        data: {
          status: LearningPathStatus.draft,
        },
      });

      this.eventEmitter.emit('learning-path.unpublished', {
        learningPathId: id,
        userId,
        data: unpublishedPath,
      });

      return unpublishedPath;
    } catch (error) {
      throw new BadRequestException(
        `Failed to unpublish learning path: ${getErrorMessage(error)}`,
      );
    }
  }

  private async validateUser(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
  }

  private validatePathStructure(pathStructure: PathStructure): void {
    if (
      !pathStructure ||
      !pathStructure.phases ||
      !Array.isArray(pathStructure.phases)
    ) {
      throw new BadRequestException(
        'Invalid path structure: phases array is required',
      );
    }

    for (const phase of pathStructure.phases) {
      if (!phase.id || !phase.title || !Array.isArray(phase.modules)) {
        throw new BadRequestException(
          'Invalid phase structure: id, title, and modules array are required',
        );
      }

      for (const module of phase.modules) {
        if (!module.id || !module.type || !module.resourceId) {
          throw new BadRequestException(
            'Invalid module structure: id, type, and resourceId are required',
          );
        }

        const validModuleTypes = [
          'course',
          'assessment',
          'clinical_case',
          'resource',
          'milestone',
        ];
        if (!validModuleTypes.includes(module.type)) {
          throw new BadRequestException(
            `Invalid module type: ${module.type}. Must be one of: ${validModuleTypes.join(
              ', ',
            )}`,
          );
        }
      }
    }
  }

  private validatePathForPublishing(learningPath: LearningPath): void {
    const errors: string[] = [];

    if (!learningPath.title?.trim()) {
      errors.push('Title is required');
    }

    if (!learningPath.description?.trim()) {
      errors.push('Description is required');
    }

    const pathStructure =
      learningPath.pathStructure as unknown as PathStructure;

    if (!pathStructure?.phases?.length) {
      errors.push('At least one phase is required');
    }

    if (errors.length > 0) {
      throw new BadRequestException(
        `Cannot publish learning path: ${errors.join(', ')}`,
      );
    }

    const hasModules =
      pathStructure.phases?.some(
        (phase) => phase.modules && phase.modules.length > 0,
      ) ?? false;

    if (!hasModules) {
      throw new BadRequestException('At least one phase must contain modules');
    }
  }

  private buildWhereClause(
    filters: LearningPathFiltersDto,
  ): Prisma.LearningPathWhereInput {
    const where: Prisma.LearningPathWhereInput = {};

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.type) {
      // where.type = filters.type; // type is not in the model
    }

    if (filters.category) {
      where.categoryId = filters.category;
    }

    if (filters.search) {
      where.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    if (filters.createdById) {
      where.createdBy = filters.createdById;
    }

    return where;
  }

  /**
   * Get personalized learning path recommendations for a user
   * Uses learning-analytics service for gRPC-based recommendations
   */
  async getRecommendedPaths(
    userId: string,
    limit: number = 5,
  ): Promise<LearningPath[]> {
    try {
      // Get path recommendations from analytics service
      const recommendations =
        await this.learningAnalyticsService.getPathRecommendations(
          userId,
          limit,
        );

      // Map recommendation IDs to actual learning paths
      const pathIds = recommendations.map((rec) => rec.pathId);

      if (pathIds.length === 0) {
        // Fallback to trending paths
        return this.getTrendingPaths(limit);
      }

      return await this.prisma.learningPath.findMany({
        where: {
          id: { in: pathIds },
          status: 'published',
        },
        include: {
          _count: { select: { progress: true } },
        },
        take: limit,
      });
    } catch (error) {
      this.logger.warn(
        `Error getting recommended paths for user ${userId}:`,
        error,
      );
      // Graceful fallback to trending published paths
      return this.getTrendingPaths(limit);
    }
  }

  /**
   * Get trending learning paths across the system
   * Uses learning-analytics service for system-wide insights
   */
  async getTrendingPaths(limit: number = 5): Promise<LearningPath[]> {
    try {
      // Get trending paths from analytics service (system-wide)
      const trendingInfo =
        await this.learningAnalyticsService.getTrendingPaths(limit);

      if (trendingInfo.length === 0) {
        // Fallback to recently published paths
        return await this.prisma.learningPath.findMany({
          where: { status: 'published' },
          include: { _count: { select: { progress: true } } },
          orderBy: { createdAt: 'desc' },
          take: limit,
        });
      }

      const pathIds = trendingInfo.map((t) => t.path_id);
      return await this.prisma.learningPath.findMany({
        where: {
          id: { in: pathIds },
          status: 'published',
        },
        include: { _count: { select: { progress: true } } },
        take: limit,
      });
    } catch (error) {
      this.logger.warn('Error getting trending paths:', error);
      // Graceful fallback to recently published paths
      return await this.prisma.learningPath.findMany({
        where: { status: 'published' },
        include: { _count: { select: { progress: true } } },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });
    }
  }

  /**
   * Get collaborative/peer-based path recommendations
   * Uses learning-analytics service for similar user patterns
   */
  async getCollaborativePaths(
    userId: string,
    limit: number = 5,
  ): Promise<LearningPath[]> {
    try {
      // Get collaborative recommendations from analytics
      const collaborativeRecs =
        await this.learningAnalyticsService.getCollaborativeRecommendations(
          userId,
          limit,
        );

      if (collaborativeRecs.length === 0) {
        return [];
      }

      const pathIds = collaborativeRecs.map((rec) => rec.item_id);
      return await this.prisma.learningPath.findMany({
        where: {
          id: { in: pathIds },
          status: 'published',
        },
        include: { _count: { select: { progress: true } } },
        take: limit,
      });
    } catch (error) {
      this.logger.warn(
        `Error getting collaborative paths for user ${userId}:`,
        error,
      );
      return [];
    }
  }
}
