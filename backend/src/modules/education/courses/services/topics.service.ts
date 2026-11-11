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

  private async canManageCourseById(
    courseId: string,
    courseOwnerId: string | null,
    userId: string,
  ) {
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId },
      include: { role: { select: { name: true } } },
    });
    const roles = userRoles.map(({ role }) => role.name);
    if (roles.includes(Role.admin)) return true;
    if (!roles.includes(Role.instructor)) return false;
    if (courseOwnerId === userId) return true;

    const assignment = await this.prisma.courseInstructor.findUnique({
      where: { courseId_userId: { courseId, userId } },
      select: { id: true },
    });
    return Boolean(assignment);
  }

  private toResponse(topic: Topic): TopicWithTitle {
    return { ...topic, title: topic.name };
  }

  private async toVisibleTopics(
    topics: any[],
    userId?: string,
  ): Promise<TopicWithTitle[]> {
    const roles = userId
      ? (await this.prisma.userRole.findMany({
          where: { userId },
          include: { role: { select: { name: true } } },
        })).map(({ role }) => role.name)
      : [];
    const courseIds = [
      ...new Set(topics.map((topic) => topic.unit?.course?.id).filter(Boolean)),
    ];
    const materialIds = [
      ...new Set(
        topics.flatMap((topic) =>
          (topic.materials ?? []).map((material: any) => material.id),
        ),
      ),
    ];
    const [enrollments, shares] = userId
      ? await Promise.all([
          this.prisma.courseEnrollment.findMany({
            where: {
              userId,
              courseId: { in: courseIds },
              status: { in: ['active', 'completed'] },
            },
            select: { courseId: true },
          }),
          this.prisma.materialShare.findMany({
            where: { userId, materialId: { in: materialIds } },
            select: { materialId: true },
          }),
        ])
      : [[], []];
    const enrolledCourseIds = new Set(
      enrollments.map(({ courseId }) => courseId),
    );
    const sharedMaterialIds = new Set(
      shares.map(({ materialId }) => materialId),
    );

    return topics.map((topic) => {
      const { unit, ...topicData } = topic;
      const course = unit?.course;
      const canManage =
        roles.includes(Role.admin) ||
        (roles.includes(Role.instructor) &&
          (course?.createdById === userId ||
            course?.instructors?.some(
              (instructor: { userId: string }) => instructor.userId === userId,
            )));
      const materials = canManage
        ? topic.materials
        : (topic.materials ?? []).filter((material: any) => {
            const metadata =
              material.metadata &&
              typeof material.metadata === 'object' &&
              !Array.isArray(material.metadata)
                ? material.metadata
                : {};
            return (
              material.userId === userId ||
              sharedMaterialIds.has(material.id) ||
              (enrolledCourseIds.has(course?.id) &&
                metadata.shareWithCourse !== false)
            );
          });
      return this.toResponse({ ...topicData, materials } as Topic);
    });
  }

  private async getTopicForManagement(id: string, userId: string) {
    const topic = await this.prisma.topic.findUnique({
      where: { id },
      include: {
        unit: {
          include: {
            course: { select: { id: true, createdById: true } },
          },
        },
      },
    });
    if (!topic) throw new NotFoundException(`Topic with ID ${id} not found`);
    if (
      !(await this.canManageCourseById(
        topic.unit.course.id,
        topic.unit.course.createdById,
        userId,
      ))
    ) {
      throw new ForbiddenException('Only the course instructor or an admin can manage topics');
    }
    return topic;
  }

  async findAll(unitId?: string, userId?: string): Promise<TopicWithTitle[]> {
    const roles = userId
      ? (await this.prisma.userRole.findMany({
          where: { userId },
          include: { role: { select: { name: true } } },
        })).map(({ role }) => role.name)
      : [];
    const where: Prisma.TopicWhereInput = unitId ? { unitId } : {};
    if (!roles.includes(Role.admin)) {
      const visibility: Prisma.TopicWhereInput[] = [
        {
          unit: {
            is: {
              isPublished: true,
              course: { is: { status: 'published' } },
            },
          },
        },
      ];
      if (userId && roles.includes(Role.instructor)) {
        visibility.push(
          { unit: { is: { course: { is: { createdById: userId } } } } },
          {
            unit: {
              is: {
                course: {
                  is: { instructors: { some: { userId } } },
                },
              },
            },
          },
        );
      }
      where.AND = [{ OR: visibility }];
    }

    const topics = await this.prisma.topic.findMany({
      where,
      include: {
        materials: true,
        unit: {
          select: {
            course: {
              select: {
                id: true,
                createdById: true,
                instructors: {
                  where: { userId: userId ?? '' },
                  select: { userId: true },
                },
              },
            },
          },
        },
      },
      orderBy: [{ unitId: 'asc' }, { order: 'asc' }],
    });
    return this.toVisibleTopics(topics, userId);
  }

  async findOne(id: string, userId: string): Promise<TopicWithTitle> {
    const topic = await this.prisma.topic.findUnique({
      where: { id },
      include: {
        materials: true,
        unit: {
          include: {
            course: {
              select: {
                id: true,
                status: true,
                createdById: true,
                instructors: { where: { userId }, select: { userId: true } },
              },
            },
          },
        },
      },
    });
    if (!topic) throw new NotFoundException(`Topic with ID ${id} not found`);
    const canManage = await this.canManageCourseById(
      topic.unit.course.id,
      topic.unit.course.createdById,
      userId,
    );
    if (
      !canManage &&
      (topic.unit.course.status !== 'published' || !topic.unit.isPublished)
    ) {
      throw new NotFoundException(`Topic with ID ${id} not found`);
    }
    return (await this.toVisibleTopics([topic], userId))[0];
  }

  async create(input: TopicMutationInput, userId: string): Promise<TopicWithTitle> {
    const unitId = input.unitId?.trim();
    const name = (input.name || input.title || '').trim();
    if (!unitId || !name) {
      throw new BadRequestException('Unit ID and topic title are required');
    }

    const unit = await this.prisma.unit.findUnique({
      where: { id: unitId },
      include: { course: { select: { id: true, createdById: true } } },
    });
    if (!unit) throw new NotFoundException(`Unit with ID ${unitId} not found`);
    if (
      !(await this.canManageCourseById(
        unit.course.id,
        unit.course.createdById,
        userId,
      ))
    ) {
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
    await this.getTopicForManagement(id, userId);
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
    const [progressCount, skillStateCount, subtopicCount] = await Promise.all([
      this.prisma.progress.count({ where: { topicId: id } }),
      this.prisma.userSkillState.count({ where: { topicId: id } }),
      this.prisma.topic.count({ where: { parentTopicId: id } }),
    ]);
    if (progressCount > 0 || skillStateCount > 0 || subtopicCount > 0) {
      throw new BadRequestException(
        'Cannot delete a topic with student progress or subtopics. Keep it in the historical curriculum or create a new curriculum version.',
      );
    }

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