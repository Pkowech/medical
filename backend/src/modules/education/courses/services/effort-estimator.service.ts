import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ProgressService } from './progress.service';

@Injectable()
export class EffortEstimatorService {
  private readonly logger = new Logger(EffortEstimatorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly progressService: ProgressService,
  ) {}

  /**
   * Calculates dynamic effort estimation for a goal.
   * Formula: course.estimatedHours * (1 - progress) * (1 + (1 - avgScore/100) * 0.3)
   */
  async calculateRemainingEffort(
    userId: string,
    courseId: string,
  ): Promise<number> {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: { estimatedHours: true },
    });

    const progress = await this.progressService.calculateCourseProgress(
      userId,
      courseId,
    );

    if (!course) {
      return 0;
    }

    const estimatedHours = course.estimatedHours || 0;
    const progressValue = (progress?.percentage || 0) / 100;

    // Calculate average score for the user in this course
    const avgScore = await this.calculateCourseAvgScore(userId, courseId);

    // Dynamic Effort Formula
    return (
      estimatedHours * (1 - progressValue) * (1 + (1 - avgScore / 100) * 0.3)
    );
  }

  private async calculateCourseAvgScore(
    userId: string,
    courseId: string,
  ): Promise<number> {
    const attempts = await this.prisma.quizAttempt.findMany({
      where: {
        userId,
        quiz: {
          unit: {
            courseId,
          },
        },
      },
      select: { percentage: true },
    });

    if (attempts.length === 0) {
      return 70;
    } // Fallback to 70% if no data

    const sum = attempts.reduce((acc, curr) => acc + curr.percentage, 0);
    return sum / attempts.length;
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT) // More regular for active learning
  async handleDailyRecalculation() {
    this.logger.log('Starting daily dynamic effort recalculation...');
    try {
      const activeGoals = await this.prisma.learningGoal.findMany({
        where: { status: 'active' },
      });

      for (const goal of activeGoals) {
        if (!goal.courseId) {
          continue;
        }

        const remainingEffort = await this.calculateRemainingEffort(
          goal.userId,
          goal.courseId,
        );

        await this.prisma.learningGoal.update({
          where: { id: goal.id },
          data: { estimatedRemainingHours: remainingEffort },
        });
      }
      this.logger.log(
        `Recalculation complete for ${activeGoals.length} goals.`,
      );
    } catch (error) {
      this.logger.error('Error in handleDailyRecalculation:', error);
    }
  }
}
