import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '#infrastructure/prisma/prisma.service';
import { NotificationsService } from '#modules/engagement-communication/services/notifications.service';

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
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async checkUpcomingDeadlines() {
    this.logger.log('Checking for upcoming deadlines...');

    const now = new Date();
    const oneDayLater = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const twoDaysLater = new Date(now.getTime() + 48 * 60 * 60 * 1000);

    // 1. Check for deadlines due in exactly 1 day (approximated to the day)
    await this.notifyForWindow(oneDayLater, 'due in 24 hours', 'important');

    // 2. Check for deadlines due in exactly 2 days
    await this.notifyForWindow(twoDaysLater, 'due in 48 hours', 'suggestion');

    this.logger.log('Finished checking deadlines.');
  }

  private async notifyForWindow(
    targetDate: Date,
    timeframe: string,
    severity: 'important' | 'suggestion',
  ) {
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const deadlines = await this.prisma.deadline.findMany({
      where: {
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
          severity,
          true, // Send via push if possible
        );
        this.logger.debug(`Sent reminder for deadline ${deadline.id} to user ${deadline.userId}`);
      } catch (error) {
        this.logger.error(`Failed to send reminder for deadline ${deadline.id}: ${(error as any).message}`);
      }
    }
  }
}
