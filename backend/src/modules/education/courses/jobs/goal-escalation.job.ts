import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NotificationsService } from '#modules/engagement-communication/services/notifications.service';
import {
  LearningGoal,
  NotificationPriority,
  ProgressStatus,
} from '@prisma/client';

@Injectable()
export class GoalEscalationJob {
  private readonly logger = new Logger(GoalEscalationJob.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async handleEscalations() {
    this.logger.log('Starting goal escalation check...');
    const now = new Date();
    const utcToday = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );

    const overdueGoals = await this.prisma.learningGoal.findMany({
      where: {
        status: {
          notIn: [
            ProgressStatus.completed,
            ProgressStatus.skipped,
            ProgressStatus.dropped,
            ProgressStatus.reviewed,
          ],
        },
        targetDate: { lt: utcToday },
      },
      include: { user: true },
    });

    for (const goal of overdueGoals) {
      const targetDate = goal.targetDate;
      if (!targetDate) continue;

      const targetDay = Date.UTC(
        targetDate.getUTCFullYear(),
        targetDate.getUTCMonth(),
        targetDate.getUTCDate(),
      );
      const daysOverdue = Math.floor(
        (utcToday.getTime() - targetDay) / (24 * 60 * 60 * 1000),
      );

      let nextLevel = goal.escalationLevel;

      if (daysOverdue >= 7 && goal.escalationLevel < 3) {
        nextLevel = 3;
        await this.escalateTier3(goal, targetDate);
      } else if (daysOverdue >= 3 && goal.escalationLevel < 2) {
        nextLevel = 2;
        await this.escalateTier2(goal, targetDate);
      } else if (daysOverdue >= 0 && goal.escalationLevel < 1) {
        nextLevel = 1;
        await this.escalateTier1(goal, targetDate);
      }

      if (nextLevel !== goal.escalationLevel) {
        await this.prisma.learningGoal.update({
          where: { id: goal.id },
          data: {
            escalationLevel: nextLevel,
            lastEscalatedAt: now,
          },
        });
      }
    }
    this.logger.log(
      `Escalation check complete for ${overdueGoals.length} goals.`,
    );
  }

  private async escalateTier1(goal: LearningGoal, targetDate: Date) {
    this.logger.log(
      `Tier 1 Escalation: Push for user ${goal.userId}, goal ${goal.id}`,
    );
    await this.notifications.create(
      goal.userId,
      `Goal Overdue: ${goal.title}`,
      'warning',
      {
        goalId: goal.id,
        tier: 1,
      },
      NotificationPriority.high,
      true,
      `goal-overdue:${goal.id}:${targetDate.toISOString()}:tier:1`,
    );
  }

  private async escalateTier2(goal: LearningGoal, targetDate: Date) {
    this.logger.log(
      `Tier 2 Escalation: Email for user ${goal.userId}, goal ${goal.id}`,
    );
    await this.notifications.create(
      goal.userId,
      `Urgent: Goal ${goal.title} is 3 days overdue`,
      'error',
      {
        goalId: goal.id,
        tier: 2,
        channel: 'email',
      },
      NotificationPriority.urgent,
      true,
      `goal-overdue:${goal.id}:${targetDate.toISOString()}:tier:2`,
    );
  }

  private async escalateTier3(goal: LearningGoal, targetDate: Date) {
    this.logger.log(
      `Tier 3 Escalation: Instructor Alert for user ${goal.userId}, goal ${goal.id}`,
    );
    await this.notifications.create(
      goal.userId,
      `Final Alert: Goal ${goal.title} is 7 days overdue. Instructor has been notified.`,
      'error',
      {
        goalId: goal.id,
        tier: 3,
        alertInstructor: true,
      },
      NotificationPriority.urgent,
      true,
      `goal-overdue:${goal.id}:${targetDate.toISOString()}:tier:3`,
    );
  }
}
