import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Topic } from '@prisma/client';
import { PrismaService } from '#infrastructure/prisma/prisma.service';
import { FtsUtils } from '#common/utils/fts.utils';
import { Role } from '#modules/auth/constants/role.constants';

export interface TopicMutationInput {
  unitId?: string;
  title?: string;
  name?: string;
  description?: string;
  order?: number;
  orderIndex?: number;
  estimatedMinutes?: number;
  isMandatory?: boolean;
  categoryId?: string | null;
}

type TopicWithTitle = Topic & { title: string };

@Injectable()
export class TopicsService {
  constructor(private readonly prisma: PrismaService) {}

  private async canManageCourse(courseOwnerId: string | null, userId: string) {
    if (courseOwnerId === userId) return true;
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId },
      include: { role: { select: { name: true } } },
    });
    return userRoles.some(userRole => userRole.role.name === Role.admin);
  }

  private toResponse(topic: Topic): TopicWithTitle {
    return { ...topic, title: topic.name };
  }

  private async getTopicForManagement(id: string, userId: string) {
    const topic = await this.prisma.topic.findUnique({
      where: { id },
      include: { unit: { include: { course: { select: { createdById: true } } } } },
    });
    if (!topic) throw new NotFoundException(`Topic with ID ${id} not found`);
    if (!(await this.canManageCourse(topic.unit.course.createdById, userId))) {
      throw new ForbiddenException('Only the course instructor or an admin can manage topics');
    }
    return topic;
  }

  async findAll(unitId?: string): Promise<TopicWithTitle[]> {
    const topics = await this.prisma.topic.findMany({
      where: unitId ? { unitId } : undefined,
      include: { materials: true },
      orderBy: [{ unitId: 'asc' }, { order: 'asc' }],
    });
    return topics.map(topic => this.toResponse(topic));
  }

  async findOne(id: string): Promise<TopicWithTitle> {
    const topic = await this.prisma.topic.findUnique({
      where: { id },
      include: { materials: true },
    });
    if (!topic) throw new NotFoundException(`Topic with ID ${id} not found`);
    return this.toResponse(topic);
  }

  async create(input: TopicMutationInput, userId: string): Promise<TopicWithTitle> {
    const unitId = input.unitId?.trim();
    const name = (input.name || input.title || '').trim();
    if (!unitId || !name) {
      throw new BadRequestException('Unit ID and topic title are required');
    }

    const unit = await this.prisma.unit.findUnique({
      where: { id: unitId },
      include: { course: { select: { createdById: true } } },
    });
    if (!unit) throw new NotFoundException(`Unit with ID ${unitId} not found`);
    if (!(await this.canManageCourse(unit.course.createdById, userId))) {
      throw new ForbiddenException('Only the course instructor or an admin can manage topics');
    }

    const lastTopic = await this.prisma.topic.findFirst({
      where: { unitId },
      orderBy: { order: 'desc' },
      select: { order: true },
    });
    const requestedOrder = Number(input.order ?? input.orderIndex);
    const order = Number.isInteger(requestedOrder) && requestedOrder > 0
      ? requestedOrder
      : (lastTopic?.order || 0) + 1;

    const topic = await this.prisma.$transaction(async prisma => {
      await prisma.topic.updateMany({
        where: { unitId, order: { gte: order } },
        data: { order: { increment: 1 } },
      });
      return prisma.topic.create({
        data: {
          name,
          unitId,
          order,
          description: input.description,
          estimatedMinutes: input.estimatedMinutes,
          isMandatory: input.isMandatory ?? false,
          categoryId: input.categoryId,
        },
      });
    });

    await FtsUtils.updateFtsVector(this.prisma, 'topics', topic.id);
    return this.toResponse(topic);
  }

  async update(id: string, input: TopicMutationInput, userId: string): Promise<TopicWithTitle> {
    const existing = await this.getTopicForManagement(id, userId);
    const name = input.name ?? input.title;
    if (name !== undefined && !name.trim()) {
      throw new BadRequestException('Topic title cannot be empty');
    }

    const requestedOrder = Number(input.order ?? input.orderIndex);
    const order = Number.isInteger(requestedOrder) && requestedOrder > 0
      ? requestedOrder
      : undefined;

    const topic = await this.prisma.topic.update({
      where: { id },
      data: {
        name: name?.trim(),
        description: input.description,
        order,
        estimatedMinutes: input.estimatedMinutes,
        isMandatory: input.isMandatory,
        categoryId: input.categoryId,
      },
    });

    await FtsUtils.updateFtsVector(this.prisma, 'topics', topic.id);
    return this.toResponse(topic);
  }

  async remove(id: string, userId: string): Promise<void> {
    const existing = await this.getTopicForManagement(id, userId);
    try {
      await this.prisma.$transaction(async prisma => {
        const laterTopics = await prisma.topic.findMany({
          where: { unitId: existing.unitId, order: { gt: existing.order } },
          select: { id: true, order: true },
          orderBy: { order: 'asc' },
        });
        const temporaryOrderBase = Math.max(
          existing.order,
          ...laterTopics.map(topic => topic.order),
        ) + 1000;

        for (const [index, topic] of laterTopics.entries()) {
          await prisma.topic.update({
            where: { id: topic.id },
            data: { order: temporaryOrderBase + index },
          });
        }

        await prisma.topic.delete({ where: { id } });

        for (const topic of laterTopics) {
          await prisma.topic.update({
            where: { id: topic.id },
            data: { order: topic.order - 1 },
          });
        }
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        throw new BadRequestException('Cannot delete this topic while it has linked records');
      }
      throw error;
    }
  }
}