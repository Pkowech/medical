// backend/src/modules/education/events/services/events.service.ts
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '#infrastructure/prisma/prisma.service';
import { CreateEventDto, UpdateEventDto } from '../dto/create-event.dto';
import { ScheduleEvent } from '@prisma/client';

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, data: CreateEventDto): Promise<ScheduleEvent> {
    this.logger.log(`Creating event for user ${userId}: ${data.title}`);

    return this.prisma.scheduleEvent.create({
      data: {
        userId,
        title: data.title,
        description: data.description,
        date: new Date(data.date),
        endDate: new Date(data.endDate),
        type: data.type,
        location: data.location,
        instructor: data.instructor,
        completed: data.completed ?? false,
        allDay: data.allDay ?? false,
        priority: data.priority ?? 1,
        status: data.status ?? 'pending',
        category: data.category ?? 'academic',
        color: data.color ?? '#6366F1',
        isRecurring: data.isRecurring ?? false,
        recurrencePattern: data.recurrencePattern,
        reminders: data.reminders ?? [15, 1440],
        attendees: data.attendees ?? [],
        metadata: data.metadata,
        topicId: data.topicId,
        courseId: data.courseId,
        learningPathId: data.learningPathId,
      },
    });
  }

  async findAll(userId: string): Promise<ScheduleEvent[]> {
    return this.prisma.scheduleEvent.findMany({
      where: {
        OR: [
          { userId },
          { userId: null }, // Global events
        ],
      },
      orderBy: { date: 'asc' },
    });
  }

  async findOne(id: string, userId: string): Promise<ScheduleEvent> {
    const event = await this.prisma.scheduleEvent.findFirst({
      where: {
        id,
        OR: [{ userId }, { userId: null }],
      },
    });

    if (!event) {
      throw new NotFoundException(`Event with ID ${id} not found`);
    }

    return event;
  }

  async update(
    id: string,
    userId: string,
    data: UpdateEventDto,
  ): Promise<ScheduleEvent> {
    const event = await this.findOne(id, userId);

    if (event.userId !== userId) {
      throw new Error('You do not have permission to update this event');
    }

    // Build update object dynamically to only include provided fields
    const updateData: Record<string, unknown> = {};

    if (data.title !== undefined) {
      updateData.title = data.title;
    }
    if (data.description !== undefined) {
      updateData.description = data.description;
    }
    if (data.date !== undefined) {
      updateData.date = new Date(data.date);
    }
    if (data.endDate !== undefined) {
      updateData.endDate = new Date(data.endDate);
    }
    if (data.type !== undefined) {
      updateData.type = data.type;
    }
    if (data.location !== undefined) {
      updateData.location = data.location;
    }
    if (data.instructor !== undefined) {
      updateData.instructor = data.instructor;
    }
    if (data.completed !== undefined) {
      updateData.completed = data.completed;
    }
    if (data.allDay !== undefined) {
      updateData.allDay = data.allDay;
    }
    if (data.priority !== undefined) {
      updateData.priority = data.priority;
    }
    if (data.status !== undefined) {
      updateData.status = data.status;
    }
    if (data.category !== undefined) {
      updateData.category = data.category;
    }
    if (data.color !== undefined) {
      updateData.color = data.color;
    }
    if (data.isRecurring !== undefined) {
      updateData.isRecurring = data.isRecurring;
    }
    if (data.recurrencePattern !== undefined) {
      updateData.recurrencePattern = data.recurrencePattern;
    }
    if (data.reminders !== undefined) {
      updateData.reminders = data.reminders;
    }
    if (data.attendees !== undefined) {
      updateData.attendees = data.attendees;
    }
    if (data.metadata !== undefined) {
      updateData.metadata = data.metadata;
    }
    if (data.topicId !== undefined) {
      updateData.topicId = data.topicId;
    }
    if (data.courseId !== undefined) {
      updateData.courseId = data.courseId;
    }
    if (data.learningPathId !== undefined) {
      updateData.learningPathId = data.learningPathId;
    }

    return this.prisma.scheduleEvent.update({
      where: { id },
      data: updateData,
    });
  }

  async remove(id: string, userId: string): Promise<void> {
    const event = await this.findOne(id, userId);

    if (event.userId !== userId) {
      throw new Error('You do not have permission to delete this event');
    }

    await this.prisma.scheduleEvent.delete({
      where: { id },
    });
  }
}
