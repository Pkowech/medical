// COMP-001: Completion with Decay
// Calculates time-adjusted competence using exponential decay model.
// Formula: currentCompetence = p_known * exp(-decayRate * daysSinceReview)

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '#infrastructure/prisma/prisma.service';

export interface CompetenceResult {
  topicId: string;
  pKnown: number;
  currentCompetence: number;
  daysSinceReview: number;
  isFading: boolean;
  decayWarning?: string;
}

@Injectable()
export class CompetenceCalculatorService {
  private readonly logger = new Logger(CompetenceCalculatorService.name);

  /**
   * Default decay rate: ~0.7% per day
   * At this rate: 100 days → ~50% decay, 200 days → ~25% of original confidence
   */
  private readonly DEFAULT_DECAY_RATE = 0.007;

  /**
   * Mastery fading threshold — warn when competence drops below this
   */
  private readonly FADING_THRESHOLD = 0.7;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Calculate current competence with decay applied.
   * Never marks "permanently passed" — always applies temporal decay.
   */
  calculateCurrentCompetence(
    pKnown: number,
    lastReviewDate: Date,
    decayRate: number = this.DEFAULT_DECAY_RATE,
  ): number {
    const now = new Date();
    const daysSinceReview =
      (now.getTime() - lastReviewDate.getTime()) / (1000 * 60 * 60 * 24);

    const currentCompetence = pKnown * Math.exp(-decayRate * daysSinceReview);

    // Clamp between 0 and 1
    return Math.max(0, Math.min(1, currentCompetence));
  }

  /**
   * Check if mastery is fading for a given user on a topic.
   * Queries UserSkillState for p_known and last update timestamp.
   */
  async isMasteryFading(
    userId: string,
    topicId: string,
  ): Promise<CompetenceResult | null> {
    try {
      const skillState = await this.prisma.userSkillState.findUnique({
        where: { userId_skillId: { userId, skillId: topicId } },
      });

      if (!skillState) {
        return null;
      }

      const daysSinceReview =
        (Date.now() - skillState.lastUpdated.getTime()) / (1000 * 60 * 60 * 24);

      const currentCompetence = this.calculateCurrentCompetence(
        skillState.pKnown,
        skillState.lastUpdated,
      );

      const isFading = currentCompetence < this.FADING_THRESHOLD;

      return {
        topicId,
        pKnown: skillState.pKnown,
        currentCompetence,
        daysSinceReview: Math.round(daysSinceReview),
        isFading,
        decayWarning: isFading
          ? this.formatDecayWarning(
              Math.round(daysSinceReview),
              currentCompetence,
            )
          : undefined,
      };
    } catch (error) {
      this.logger.warn(
        `Failed to check mastery decay for user ${userId}, topic ${topicId}: ${error}`,
      );
      return null;
    }
  }

  /**
   * Batch check for multiple topics — used in dashboard data fetch.
   */
  async checkFadingTopics(
    userId: string,
    topicIds: string[],
  ): Promise<CompetenceResult[]> {
    const skillStates = await this.prisma.userSkillState.findMany({
      where: { userId, skillId: { in: topicIds } },
    });

    return skillStates.map((state) => {
      const currentCompetence = this.calculateCurrentCompetence(
        state.pKnown,
        state.lastUpdated,
      );
      const daysSinceReview = Math.round(
        (Date.now() - state.lastUpdated.getTime()) / (1000 * 60 * 60 * 24),
      );
      const isFading = currentCompetence < this.FADING_THRESHOLD;

      return {
        topicId: state.skillId,
        pKnown: state.pKnown,
        currentCompetence,
        daysSinceReview,
        isFading,
        decayWarning: isFading
          ? this.formatDecayWarning(daysSinceReview, currentCompetence)
          : undefined,
      };
    });
  }

  private formatDecayWarning(
    daysSinceReview: number,
    currentCompetence: number,
  ): string {
    const competencePercent = Math.round(currentCompetence * 100);
    if (daysSinceReview > 180) {
      return `⚠️ Mastery fading — last reviewed ${daysSinceReview} days ago. Current retention: ${competencePercent}%. Review recommended.`;
    }
    if (daysSinceReview > 60) {
      return `⚠️ Knowledge may be fading — last reviewed ${daysSinceReview} days ago (${competencePercent}% retention). Consider a quick review.`;
    }
    return `Last reviewed ${daysSinceReview} days ago. Current retention: ${competencePercent}%.`;
  }
}
