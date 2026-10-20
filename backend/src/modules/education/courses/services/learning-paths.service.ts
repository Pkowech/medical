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
  PathModuleType,
} from '@prisma/client';
import { PathStructure } from '../../../../common/dto/learning.dto';
import { LearningAnalyticsService } from '../../../ai-analytics/services/learning-analytics.service';
import { LearningPathProgressService } from './learning-path-progress.service';

@Injectable()
export class LearningPathsService {
  private readonly logger = new Logger(LearningPathsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly learningAnalyticsService: LearningAnalyticsService,
    private readonly learningPathProgressService: LearningPathProgressService,
  ) {}

  async create(
    createDto: CreateLearningPathDto,
    userId: string,
  ): Promise<LearningPath> {
    await this.validateUser(userId);
    this.validatePathStructure(createDto.pathStructure);

    try {
      const learningPath = await this.prisma.$transaction(async (tx) => {
        const path = await tx.learningPath.create({
          data: {
            title: createDto.title,
            description: createDto.description,
            categoryId: createDto.category,
            difficulty: createDto.difficulty as CourseDifficulty,
            estimatedDurationWeeks: createDto.estimatedDurationWeeks,
            estimatedHoursPerWeek: createDto.estimatedHoursPerWeek,
            createdBy: userId,
            status: LearningPathStatus.draft,
          },
          include: {
            milestones: true,
          },
        });

        await this.syncRelationalPhases(tx, path.id, createDto.pathStructure);
        return path;
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
          phases: {
            orderBy: { order: 'asc' },
            include: {
              modules: {
                orderBy: { order: 'asc' },
                include: {
                  course: {
                    select: {
                      id: true,
                      title: true,
                      code: true,
                    },
                  },
                },
              },
            },
          },
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

  async findByCourseId(courseId: string): Promise<LearningPath[]> {
    return this.findAll({ courseId, status: LearningPathStatus.published });
  }

  async findOne(id: string, userId?: string): Promise<LearningPath> {
    try {
      const learningPath = await this.prisma.learningPath.findUnique({
        where: { id },
        include: {
          phases: {
            orderBy: { order: 'asc' },
            include: {
              modules: {
                orderBy: { order: 'asc' },
                include: {
                  course: {
                    select: {
                      id: true,
                      title: true,
                      code: true,
                      difficulty: true,
                    },
                  },
                  quiz: {
                    select: {
                      id: true,
                      title: true,
                    },
                  },
                },
              },
            },
          },
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

      const formattedPhases = (learningPath.phases || []).map((p) => ({
        id: p.id,
        title: p.title,
        description: p.description,
        order: p.order,
        estimatedWeeks: p.estimatedWeeks,
        modules: p.modules.map((m) => ({
          id: m.id,
          title: m.title,
          description: m.description,
          type: m.type,
          resourceId: m.resourceId || m.courseId || m.quizId,
          order: m.order,
          isRequired: m.isRequired,
          unlockConditions: m.unlockConditions,
        })),
      }));

      (learningPath as any).phases = formattedPhases;
      (learningPath as any).pathStructure = { phases: formattedPhases };

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
      const updatedPath = await this.prisma.$transaction(async (tx) => {
        const path = await tx.learningPath.update({
          where: { id },
          data: {
            title: updateDto.title,
            description: updateDto.description,
            updatedAt: new Date(),
          },
          include: {
            milestones: true,
          },
        });

        if (updateDto.pathStructure) {
          await this.syncRelationalPhases(tx, path.id, updateDto.pathStructure);
        }

        return path;
      });

      this.eventEmitter.emit('learning-path.updated', {
        learningPathId: id,
        userId,
        data: updatedPath,
        changes: updateDto,
      });

      return updatedPath;
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new BadRequestException(
        `Failed to update learning path: ${getErrorMessage(error)}`,
      );
    }
  }

  private async syncRelationalPhases(
    tx: Prisma.TransactionClient,
    pathId: string,
    pathStructure: PathStructure,
  ): Promise<void> {
    if (!pathStructure?.phases || !Array.isArray(pathStructure.phases)) return;

    await tx.learningPathPhase.deleteMany({
      where: { learningPathId: pathId },
    });

    for (let pIdx = 0; pIdx < pathStructure.phases.length; pIdx++) {
      const phase = pathStructure.phases[pIdx];
      const phaseAny = phase as any;
      const createdPhase = await tx.learningPathPhase.create({
        data: {
          learningPathId: pathId,
          title: phase.title,
          description: phase.description,
          order: phase.order ?? pIdx + 1,
          estimatedWeeks: phaseAny.estimatedWeeks ?? phaseAny.estimatedDurationWeeks,
        },
      });

      for (let mIdx = 0; mIdx < (phase.modules || []).length; mIdx++) {
        const mod = phase.modules[mIdx];
        const modAny = mod as any;
        let courseId: string | null = null;
        let quizId: string | null = null;
        const targetResourceId = mod.resourceId || mod.id;

        if (mod.type === 'course' && targetResourceId) {
          const course = await tx.course.findUnique({
            where: { id: targetResourceId },
            select: { id: true },
          });
          if (course) courseId = course.id;
        } else if (mod.type === 'assessment' && targetResourceId) {
          const quiz = await tx.quiz.findUnique({
            where: { id: targetResourceId },
            select: { id: true },
          });
          if (quiz) quizId = quiz.id;
        }

        const validTypes = [
          'course',
          'assessment',
          'clinical_case',
          'milestone',
          'resource',
        ];
        const modType: PathModuleType = validTypes.includes(mod.type)
          ? (mod.type as PathModuleType)
          : PathModuleType.course;

        await tx.learningPathModule.create({
          data: {
            phaseId: createdPhase.id,
            title: mod.title,
            description: mod.description,
            type: modType,
            resourceId: targetResourceId,
            courseId,
            quizId,
            order: mod.order ?? mIdx + 1,
            estimatedMinutes:
              mod.estimatedMinutes ??
              (modAny.estimatedHours ? modAny.estimatedHours * 60 : 60),
            isRequired: mod.required ?? modAny.isRequired ?? true,
            unlockConditions: modAny.unlockConditions || [],
          },
        });
      }
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
      pathStructure: (customizations?.pathStructure || (originalPath as any).pathStructure || {
        phases: (originalPath as any).phases || [],
      }) as any,
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

      await this.learningPathProgressService.startLearningPath(userId, {
        learningPathId: pathId,
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

    await this.validatePathForPublishing(learningPath);

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

  private async validatePathForPublishing(
    learningPath: LearningPath,
  ): Promise<void> {
    const errors: string[] = [];

    if (!learningPath.title?.trim()) {
      errors.push('Title is required');
    }

    if (!learningPath.description?.trim()) {
      errors.push('Description is required');
    }

    const phases =
      (learningPath as any).phases ||
      (learningPath as any).pathStructure?.phases ||
      [];

    if (!phases.length) {
      errors.push('At least one phase is required');
    } else {
      const courseIds: string[] = [];
      for (const phase of phases) {
        for (const module of phase.modules || []) {
          if (module.type === 'course' && (module.resourceId || module.courseId)) {
            courseIds.push(module.resourceId || module.courseId);
          }
        }
      }

      if (courseIds.length > 0) {
        const existingCourses = await this.prisma.course.findMany({
          where: { id: { in: courseIds } },
          select: { id: true },
        });
        const existingIds = new Set(existingCourses.map((c) => c.id));
        const missingCourseIds = courseIds.filter(
          (cid) => !existingIds.has(cid),
        );
        if (missingCourseIds.length > 0) {
          errors.push(
            `Referenced course(s) not found in catalog: ${missingCourseIds.join(', ')}`,
          );
        }
      }
    }

    if (errors.length > 0) {
      throw new BadRequestException(
        `Cannot publish learning path: ${errors.join(', ')}`,
      );
    }

    const hasModules =
      phases.some(
        (phase: any) => phase.modules && phase.modules.length > 0,
      );

    if (!hasModules) {
      throw new BadRequestException('At least one phase must contain modules');
    }
  }

  async checkPathIntegrity(id: string): Promise<{
    pathId: string;
    title: string;
    isValid: boolean;
    totalPhases: number;
    totalModules: number;
    courseModules: number;
    missingCourses: string[];
  }> {
    const learningPath = await this.prisma.learningPath.findUnique({
      where: { id },
      include: {
        phases: {
          include: {
            modules: {
              include: { course: true },
            },
          },
        },
      },
    });

    if (!learningPath) {
      throw new NotFoundException('Learning path not found');
    }

    const totalPhases = learningPath.phases?.length || 0;
    let totalModules = 0;
    let courseModules = 0;
    const missingCourses: string[] = [];

    for (const phase of learningPath.phases || []) {
      for (const mod of phase.modules || []) {
        totalModules += 1;
        if (mod.type === 'course') {
          courseModules += 1;
          if (!mod.courseId || !mod.course) {
            missingCourses.push(mod.resourceId || mod.id);
          }
        }
      }
    }

    return {
      pathId: id,
      title: learningPath.title,
      isValid: missingCourses.length === 0,
      totalPhases,
      totalModules,
      courseModules,
      missingCourses,
    };
  }

  private buildWhereClause(
    filters: LearningPathFiltersDto,
  ): Prisma.LearningPathWhereInput {
    const where: Prisma.LearningPathWhereInput = {};

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.type) {
      where.pathType = filters.type;
    }

    if (filters.difficulty) {
      where.difficulty = filters.difficulty as CourseDifficulty;
    }

    if (filters.specialization) {
      where.specialization = {
        contains: filters.specialization,
        mode: 'insensitive',
      };
    }

    if (filters.category) {
      where.categoryId = filters.category;
    }

    if (filters.courseId) {
      where.phases = {
        some: {
          modules: {
            some: {
              courseId: filters.courseId,
            },
          },
        },
      };
    }

    if (filters.healthcareField) {
      where.OR = [
        ...(where.OR || []),
        { categoryId: { contains: filters.healthcareField, mode: 'insensitive' } },
        { specialization: { contains: filters.healthcareField, mode: 'insensitive' } },
      ];
    }

    if (filters.search) {
      const searchConditions: Prisma.LearningPathWhereInput[] = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
        { specialization: { contains: filters.search, mode: 'insensitive' } },
      ];
      where.OR = where.OR ? [...(where.OR as Prisma.LearningPathWhereInput[]), ...searchConditions] : searchConditions;
    }

    if (filters.createdById) {
      where.createdBy = filters.createdById;
    }

    return where;
  }

  /**
   * Get personalized learning path recommendations for a user
   * Uses learning-analytics service for gRPC-based recommendations,
   * with cohort-aware fallback based on user's healthcare profile
   */
  async getRecommendedPaths(
    userId: string,
    limit: number = 5,
  ): Promise<LearningPath[]> {
    let userProfile: { healthcareField: string | null; specialization: string | null } | null = null;
    try {
      userProfile = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { healthcareField: true, specialization: true },
      });

      // Get path recommendations from analytics service
      const recommendations =
        await this.learningAnalyticsService.getPathRecommendations(
          userId,
          limit,
        );

      // Map recommendation IDs to actual learning paths
      const pathIds = recommendations.map((rec) => rec.pathId);

      if (pathIds.length === 0) {
        // Fallback to cohort-prioritized trending paths
        return this.getCohortOrTrendingPaths(userProfile, limit);
      }

      const paths = await this.prisma.learningPath.findMany({
        where: {
          id: { in: pathIds },
          status: 'published',
        },
        include: {
          _count: { select: { progress: true } },
        },
        take: limit,
      });

      if (paths.length === 0) {
        return this.getCohortOrTrendingPaths(userProfile, limit);
      }

      return paths;
    } catch (error) {
      this.logger.warn(
        `Error getting recommended paths for user ${userId}:`,
        error,
      );
      return this.getCohortOrTrendingPaths(userProfile, limit);
    }
  }

  /**
   * Fallback for recommendations: prioritize published paths matching the user's
   * healthcare field or specialization before defaulting to global trending paths.
   */
  async getCohortOrTrendingPaths(
    user: { healthcareField?: string | null; specialization?: string | null } | null,
    limit: number = 5,
  ): Promise<LearningPath[]> {
    try {
      const cohortConditions: Prisma.LearningPathWhereInput[] = [];

      if (user?.specialization) {
        cohortConditions.push({
          specialization: { contains: user.specialization, mode: 'insensitive' },
        });
      }

      if (user?.healthcareField) {
        cohortConditions.push({
          categoryId: { contains: user.healthcareField, mode: 'insensitive' },
        });
        cohortConditions.push({
          specialization: { contains: user.healthcareField, mode: 'insensitive' },
        });
      }

      if (cohortConditions.length > 0) {
        const cohortPaths = await this.prisma.learningPath.findMany({
          where: {
            status: 'published',
            OR: cohortConditions,
          },
          include: { _count: { select: { progress: true } } },
          orderBy: { createdAt: 'desc' },
          take: limit,
        });

        if (cohortPaths.length > 0) {
          return cohortPaths;
        }
      }
    } catch (err) {
      this.logger.warn('Error fetching cohort-specific paths fallback:', err);
    }

    return this.getTrendingPaths(limit);
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
