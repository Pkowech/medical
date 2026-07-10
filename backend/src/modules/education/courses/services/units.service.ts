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

  async create(createUnitDto: CreateUnitDto, creatorId: string): Promise<Unit> {
    try {
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
            isPublished: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          include: {
            course: {
              select: { id: true, title: true, status: true },
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
    const cacheKey = cacheKeys.unitsAll(courseId ?? '', userId ?? '');
    const cached = await this.redisService.get<string>(cacheKey);

    if (cached) {
      try {
        this.logger.log('Units fetched from cache', { courseId, userId });
        return JSON.parse(cached) as UnitResponseDto[];
      } catch (err) {
        this.logger.warn(`Corrupt cache for units list: ${cacheKey}`);
        await this.redisService.del(cacheKey);
      }
    }

    try {
      const where: Prisma.UnitWhereInput = {};
      if (courseId) {
        where.courseId = courseId;
      }

      const units = await this.prisma.unit.findMany({
        where,
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
        orderBy: { order: 'asc' },
      });

      const enhancedUnits = await Promise.all(
        units.map(async (unit) => {
          let progressPercentage = 0;
          let isCompleted = false;
          const materialsCount = unit.materials?.length || 0;

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

          return {
            ...unit,
            title: unit.title ?? '',
            learningObjectives: JSON.stringify(unit.learningObjectives),
            materialsCount,
            progressPercentage,
            isCompleted,
          } as UnitResponseDto;
        }),
      );

      await this.redisService.set(
        cacheKey,
        JSON.stringify(enhancedUnits),
        this.CACHE_TTL,
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

  async findOne(id: string, userId?: string): Promise<UnitResponseDto> {
    const cacheKey = cacheKeys.unitById(id);
    const cached = await this.redisService.get<string>(cacheKey);

    if (cached) {
      try {
        this.logger.log('Unit fetched from cache', { unitId: id, userId });
        return JSON.parse(cached) as UnitResponseDto;
      } catch (err) {
        this.logger.warn(`Corrupt cache for unit ${id}`);
        await this.redisService.del(cacheKey);
      }
    }

    try {
      const unit = await this.prisma.unit.findUnique({
        where: { id },
        include: {
          course: {
            select: { id: true, title: true, status: true },
          },
          materials: {
            select: { id: true, title: true, type: true, fileId: true },
            orderBy: { createdAt: 'asc' },
          },
          topics: {
            include: {
              materials: {
                select: { id: true, title: true, type: true, fileId: true },
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

      const result: UnitResponseDto = {
        ...unit,
        title: unit.title ?? '',
        learningObjectives: JSON.stringify(unit.learningObjectives),
        materialsCount: unit.materials?.length || 0,
        progressPercentage,
        isCompleted,
      };

      await this.redisService.set(
        cacheKey,
        JSON.stringify(result),
        this.CACHE_TTL,
      );
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

      if (existingUnit.course.createdById !== userId) {
        this.logger.warn('Unauthorized unit update attempt', {
          unitId: id,
          userId,
        });
        throw new ForbiddenException(
          'Only the course instructor can update units',
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

      if (existingUnit.course.createdById !== userId) {
        this.logger.warn('Unauthorized unit deletion attempt', {
          unitId: id,
          userId,
        });
        throw new ForbiddenException(
          'Only the course instructor can delete units',
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

      await this.prisma.$transaction(async (prisma) => {
        await prisma.unit.updateMany({
          where: {
            courseId: existingUnit.courseId,
            order: { gt: existingUnit.order },
          },
          data: { order: { decrement: 1 } },
        });

        await prisma.unit.delete({ where: { id } });
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

      await (this.prisma.progress as any).upsert({
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
      await Promise.all(keys.map((key) => this.redisService.del(key)));
    } catch (error) {
      this.logger.error('Error clearing cache for unit', {
        unitId: unit.id,
        error: getErrorMessage(error),
      });
    }
  }

  private async clearCacheForCourse(courseId: string): Promise<void> {
    try {
      await this.redisService.del(cacheKeys.unitsByCourse(courseId));
    } catch (error) {
      this.logger.error('Error clearing cache for course units', {
        courseId,
        error: getErrorMessage(error),
      });
    }
  }
}
