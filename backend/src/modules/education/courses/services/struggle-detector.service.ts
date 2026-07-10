import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '#infrastructure/prisma/prisma.service';
import {
  EngagementScorerService,
  EngagementMetrics,
} from './engagement-scorer.service';

export enum StruggleSeverity {
  LOW = 'LOW',
  MODERATE = 'MODERATE',
  SEVERE = 'SEVERE',
}

@Injectable()
export class StruggleDetectorService {
  private readonly logger = new Logger(StruggleDetectorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly engagementScorer: EngagementScorerService,
  ) {}

  /**
   * Detects student struggle based on engagement metrics and triggers appropriate interventions.
   */
  async detectStruggle(
    userId: string,
    materialId: string,
    metrics: EngagementMetrics,
  ): Promise<StruggleSeverity | null> {
    const score = await this.engagementScorer.calculateScore(
      materialId,
      metrics,
    );

    // Heuristics for struggle detection
    if (score < 0.3) {
      this.logger.warn(
        `Severe struggle detected for user ${userId} on material ${materialId}. Score: ${score}`,
      );
      await this.triggerIntervention(
        userId,
        materialId,
        StruggleSeverity.SEVERE,
      );
      return StruggleSeverity.SEVERE;
    }

    if (score < 0.6) {
      this.logger.log(
        `Moderate struggle detected for user ${userId} on material ${materialId}. Score: ${score}`,
      );
      await this.triggerIntervention(
        userId,
        materialId,
        StruggleSeverity.MODERATE,
      );
      return StruggleSeverity.MODERATE;
    }

    return null;
  }

  private async triggerIntervention(
    userId: string,
    materialId: string,
    severity: StruggleSeverity,
  ): Promise<void> {
    const material = await this.prisma.material.findUnique({
      where: { id: materialId },
      select: { title: true },
    });

    const materialTitle = material?.title || 'this material';

    if (severity === StruggleSeverity.SEVERE) {
      // Instant Push Notification (Simulated for now via Logger/Notification table)
      await this.prisma.notification.create({
        data: {
          userId,
          message: `Struggling with your studies? It seems you're having a hard time with "${materialTitle}". Would you like to try an alternative format or schedule a tutoring session?`,
          type: 'STRUGGLE_INTERVENTION_SEVERE',
          priority: 'high',
        },
      });
    } else if (severity === StruggleSeverity.MODERATE) {
      // Daily Digest Queue (Simulated via a flag or logging for a job to pick up)
      await this.prisma.notification.create({
        data: {
          userId,
          message: `Review Suggestion: You spent some time on "${materialTitle}" but might benefit from a quick review. Check out these related summaries.`,
          type: 'STRUGGLE_INTERVENTION_MODERATE',
          priority: 'medium',
        },
      });
    }
  }

  /**
   * Periodic job to process moderate struggle items (to be called by a CRON job).
   */
  async processDailyDigests(): Promise<void> {
    // Logic to aggregate moderate struggles into a daily digest
    this.logger.log('Processing daily digests for moderate struggles...');
  }
}
