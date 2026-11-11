// src/modules/courses/services/units.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '#infrastructure/prisma/prisma.service';
import { RedisService } from '#infrastructure/redis/redis.service';
import { ProgressService } from './progress.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Unit, Prisma, ProgressStatus } from '@prisma/client';
import {
  CreateUnitDto,
  UpdateUnitDto,
  UnitResponseDto,
} from '../../../../common/dto/unit.dto';
import { getErrorMessage } from '#common/utils/error.utils';
import { cacheKeys } from '../../../../common/constants/cache-keys';
import { UnitCompletedEvent } from '../events/unit-completed.event';
import { FtsUtils } from '#common/utils/fts.utils';

import { GlobalSearchSyncService } from '../../../../infrastructure/search/services/global-search-sync.service';
import { Role } from '#modules/auth/constants/role.constants';

@Injectable()
export class UnitsService {
  private readonly logger = new Logger(UnitsService.name);
  private readonly CACHE_TTL = 3600; // 1 hour

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly progressService: ProgressService,
    private readonly eventEmitter: EventEmitter2,
    private readonly searchSync: GlobalSearchSyncService,
  ) {}

  private async getRoleNames(userId: string): Promise<string[]> {
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId },
      include: { role: { select: { name: true } } },
    });
    return userRoles.map(({ role }) => role.name);
  }

  private async canManageUnit(
    courseOwnerId: string | null,
    courseId: string,
    userId: string,
  ): Promise<boolean> {
    const roles = await this.getRoleNames(userId);
    if (roles.includes(Role.admin)) return true;
    if (!roles.includes(Role.instructor)) return false;
    if (courseOwnerId === userId) return true;

    const assignment = await this.prisma.courseInstructor.findUnique({
      where: { courseId_userId: { courseId, userId } },
      select: { id: true },
    });
    return Boolean(assignment);
  }

  private async filterUnitMaterials(
    unit: any,
    userId: string | undefined,
    canManage: boolean,
  ): Promise<any> {
    const sanitizeCourse = (course: any) => {
      if (!course) return course;
      const { createdById: _createdById, ...visibleCourse } = course;
      return visibleCourse;
    };
    if (canManage) {
      return { ...unit, course: sanitizeCourse(unit.course) };
    }

    const materialCollections = [
      unit.materials ?? [],
      ...(unit.topics ?? []).map((topic: any) => topic.materials ?? []),
      ...(unit.course?.materials ? [unit.course.materials] : []),
    ];
    const materialIds = [
      ...new Set(
        materialCollections.flat().map((material: any) => material.id),
      ),
    ];
    if (!userId || materialIds.length === 0) {
      return {
        ...unit,
        course: sanitizeCourse(unit.course),
        materials: [],
        topics: (unit.topics ?? []).map((topic: any) => ({
          ...topic,
          materials: [],
        })),
        ...(unit.course?.materials ? { course: { ...unit.course, materials: [] } } : {}),
      };
    }

    const [enrollment, shares] = await Promise.all([
      this.prisma.courseEnrollment.findUnique({
        where: { userId_courseId: { userId, courseId: unit.courseId } },
        select: { status: true },
      }),
      this.prisma.materialShare.findMany({
        where: { userId, materialId: { in: materialIds } },
        select: { materialId: true },
      }),
    ]);
    const isEnrolled =
      enrollment?.status === 'active' || enrollment?.status === 'completed';
    const sharedMaterialIds = new Set(
      shares.map(({ materialId }) => materialId),
    );
    const canRead = (material: any) => {
      const metadata =
        material.metadata &&
        typeof material.metadata === 'object' &&
        !Array.isArray(material.metadata)
          ? material.metadata
          : {};
      return (
        material.userId === userId ||
        sharedMaterialIds.has(material.id) ||
        (isEnrolled && metadata.shareWithCourse !== false)
      );
    };
    const sanitize = (material: any) => {
      const { userId: _userId, metadata: _metadata, ...visibleMaterial } = material;
      return visibleMaterial;
    };
    let collectionIndex = 0;
    const materials = materialCollections[collectionIndex++]
      .filter(canRead)
      .map(sanitize);
    const topics = (unit.topics ?? []).map((topic: any) => ({
      ...topic,
      materials: materialCollections[collectionIndex++]
        .filter(canRead)
        .map(sanitize),
    }));
    const courseMaterials = unit.course?.materials
      ? materialCollections[collectionIndex].filter(canRead).map(sanitize)
      : undefined;
    return {
      ...unit,
      course: sanitizeCourse(unit.course),
      materials,
      topics,
      ...(courseMaterials
        ? { course: { ...unit.course, materials: courseMaterials } }
        : {}),
    };
  }

  async create(createUnitDto: CreateUnitDto, creatorId: string): Promise<Unit> {
    try {
      const course = await this.prisma.course.findUnique({
        where: { id: createUnitDto.courseId },
        select: { id: true, createdById: true },
      });
      if (!course) {
        throw new NotFoundException('Course not found');
      }
      if (!(await this.canManageUnit(course.createdById, course.id, creatorId))) {
        throw new ForbiddenException(
          'Only the course instructor or an admin can create units',
        );
      }

      const unit = await this.prisma.$transaction(async (prisma) => {
        let order = createUnitDto.order;
        if (!order) {
          const lastUnit = await prisma.unit.findFirst({
            where: { courseId: createUnitDto.courseId },
            orderBy: { order: 'desc' },
          });
          order = (lastUnit?.order || 0) + 1;
        }

        if (order) {
          const existingUnit = await prisma.unit.findFirst({
            where: {
              courseId: createUnitDto.courseId,
              order,
            },
          });

          if (existingUnit) {
            await prisma.unit.updateMany({
              where: {
                courseId: createUnitDto.courseId,
                order: { gte: order },
              },
              data: { order: { increment: 1 } },
            });
          }
        }

        const newUnit = await prisma.unit.create({
          data: {
            name: createUnitDto.name,
            title: createUnitDto.title,
            content: createUnitDto.content,
            description: createUnitDto.description,
            course: { connect: { id: createUnitDto.courseId } },
            order,
            estimatedDuration: createUnitDto.estimatedDuration || 30,
            learningObjectives: createUnitDto.learningObjectives,
            isPublished: createUnitDto.isPublished ?? false,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          include: {
            course: {
              select: {
                id: true,
                title: true,
                status: true,
                createdById: true,
              },
            },
            materials: {
              select: { id: true, title: true, type: true, fileId: true },
            },
          },
        });
        return newUnit;
      });

      await this.setCacheForUnit(unit);

      // Explicitly update FTS vector (replacing DB trigger)
      await FtsUtils.updateFtsVector(this.prisma, 'units', unit.id);

      // Sync to global search index
      await this.searchSync.syncEntity('unit', unit.id);

      this.logger.log('Unit created successfully', {
        courseId: createUnitDto.courseId,
        creatorId,
        unitId: unit.id,
      });
      return unit;
    } catch (error) {
      this.logger.error('Error creating unit', {
        courseId: createUnitDto.courseId,
        creatorId,
        error: getErrorMessage(error),
      });
      throw error;
    }
  }

  async findAll(
    courseId?: string,
    userId?: string,
  ): Promise<UnitResponseDto[]> {
    try {
      const where: Prisma.UnitWhereInput = courseId ? { courseId } : {};
      const roleNames = userId ? await this.getRoleNames(userId) : [];
      if (!roleNames.includes(Role.admin)) {
        const visibility: Prisma.UnitWhereInput[] = [
          {
            isPublished: true,
            course: { is: { status: 'published' } },
          },
        ];
        if (userId && roleNames.includes(Role.instructor)) {
          visibility.push(
            { course: { is: { createdById: userId } } },
            { course: { is: { instructors: { some: { userId } } } } },
          );
        }
        where.AND = [{ OR: visibility }];
      }

      const units = await this.prisma.unit.findMany({
        where,
        include: {
          course: {
            select: {
              id: true,
              title: true,
              status: true,
              createdById: true,
            },
          },
          materials: {
            select: {
              id: true,
              title: true,
              type: true,
              fileId: true,
              file: { select: { key: true } },
              userId: true,
              metadata: true,
            },
          },
          topics: {
            include: {
              materials: {
                select: {
                  id: true,
                  title: true,
                  type: true,
                  fileId: true,
                  userId: true,
                  metadata: true,
                },
              },
            },
          },
        },
        orderBy: { order: 'asc' },
      });

      const enhancedUnits = await Promise.all(
        units.map(async (unit) => {
          let progressPercentage = 0;
          let isCompleted = false;
          if (userId && unit.courseId) {
            const progress = await this.prisma.progress.findFirst({
              where: {
                userId,
                courseId: unit.courseId,
                topicId: null,
                materialId: null,
              },
            });

            if (progress) {
              const unitProgress =
                await this.progressService.calculateUnitProgress(
                  userId,
                  unit.id,
                );
              progressPercentage = unitProgress.progressPercentage;
              isCompleted = unitProgress.isCompleted;
            }
          }

          const canManage = Boolean(
            userId &&
              (await this.canManageUnit(
                unit.course.createdById,
                unit.courseId,
                userId,
              )),
          );
          const visibleUnit = await this.filterUnitMaterials(
            unit,
            userId,
            canManage,
          );
          return {
            ...visibleUnit,
            title: unit.title ?? '',
            learningObjectives: JSON.stringify(unit.learningObjectives),
            materialsCount: visibleUnit.materials?.length || 0,
            progressPercentage,
            isCompleted,
          } as UnitResponseDto;
        }),
      );

      this.logger.log('Units fetched from database', {
        courseId,
        count: enhancedUnits.length,
      });
      return enhancedUnits;
    } catch (error) {
      this.logger.error('Error fetching units', {
        courseId,
        userId,
        error: getErrorMessage(error),
      });
      throw error;
    }
  }

  async getRelatedRecommendations(userId: string) {
    const activeProgress = await this.prisma.progress.findMany({
      where: {
        userId,
        unitId: { not: null },
        topicId: null,
        materialId: null,
        status: ProgressStatus.inProgress,
      },
      select: { unitId: true },
    });
    const activeUnitIds = [
      ...new Set(
        activeProgress
          .map((progress) => progress.unitId)
          .filter((unitId): unitId is string => Boolean(unitId)),
      ),
    ];
    if (activeUnitIds.length === 0) return [];

    const [completedProgress, relations] = await Promise.all([
      this.prisma.progress.findMany({
        where: {
          userId,
          unitId: { not: null },
          topicId: null,
          materialId: null,
          status: ProgressStatus.completed,
        },
        select: { unitId: true },
      }),
      this.prisma.unitRelation.findMany({
        where: {
          relationType: { in: ['similar', 'related', 'prerequisite'] },
          OR: [
            { sourceUnitId: { in: activeUnitIds } },
            { targetUnitId: { in: activeUnitIds } },
          ],
        },
        include: {
          sourceUnit: {
            include: {
              course: { select: { id: true, title: true, name: true, status: true } },
            },
          },
          targetUnit: {
            include: {
              course: { select: { id: true, title: true, name: true, status: true } },
            },
          },
        },
        orderBy: { score: 'desc' },
      }),
    ]);

    const excludedUnitIds = new Set([
      ...activeUnitIds,
      ...completedProgress
        .map((progress) => progress.unitId)
        .filter((unitId): unitId is string => Boolean(unitId)),
    ]);
    const recommendations = new Map<
      string,
      {
        unitId: string;
        title: string;
        description: string | null;
        courseId: string;
        courseTitle: string;
        relationType: string;
        score: number;
        sourceUnitId: string;
      }
    >();

    for (const relation of relations) {
      const sourceIsActive = activeUnitIds.includes(relation.sourceUnitId);
      const candidate = sourceIsActive
        ? relation.targetUnit
        : relation.sourceUnit;
      if (
        excludedUnitIds.has(candidate.id) ||
        !candidate.isPublished ||
        candidate.course.status !== 'published' ||
        recommendations.has(candidate.id)
      ) {
        continue;
      }

      const enrolledSourceUnit = sourceIsActive
        ? relation.sourceUnit
        : relation.targetUnit;
      recommendations.set(candidate.id, {
        unitId: candidate.id,
        title: candidate.title || candidate.name,
        description: candidate.description,
        courseId: candidate.courseId,
        courseTitle:
          candidate.course.title || candidate.course.name || 'Course',
        relationType: relation.relationType,
        score: relation.score,
        sourceUnitId: enrolledSourceUnit.id,
      });
    }

    return [...recommendations.values()].slice(0, 8);
  }

  async findOne(id: string, userId?: string): Promise<UnitResponseDto> {
    try {
      const unit = await this.prisma.unit.findUnique({
        where: { id },
        include: {
          course: {
            select: {
              id: true,
              title: true,
              status: true,
              createdById: true,
              materials: {
                where: { unitId: null },
                select: {
                  id: true,
                  title: true,
                  type: true,
                  fileId: true,
                  userId: true,
                  metadata: true,
                },
              },
            },
          },
          materials: {
            select: {
              id: true,
              title: true,
              type: true,
              fileId: true,
              userId: true,
              metadata: true,
            },
            orderBy: { createdAt: 'asc' },
          },
          topics: {
            include: {
              materials: {
                select: {
                  id: true,
                  title: true,
                  type: true,
                  fileId: true,
                  userId: true,
                  metadata: true,
                },
              },
            },
            orderBy: { order: 'asc' },
          },
        },
      });

      if (!unit) {
        this.logger.warn('Unit not found', { unitId: id });
        throw new NotFoundException(`Unit with ID ${id} not found`);
      }

      const canManage = Boolean(
        userId &&
          (await this.canManageUnit(
            unit.course.createdById,
            unit.courseId,
            userId,
          )),
      );
      if (
        !canManage &&
        (unit.course.status !== 'published' || !unit.isPublished)
      ) {
        throw new NotFoundException(`Unit with ID ${id} not found`);
      }

      let progressPercentage = 0;
      let isCompleted = false;

      if (userId) {
        const unitProgress = await this.progressService.calculateUnitProgress(
          userId,
          id,
        );
        progressPercentage = unitProgress.progressPercentage;
        isCompleted = unitProgress.isCompleted;

        await this.progressService.trackUnitAccess(userId, id);
      }

      const courseMaterials = unit.course?.materials ?? [];
      const materials = [
        ...unit.materials,
        ...courseMaterials.filter(
          (courseMaterial) =>
            !unit.materials.some((unitMaterial) => unitMaterial.id === courseMaterial.id),
        ),
      ];

      const visibleUnit = await this.filterUnitMaterials(
        { ...unit, materials },
        userId,
        canManage,
      );
      const result: UnitResponseDto = {
        ...visibleUnit,
        title: unit.title ?? '',
        learningObjectives: JSON.stringify(unit.learningObjectives),
        materialsCount: visibleUnit.materials?.length ?? 0,
        progressPercentage,
        isCompleted,
      };

      this.logger.log('Unit fetched from database', { unitId: id, userId });
      return result;
    } catch (error) {
      this.logger.error('Error fetching unit', {
        unitId: id,
        userId,
        error: getErrorMessage(error),
      });
      throw error;
    }
  }

  async update(
    id: string,
    updateUnitDto: UpdateUnitDto,
    userId: string,
  ): Promise<Unit> {
    try {
      const existingUnit = await this.prisma.unit.findUnique({
        where: { id },
        include: { course: true },
      });

      if (!existingUnit || !existingUnit.course) {
        this.logger.warn('Unit not found for update', { unitId: id });
        throw new NotFoundException(`Unit with ID ${id} not found`);
      }

      if (
        !(await this.canManageUnit(
          existingUnit.course.createdById,
          existingUnit.courseId,
          userId,
        ))
      ) {
        this.logger.warn('Unauthorized unit update attempt', {
          unitId: id,
          userId,
        });
        throw new ForbiddenException(
          'Only the course instructor or an admin can update units',
        );
      }

      if (updateUnitDto.order && updateUnitDto.order !== existingUnit.order) {
        await this.updateUnitOrder(
          id,
          updateUnitDto.order,
          existingUnit.courseId,
        );
        delete updateUnitDto.order;
      }

      const { learningObjectives, ...rest } = updateUnitDto;

      const dataForUpdate: Prisma.UnitUpdateInput = {
        ...rest,
        updatedAt: new Date(),
      };

      if (learningObjectives !== undefined) {
        dataForUpdate.learningObjectives =
          learningObjectives === null ? Prisma.JsonNull : learningObjectives;
      }

      const updatedUnit = await this.prisma.unit.update({
        where: { id },
        data: dataForUpdate,
        include: {
          course: {
            select: { id: true, title: true, status: true },
          },
          materials: {
            select: {
              id: true,
              title: true,
              type: true,
              fileId: true,
              file: { select: { key: true } },
            },
          },
        },
      });

      await this.clearCacheForUnit(existingUnit);
      await this.setCacheForUnit(updatedUnit);

      // Explicitly update FTS vector (replacing DB trigger)
      await FtsUtils.updateFtsVector(this.prisma, 'units', updatedUnit.id);

      // Sync to global search index
      await this.searchSync.syncEntity('unit', updatedUnit.id);

      this.logger.log('Unit updated successfully', { unitId: id, userId });
      return updatedUnit;
    } catch (error) {
      this.logger.error('Error updating unit', {
        unitId: id,
        userId,
        error: getErrorMessage(error),
      });
      throw error;
    }
  }

  async remove(id: string, userId: string): Promise<{ message: string }> {
    try {
      const existingUnit = await this.prisma.unit.findUnique({
        where: { id },
        include: { course: true, materials: true },
      });

      if (!existingUnit || !existingUnit.course) {
        this.logger.warn('Unit not found for deletion', { unitId: id });
        throw new NotFoundException(`Unit with ID ${id} not found`);
      }

      if (
        !(await this.canManageUnit(
          existingUnit.course.createdById,
          existingUnit.courseId,
          userId,
        ))
      ) {
        this.logger.warn('Unauthorized unit deletion attempt', {
          unitId: id,
          userId,
        });
        throw new ForbiddenException(
          'Only the course instructor or an admin can delete units',
        );
      }

      if (existingUnit.materials.length > 0) {
        this.logger.warn('Cannot delete unit with materials', {
          unitId: id,
          materialsCount: existingUnit.materials.length,
        });
        throw new BadRequestException(
          'Cannot delete unit with materials. Please remove all materials first.',
        );
      }

      const topicIds = await this.prisma.topic.findMany({
        where: { unitId: id },
        select: { id: true },
      });
      const [unitProgressCount, topicProgressCount, completionCount] =
        await Promise.all([
          this.prisma.progress.count({ where: { unitId: id } }),
          topicIds.length
            ? this.prisma.progress.count({
                where: { topicId: { in: topicIds.map(({ id: topicId }) => topicId) } },
              })
            : Promise.resolve(0),
          this.prisma.unitCompletion.count({ where: { unitId: id } }),
        ]);
      if (unitProgressCount > 0 || topicProgressCount > 0 || completionCount > 0) {
        throw new BadRequestException(
          'Cannot delete a unit with student progress. Keep it in the historical curriculum or create a new curriculum version.',
        );
      }

      await this.prisma.$transaction(async (prisma) => {
        const laterUnits = await prisma.unit.findMany({
          where: {
            courseId: existingUnit.courseId,
            order: { gt: existingUnit.order },
          },
          select: { id: true, order: true },
        });

        const temporaryOrderBase =
          Math.max(existingUnit.order, ...laterUnits.map((unit) => unit.order)) +
          1000;
        for (const [index, unit] of laterUnits.entries()) {
          await prisma.unit.update({
            where: { id: unit.id },
            data: { order: temporaryOrderBase + index },
          });
        }

        await prisma.unit.delete({ where: { id } });

        for (const unit of laterUnits) {
          await prisma.unit.update({
            where: { id: unit.id },
            data: { order: unit.order - 1 },
          });
        }
      });

      await this.clearCacheForUnit(existingUnit);
      this.logger.log('Unit deleted successfully', { unitId: id, userId });
      return { message: 'Unit deleted successfully' };
    } catch (error) {
      this.logger.error('Error deleting unit', {
        unitId: id,
        userId,
        error: getErrorMessage(error),
      });
      throw error;
    }
  }

  async markAsCompleted(unitId: string, userId: string): Promise<void> {
    try {
      const unit = await this.prisma.unit.findUnique({
        where: { id: unitId },
        include: { course: true },
      });

      if (!unit) {
        this.logger.warn('Unit not found for completion', { unitId, userId });
        throw new NotFoundException('Unit not found');
      }

      const enrollment = await this.prisma.courseEnrollment.findUnique({
        where: { userId_courseId: { userId, courseId: unit.courseId } },
      });

      if (!enrollment) {
        this.logger.warn('User not enrolled in course', {
          unitId,
          userId,
          courseId: unit.courseId,
        });
        throw new ForbiddenException(
          'You must be enrolled in the course to complete units',
        );
      }

      await this.progressService.trackUnitCompletion(userId, unitId);

      const progress = await this.progressService.calculateCourseProgress(
        userId,
        unit.courseId,
      );

      await (this.prisma.progress).upsert({
        where: {
          userId_topicId_materialId_unitId_courseId: {
            userId,
            topicId: '00000000-0000-0000-0000-000000000000',
            materialId: '00000000-0000-0000-0000-000000000000',
            unitId: '00000000-0000-0000-0000-000000000000',
            courseId: unit.courseId,
          },
        },
        update: {
          progressPercentage: progress?.percentage ?? 0,
          lastAccessedAt: new Date(),
        },
        create: {
          userId,
          courseId: unit.courseId,
          topicId: '00000000-0000-0000-0000-000000000000',
          materialId: '00000000-0000-0000-0000-000000000000',
          unitId: '00000000-0000-0000-0000-000000000000',
          progressPercentage: progress?.percentage ?? 0,
          status: ProgressStatus.inProgress,
          lastAccessedAt: new Date(),
        },
      });

      await this.clearCacheForUnit(unit);

      // Emit event for prerequisite refresh
      const completedEvent = new UnitCompletedEvent(
        userId,
        unitId,
        unit.courseId,
        new Date(),
        progress?.percentage ?? 0,
      );
      this.eventEmitter.emit('unit.completed', completedEvent);

      this.logger.log('Unit marked as completed', { unitId, userId });
    } catch (error) {
      this.logger.error('Error marking unit as completed', {
        unitId,
        userId,
        error: getErrorMessage(error),
      });
      throw error;
    }
  }

  async getUnitsByCourse(
    courseId: string,
    userId?: string,
  ): Promise<UnitResponseDto[]> {
    return this.findAll(courseId, userId);
  }

  async reorderUnits(
    courseId: string,
    unitOrders: { unitId: string; order: number }[],
    userId: string,
  ): Promise<void> {
    try {
      const course = await this.prisma.course.findUnique({
        where: { id: courseId },
      });

      if (!course) {
        this.logger.warn('Course not found', { courseId });
        throw new NotFoundException('Course not found');
      }

      if (course.createdById !== userId) {
        this.logger.warn('Unauthorized course reorder attempt', {
          courseId,
          userId,
        });
        throw new ForbiddenException(
          'Only the course instructor can reorder units',
        );
      }

      await this.prisma.$transaction(
        unitOrders.map(({ unitId, order }) =>
          this.prisma.unit.update({
            where: { id: unitId },
            data: { order },
          }),
        ),
      );

      await this.clearCacheForCourse(courseId);
      this.logger.log('Units reordered successfully', { courseId, userId });
    } catch (error) {
      this.logger.error('Error reordering units', {
        courseId,
        userId,
        error: getErrorMessage(error),
      });
      throw error;
    }
  }

  private async updateUnitOrder(
    unitId: string,
    newOrder: number,
    courseId: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (prisma) => {
      const currentUnit = await prisma.unit.findUnique({
        where: { id: unitId },
      });

      if (!currentUnit) {
        this.logger.warn('Unit not found for order update', { unitId });
        return;
      }

      const oldOrder = currentUnit.order;

      if (oldOrder === newOrder) {
        return; // No change needed
      }

      if (newOrder > oldOrder) {
        await prisma.unit.updateMany({
          where: {
            courseId,
            order: { gt: oldOrder, lte: newOrder },
            id: { not: unitId },
          },
          data: { order: { decrement: 1 } },
        });
      } else {
        await prisma.unit.updateMany({
          where: {
            courseId,
            order: { gte: newOrder, lt: oldOrder },
            id: { not: unitId },
          },
          data: { order: { increment: 1 } },
        });
      }

      await prisma.unit.update({
        where: { id: unitId },
        data: { order: newOrder },
      });
    });
  }

  private async setCacheForUnit(unit: Unit | UnitResponseDto): Promise<void> {
    try {
      const keys = [
        cacheKeys.unitById(unit.id),
        cacheKeys.unitsByCourse(unit.courseId),
      ];
      await Promise.all(
        keys.map((key) =>
          this.redisService.set(key, JSON.stringify(unit), this.CACHE_TTL),
        ),
      );
    } catch (error) {
      this.logger.error('Error setting cache for unit', {
        unitId: unit.id,
        error: getErrorMessage(error),
      });
    }
  }

  private async clearCacheForUnit(unit: Unit | UnitResponseDto): Promise<void> {
    try {
      const keys = [
        cacheKeys.unitById(unit.id),
        cacheKeys.unitsByCourse(unit.courseId),
      ];
      await Promise.all([
        ...keys.map((key) => this.redisService.del(key)),
        this.redisService.delPattern('unit:*:questions:v3:*'),
        this.redisService.delPattern('topic:*:questions:v3:*'),
        this.redisService.delPattern('quizzes:*'),
        this.redisService.delPattern('quiz:*'),
      ]);
    } catch (error) {
      this.logger.error('Error clearing cache for unit', {
        unitId: unit.id,
        error: getErrorMessage(error),
      });
    }
  }

  private async clearCacheForCourse(courseId: string): Promise<void> {
    try {
      await Promise.all([
        this.redisService.del(cacheKeys.unitsByCourse(courseId)),
        this.redisService.delPattern('unit:*:questions:v3:*'),
        this.redisService.delPattern('topic:*:questions:v3:*'),
        this.redisService.delPattern('quizzes:*'),
        this.redisService.delPattern('quiz:*'),
      ]);
    } catch (error) {
      this.logger.error('Error clearing cache for course units', {
        courseId,
        error: getErrorMessage(error),
      });
    }
  }
}
