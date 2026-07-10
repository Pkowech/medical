import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NotificationsService } from '#modules/engagement-communication/services/notifications.service';
import { ProgressStatus, LearningGoal } from '@prisma/client';

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

    const overdueGoals = await this.prisma.learningGoal.findMany({
      where: {
        status: { not: ProgressStatus.completed },
        targetDate: { lt: now },
      },
      include: { user: true },
    });

    for (const goal of overdueGoals) {
      const daysOverdue = Math.floor(
        (now.getTime() - (goal.targetDate?.getTime() || now.getTime())) /
          (1000 * 60 * 60 * 24),
      );

      let nextLevel = goal.escalationLevel;

      if (daysOverdue >= 7 && goal.escalationLevel < 3) {
        nextLevel = 3;
        await this.escalateTier3(goal);
      } else if (daysOverdue >= 3 && goal.escalationLevel < 2) {
        nextLevel = 2;
        await this.escalateTier2(goal);
      } else if (daysOverdue >= 0 && goal.escalationLevel < 1) {
        nextLevel = 1;
        await this.escalateTier1(goal);
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

  private async escalateTier1(goal: LearningGoal) {
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
    );
  }

  private async escalateTier2(goal: LearningGoal) {
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
    );
  }

  private async escalateTier3(goal: LearningGoal) {
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
    );
  }
}
