import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NotificationPriority, ProgressStatus } from '@prisma/client';
import { PrismaService } from '#infrastructure/prisma/prisma.service';
import { NotificationsService } from '#modules/engagement-communication/services/notifications.service';
import {
  GoalReminderSettings,
  getReminderLocalTime,
  isGoalReminderDue,
} from '../../courses/utils/goal-reminder-schedule';

type JsonRecord = Record<string, unknown>;

const asRecord = (value: unknown): JsonRecord =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};

@Injectable()
export class LearningGoalRemindersTask {
  private readonly logger = new Logger(LearningGoalRemindersTask.name);
  private readonly invalidReminderWarnings = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async sendDueReminders(): Promise<void> {
    const now = new Date();
    const goals = await this.prisma.learningGoal.findMany({
      where: {
        status: {
          in: [
            ProgressStatus.notStarted,
            ProgressStatus.inProgress,
            ProgressStatus.active,
          ],
        },
        metadata: {
          path: ['reminderSettings', 'enabled'],
          equals: true,
        },
      },
      select: {
        id: true,
        userId: true,
        title: true,
        startDate: true,
        targetDate: true,
        metadata: true,
        user: { select: { preferences: true } },
      },
    });

    for (const goal of goals) {
      const metadata = asRecord(goal.metadata);
      const settings = asRecord(metadata.reminderSettings) as GoalReminderSettings;
      if (!settings.enabled) continue;

      const userPreferences = asRecord(goal.user.preferences);
      const timezone =
        settings.timezone ??
        (typeof userPreferences.timezone === 'string'
          ? userPreferences.timezone
          : 'UTC');

      let isDue: boolean;
      try {
        isDue = isGoalReminderDue(
          settings,
          now,
          timezone,
          goal.startDate,
          goal.targetDate,
        );
      } catch (error) {
        if (!this.invalidReminderWarnings.has(goal.id)) {
          this.logger.warn(
            `Invalid reminder settings for goal ${goal.id}: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
          this.invalidReminderWarnings.add(goal.id);
        }
        continue;
      }
      if (!isDue) continue;

      const localDate = getReminderLocalTime(now, timezone).date;
      try {
        await this.notificationsService.create(
          goal.userId,
          `Reminder: Continue working on "${goal.title}". Make a little progress today.`,
          'goal_reminder',
          {
            goalId: goal.id,
            type: 'goal_reminder',
            actionUrl: `/goals?goalId=${encodeURIComponent(goal.id)}`,
          },
          NotificationPriority.medium,
          true,
          `learning-goal:${goal.id}:reminder:${localDate}`,
        );
      } catch (error) {
        this.logger.error(
          `Could not send reminder for goal ${goal.id}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
  }
}
