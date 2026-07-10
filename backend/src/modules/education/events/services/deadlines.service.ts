// backend/src/modules/education/events/services/deadlines.service.ts
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '#infrastructure/prisma/prisma.service';
import { CreateDeadlineDto, UpdateDeadlineDto } from '../dto/create-deadline.dto';
import { Deadline } from '@prisma/client';

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
    return this.prisma.deadline.findMany({
      where: { userId },
      orderBy: { dueDate: 'asc' },
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
   * Automatically generates deadlines for all units in a course.
   * Spaced out by 7 days starting from today.
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

    const startDate = new Date();
    const createdDeadlines = [];

    for (let i = 0; i < units.length; i++) {
      const unit = units[i];
      const dueDate = new Date(startDate);
      dueDate.setDate(dueDate.getDate() + (i + 1) * 7); // 1 week per unit

      createdDeadlines.push(
        this.prisma.deadline.create({
          data: {
            userId,
            courseId,
            unitId: unit.id,
            title: `Complete Unit: ${unit.title || unit.name}`,
            description: `Auto-generated deadline for completing the unit within the recommended timeframe.`,
            dueDate,
            priority: i === 0 ? 'high' : 'medium',
            metadata: { type: 'auto_generated' },
          },
        }),
      );
    }

    const results = await Promise.all(createdDeadlines);
    return results.length;
  }
}
