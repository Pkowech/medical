// backend/src/modules/education/events/services/deadlines.service.ts
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '#infrastructure/prisma/prisma.service';
import { CreateDeadlineDto, UpdateDeadlineDto } from '../dto/create-deadline.dto';
import { Deadline, Prisma } from '@prisma/client';

@Injectable()
export class DeadlinesService {
  private readonly logger = new Logger(DeadlinesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, data: CreateDeadlineDto): Promise<Deadline> {
    this.logger.log(`Creating deadline for user ${userId}: ${data.title}`);

    return this.prisma.deadline.create({
      data: {
        userId,
        title: data.title,
        description: data.description,
        dueDate: new Date(data.dueDate),
        priority: data.priority,
        courseId: data.courseId,
        unitId: data.unitId,
        metadata: data.metadata,
      },
    });
  }

  async findAll(userId: string): Promise<Deadline[]> {
    const deadlines = await this.prisma.deadline.findMany({
      where: { userId },
      orderBy: { dueDate: 'asc' },
    });
    const generatedUnits = new Set<string>();

    return deadlines.filter((deadline) => {
      const metadata = deadline.metadata;
      if (
        !deadline.unitId ||
        !metadata ||
        typeof metadata !== 'object' ||
        Array.isArray(metadata) ||
        metadata.type !== 'auto_generated'
      ) {
        return true;
      }

      const key = `${deadline.courseId ?? ''}:${deadline.unitId}`;
      if (generatedUnits.has(key)) return false;
      generatedUnits.add(key);
      return true;
    });
  }

  async findOne(id: string, userId: string): Promise<Deadline> {
    const deadline = await this.prisma.deadline.findFirst({
      where: {
        id,
        userId,
      },
    });

    if (!deadline) {
      throw new NotFoundException(`Deadline with ID ${id} not found`);
    }

    return deadline;
  }

  async update(
    id: string,
    userId: string,
    data: UpdateDeadlineDto,
  ): Promise<Deadline> {
    const deadline = await this.findOne(id, userId);

    const updateData: any = { ...data };
    if (data.dueDate) {
      updateData.dueDate = new Date(data.dueDate);
    }

    return this.prisma.deadline.update({
      where: { id },
      data: updateData,
    });
  }

  async remove(id: string, userId: string): Promise<void> {
    await this.findOne(id, userId);

    await this.prisma.deadline.delete({
      where: { id },
    });
  }

  /**
   * Automatically generates one deadline per unit. Repeated calls leave
   * existing generated dates unchanged.
   */
  async autoGenerateCourseDeadlines(
    userId: string,
    courseId: string,
  ): Promise<number> {
    const units = await this.prisma.unit.findMany({
      where: { courseId },
      orderBy: { order: 'asc' },
    });

    if (units.length === 0) return 0;

    const now = new Date();
    const startDate = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
    const unitIds = units.map((unit) => unit.id);
    const existingDeadlines = await this.prisma.deadline.findMany({
      where: { userId, courseId, unitId: { in: unitIds } },
      select: { courseId: true, unitId: true, metadata: true },
    });
    const existingGeneratedUnitIds = new Set(
      existingDeadlines
        .filter((deadline) => {
          const metadata = deadline.metadata;
          return (
            metadata !== null &&
            typeof metadata === 'object' &&
            !Array.isArray(metadata) &&
            metadata.type === 'auto_generated'
          );
        })
        .map((deadline) => deadline.unitId)
        .filter((unitId): unitId is string => unitId !== null),
    );

    const deadlinesToCreate: Prisma.DeadlineCreateManyInput[] = [];
    for (let i = 0; i < units.length; i++) {
      const unit = units[i];
      if (existingGeneratedUnitIds.has(unit.id)) continue;

      const dueDate = new Date(startDate);
      dueDate.setUTCDate(dueDate.getUTCDate() + (i + 1) * 7);
      deadlinesToCreate.push({
        sourceKey: `auto-course-deadline:${userId}:${courseId}:${unit.id}`,
        userId,
        courseId,
        unitId: unit.id,
        title: `Complete Unit: ${unit.title || unit.name}`,
        description:
          'Auto-generated deadline for completing the unit within the recommended timeframe.',
        dueDate,
        priority: i === 0 ? 'high' : 'medium',
        metadata: { type: 'auto_generated' },
      });
    }

    if (!deadlinesToCreate.length) return 0;
    const result = await this.prisma.deadline.createMany({
      data: deadlinesToCreate,
      skipDuplicates: true,
    });
    return result.count;
  }
}
