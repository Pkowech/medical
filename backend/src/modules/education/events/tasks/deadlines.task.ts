import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '#infrastructure/prisma/prisma.service';
import { NotificationsService } from '#modules/engagement-communication/services/notifications.service';
import { NotificationPriority } from '@prisma/client';

@Injectable()
export class DeadlinesTask {
  private readonly logger = new Logger(DeadlinesTask.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Runs every day at midnight to check for deadlines due in 24 and 48 hours.
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT, { timeZone: 'UTC' })
  async checkUpcomingDeadlines() {
    this.logger.log('Checking for upcoming deadlines...');

    const now = new Date();
    const utcToday = Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
    );
    const oneDayLater = new Date(utcToday + 24 * 60 * 60 * 1000);
    const twoDaysLater = new Date(utcToday + 48 * 60 * 60 * 1000);

    // Send calendar-day reminders for deadlines due tomorrow and in two days.
    await this.notifyForWindow(
      oneDayLater,
      'due tomorrow',
      'tomorrow',
      NotificationPriority.high,
    );

    await this.notifyForWindow(
      twoDaysLater,
      'due in 2 days',
      'two-days',
      NotificationPriority.low,
    );

    this.logger.log('Finished checking deadlines.');
  }

  private async notifyForWindow(
    targetDate: Date,
    timeframe: string,
    reminderKey: string,
    priority: NotificationPriority,
  ) {
    const startOfDay = new Date(
      Date.UTC(
        targetDate.getUTCFullYear(),
        targetDate.getUTCMonth(),
        targetDate.getUTCDate(),
      ),
    );
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
    endOfDay.setUTCMilliseconds(endOfDay.getUTCMilliseconds() - 1);

    const deadlines = await this.prisma.deadline.findMany({
      where: {
        completed: false,
        dueDate: {
          gte: startOfDay,
          lte: endOfDay,
        },
        userId: { not: null },
      },
      include: {
        course: { select: { title: true } },
      },
    });

    for (const deadline of deadlines) {
      if (!deadline.userId) continue;

      const courseTitle = deadline.course?.title || 'Academic';
      const message = `Reminder: Your ${deadline.title} for ${courseTitle} is ${timeframe}.`;

      try {
        await this.notificationsService.create(
          deadline.userId,
          message,
          'deadline_reminder',
          { deadlineId: deadline.id, courseId: deadline.courseId },
          priority,
          true, // Send via push if possible
          `deadline:${deadline.id}:${deadline.dueDate.toISOString()}:${reminderKey}`,
        );
        this.logger.debug(`Sent reminder for deadline ${deadline.id} to user ${deadline.userId}`);
      } catch (error) {
        this.logger.error(`Failed to send reminder for deadline ${deadline.id}: ${(error as any).message}`);
      }
    }
  }
}
