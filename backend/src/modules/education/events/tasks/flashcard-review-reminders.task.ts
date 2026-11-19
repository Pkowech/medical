import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NotificationPriority } from '@prisma/client';
import { PrismaService } from '#infrastructure/prisma/prisma.service';
import { NotificationsService } from '#modules/engagement-communication/services/notifications.service';
import { getReminderLocalTime } from '../../courses/utils/goal-reminder-schedule';

const DAILY_REMINDER_TIME = '09:00';

type JsonRecord = Record<string, unknown>;

const asRecord = (value: unknown): JsonRecord =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};

@Injectable()
export class FlashcardReviewRemindersTask {
  private readonly logger = new Logger(FlashcardReviewRemindersTask.name);
  private readonly invalidTimezoneWarnings = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async sendDueReviewReminders(): Promise<void> {
    const now = new Date();
    const dueCounts = await this.prisma.userFlashcardProgress.groupBy({
      by: ['userId'],
      where: { nextReview: { lte: now } },
      _count: { _all: true },
    });
    if (dueCounts.length === 0) return;

    const users = await this.prisma.user.findMany({
      where: { id: { in: dueCounts.map(({ userId }) => userId) } },
      select: { id: true, preferences: true },
    });
    const preferencesByUser = new Map(
      users.map(user => [user.id, user.preferences]),
    );

    for (const due of dueCounts) {
      const userPreferences = preferencesByUser.get(due.userId);
      if (userPreferences === undefined) {
        this.logger.warn(
          `Skipping flashcard reminder because user ${due.userId} was not found.`,
        );
        continue;
      }

      const preferences = asRecord(userPreferences);
      const notifications = asRecord(preferences.notifications);
      if (notifications.push !== true) continue;

      const timezone =
        typeof preferences.timezone === 'string'
          ? preferences.timezone
          : 'UTC';
      let localTime: ReturnType<typeof getReminderLocalTime>;
      try {
        localTime = getReminderLocalTime(now, timezone);
      } catch (error) {
        if (!this.invalidTimezoneWarnings.has(due.userId)) {
          this.logger.warn(
            `Skipping flashcard reminder for user ${due.userId} with invalid timezone: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
          this.invalidTimezoneWarnings.add(due.userId);
        }
        continue;
      }
      if (localTime.time !== DAILY_REMINDER_TIME) continue;

      try {
        await this.notificationsService.create(
          due.userId,
          `You have ${due._count._all} flashcard${due._count._all === 1 ? '' : 's'} due for review.`,
          'flashcard_review_reminder',
          {
            title: 'Flashcards due for review',
            actionUrl: '/flashcards/all',
            dueCount: due._count._all,
          },
          NotificationPriority.low,
          true,
          `flashcard-review:${due.userId}:${localTime.date}`,
        );
      } catch (error) {
        this.logger.error(
          `Could not send flashcard review reminder for user ${due.userId}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
  }
}
