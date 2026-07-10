import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '#infrastructure/prisma/prisma.service';

export interface EngagementMetrics {
  timeSpentSeconds: number; // Max score if >= recommendedDuration
  scrollPercentage: number; // 0-100
  questionsAttempted: number; // Count of questions answered in session
  notesCreated: boolean; // Whether notes were created
}

@Injectable()
export class EngagementScorerService {
  private readonly logger = new Logger(EngagementScorerService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Calculates a multi-signal engagement score (0-1).
   * Formula: time(0.3) + scroll(0.2) + quiz(0.4) + notes(0.1)
   */
  async calculateScore(
    materialId: string,
    metrics: EngagementMetrics,
  ): Promise<number> {
    const material = await this.prisma.material.findUnique({
      where: { id: materialId },
      select: { duration: true },
    });

    const recommendedDuration = (material?.duration || 5) * 60; // Default 5 mins in seconds

    // 1. Time Score (0.3)
    const timeScore =
      Math.min(metrics.timeSpentSeconds / recommendedDuration, 1) * 0.3;

    // 2. Scroll Score (0.2)
    const scrollScore = (metrics.scrollPercentage / 100) * 0.2;

    // 3. Quiz/Activity Score (0.4)
    // Assume 1+ question attempted is full score for this component in a study session
    const quizScore = metrics.questionsAttempted > 0 ? 0.4 : 0;

    // 4. Notes Score (0.1)
    const notesScore = metrics.notesCreated ? 0.1 : 0;

    const totalScore = timeScore + scrollScore + quizScore + notesScore;

    this.logger.log(
      `Calculated engagement score for material ${materialId}: ${totalScore.toFixed(2)}`,
      {
        metrics,
        components: { timeScore, scrollScore, quizScore, notesScore },
      },
    );

    return parseFloat(totalScore.toFixed(4));
  }

  /**
   * Saves the engagement score for a user and material.
   */
  async recordEngagement(
    userId: string,
    materialId: string,
    metrics: EngagementMetrics,
  ): Promise<void> {
    const score = await this.calculateScore(materialId, metrics);

    await this.prisma.materialEngagement.upsert({
      where: {
        userId_materialId: { userId, materialId },
      },
      update: {
        engagementScore: score,
        components: metrics as any,
      },
      create: {
        userId,
        materialId,
        engagementScore: score,
        components: metrics as any,
      },
    });
  }
}
