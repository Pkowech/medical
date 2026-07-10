// LONG-001: Longitudinal Skill Trajectory
// Snapshots BKT p_known over time to detect chronic weaknesses and trend direction.

import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '#infrastructure/prisma/prisma.service';
import { getErrorMessage } from '#common/utils/error.utils';

export interface WeaknessChain {
  weakTopicId: string;
  weakTopicName: string;
  pKnown: number;
  daysBelowThreshold: number;
  dependentTopics: { id: string; name: string }[];
  riskLevel: 'low' | 'medium' | 'high';
}

@Injectable()
export class SkillTrajectoryService {
  private readonly logger = new Logger(SkillTrajectoryService.name);
  private readonly WEAK_THRESHOLD = 0.7;
  private readonly CHRONIC_DAYS = 365;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Snapshot current p_known for a user's topic.
   * Called after each BKT update in prescriptive-analytics.service.ts
   */
  async snapshotSkillState(
    userId: string,
    topicId: string,
    pKnown: number,
  ): Promise<void> {
    try {
      // Calculate trend from recent snapshots
      const recentSnapshots = await this.prisma.skillTrajectory.findMany({
        where: { userId, topicId },
        orderBy: { snapshotAt: 'desc' },
        take: 3,
      });

      let trend: 'improving' | 'stable' | 'declining' = 'stable';
      if (recentSnapshots.length >= 2) {
        const oldest = recentSnapshots[recentSnapshots.length - 1].pKnown;
        const delta = pKnown - oldest;
        if (delta > 0.05) {
          trend = 'improving';
        } else if (delta < -0.05) {
          trend = 'declining';
        }
      }

      await this.prisma.skillTrajectory.create({
        data: { userId, topicId, pKnown, trend },
      });
    } catch (error) {
      this.logger.warn(
        `Failed to snapshot skill state for user ${userId}, topic ${topicId}: ${getErrorMessage(error)}`,
      );
    }
  }

  /**
   * LONG-001: Detect chronic weaknesses — topics with p_known < 0.7 for > 1 year
   */
  async detectChronicWeaknesses(userId: string): Promise<WeaknessChain[]> {
    const oneYearAgo = new Date(
      Date.now() - this.CHRONIC_DAYS * 24 * 60 * 60 * 1000,
    );

    // Find topics that have been consistently weak
    const weakStates = await this.prisma.userSkillState.findMany({
      where: {
        userId,
        pKnown: { lt: this.WEAK_THRESHOLD },
      },
      include: {
        // Join to get topic name via skill_id = topic_id
        // UserSkillState.skillId maps to Topic.id
      },
    });

    if (weakStates.length === 0) {
      return [];
    }

    const weakTopicIds = weakStates.map((s) => s.skillId);

    // Check if these topics have been weak for a long time (first snapshot before 1 year ago)
    const chronicallyWeak: WeaknessChain[] = [];

    for (const state of weakStates) {
      const firstWeakSnapshot = await this.prisma.skillTrajectory.findFirst({
        where: {
          userId,
          topicId: state.skillId,
          pKnown: { lt: this.WEAK_THRESHOLD },
          snapshotAt: { lte: oneYearAgo },
        },
        orderBy: { snapshotAt: 'asc' },
      });

      if (!firstWeakSnapshot) {
        continue;
      }

      const daysBelowThreshold = Math.round(
        (Date.now() - firstWeakSnapshot.snapshotAt.getTime()) /
          (1000 * 60 * 60 * 24),
      );

      // LONG-002: Find downstream dependent topics (same unit, higher order)
      const topic = await this.prisma.topic.findUnique({
        where: { id: state.skillId },
        select: { name: true, order: true, unitId: true },
      });

      if (!topic) {
        continue;
      }

      const dependentTopics = await this.prisma.topic.findMany({
        where: {
          unitId: topic.unitId,
          order: { gt: topic.order },
        },
        select: { id: true, name: true },
        take: 3,
      });

      const riskLevel =
        state.pKnown < 0.3 ? 'high' : state.pKnown < 0.5 ? 'medium' : 'low';

      chronicallyWeak.push({
        weakTopicId: state.skillId,
        weakTopicName: topic.name,
        pKnown: state.pKnown,
        daysBelowThreshold,
        dependentTopics,
        riskLevel,
      });
    }

    return chronicallyWeak;
  }

  /**
   * Weekly snapshot job — takes p_known snapshots for all active users.
   * Runs every Sunday at 2 AM.
   */
  @Cron('0 2 * * 0')
  async weeklySnapshotJob(): Promise<void> {
    this.logger.log('Running weekly skill trajectory snapshot job...');
    try {
      const skillStates = await this.prisma.userSkillState.findMany({
        select: { userId: true, skillId: true, pKnown: true },
      });

      for (const state of skillStates) {
        await this.snapshotSkillState(
          state.userId,
          state.skillId,
          state.pKnown,
        );
      }

      this.logger.log(`Snapshotted ${skillStates.length} skill states.`);
    } catch (error) {
      this.logger.error(
        `Weekly snapshot job failed: ${getErrorMessage(error)}`,
      );
    }
  }
}
