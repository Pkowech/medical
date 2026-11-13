import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NotificationPriority } from '@prisma/client';
import { PrismaService } from '#infrastructure/prisma/prisma.service';
import { NotificationsService } from '#modules/engagement-communication/services/notifications.service';

const MAX_REMINDER_MINUTES = 7 * 24 * 60;
const REMINDER_INTERVAL_MS = 60 * 1000;

@Injectable()
export class ScheduleEventRemindersTask {
  private readonly logger = new Logger(ScheduleEventRemindersTask.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async sendDueReminders(): Promise<void> {
    const now = new Date();
    const reminderWindowStart = new Date(now.getTime() - REMINDER_INTERVAL_MS);
    const latestRelevantDate = new Date(
      now.getTime() + MAX_REMINDER_MINUTES * REMINDER_INTERVAL_MS,
    );
    const events = await this.prisma.scheduleEvent.findMany({
      where: {
        userId: { not: null },
        date: { gte: reminderWindowStart, lte: latestRelevantDate },
        completed: false,
        status: { notIn: ['completed', 'cancelled'] },
        reminders: { isEmpty: false },
      },
      select: {
        id: true,
        userId: true,
        title: true,
        date: true,
        priority: true,
        reminders: true,
      },
    });

    for (const event of events) {
      if (!event.userId) continue;

      for (const reminderMinutes of new Set(event.reminders)) {
        if (
          !Number.isInteger(reminderMinutes) ||
          reminderMinutes < 0 ||
          reminderMinutes > MAX_REMINDER_MINUTES
        ) {
          this.logger.warn(
            `Skipping invalid reminder offset for schedule event ${event.id}`,
          );
          continue;
        }

        const reminderAt = new Date(
          event.date.getTime() - reminderMinutes * REMINDER_INTERVAL_MS,
        );
        const isDue =
          reminderAt <= now &&
          (reminderMinutes === 0
            ? reminderAt > reminderWindowStart
            : event.date > now);
        if (!isDue) continue;

        const timeframe =
          reminderMinutes === 0
            ? 'now'
            : reminderMinutes < 60
              ? `in ${reminderMinutes} minute${reminderMinutes === 1 ? '' : 's'}`
              : reminderMinutes % (24 * 60) === 0
                ? `in ${reminderMinutes / (24 * 60)} day${reminderMinutes === 24 * 60 ? '' : 's'}`
                : `in ${Math.floor(reminderMinutes / 60)} hour${Math.floor(reminderMinutes / 60) === 1 ? '' : 's'}`;

        await this.notificationsService.create(
          event.userId,
          `Reminder: ${event.title} starts ${timeframe}.`,
          'schedule_event_reminder',
          {
            eventId: event.id,
            reminderMinutes,
            actionUrl: '/schedule',
          },
          event.priority >= 3
            ? NotificationPriority.high
            : NotificationPriority.medium,
          true,
          `schedule-event:${event.id}:${event.date.toISOString()}:${reminderMinutes}`,
        );
      }
    }
  }
}
