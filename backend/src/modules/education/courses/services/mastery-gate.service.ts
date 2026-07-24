// src/modules/education/courses/services/mastery-gate.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '#infrastructure/prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { getErrorMessage } from '#common/utils/error.utils';
import {
  ReadinessSignal,
  MasteryStatus,
  QuizCompletionResult,
  GateDecision,
} from '../types/mastery.types';
import { ProgressStatus } from '@prisma/client';
import { PrescriptiveAnalyticsService } from '../../../ai-analytics/services/prescriptive-analytics.service';

export { ReadinessSignal, MasteryStatus, QuizCompletionResult };

@Injectable()
export class MasteryGateService {
  private readonly logger = new Logger(MasteryGateService.name);
  private readonly PASSING_THRESHOLD = 70; // Default passing threshold percentage

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly prescriptiveAnalytics: PrescriptiveAnalyticsService,
  ) {}

  /**
   * Check mastery status for a user on a specific topic
   */
  async checkMasteryStatus(
    userId: string,
    topicId: string,
  ): Promise<MasteryStatus> {
    try {
      const progress = await this.prisma.progress.findFirst({
        where: { userId, topicId },
      });

      if (!progress) {
        return {
          userId,
          topicId,
          masteryUnlocked: false,
          failedAttempts: 0,
          isEligibleForNextTopic: false,
          readinessSignal: 'NOT_READY',
        };
      }

      let readinessSignal: ReadinessSignal = 'NOT_READY';
      if (progress.progressPercentage >= this.PASSING_THRESHOLD) {
        readinessSignal = 'SAFE';
      } else if (progress.progressPercentage >= 50) {
        readinessSignal = 'BORDERLINE';
      }

      return {
        userId,
        topicId,
        masteryUnlocked: progress.status === 'completed',
        failedAttempts: 0, // Not tracking failed attempts in Progress model currently
        isEligibleForNextTopic: progress.status === 'completed',
        readinessSignal,
      };
    } catch (error) {
      this.logger.error(
        `Error checking mastery status for user ${userId}, topic ${topicId}: ${getErrorMessage(error)}`,
      );
      throw error;
    }
  }

  /**
   * Handle quiz completion - update mastery status based on pass/fail
   */
  async onQuizComplete(
    userId: string,
    topicId: string,
    isPassed: boolean,
    score: number,
    passingThreshold?: number,
  ): Promise<QuizCompletionResult> {
    const threshold = passingThreshold ?? this.PASSING_THRESHOLD;

    try {
      // Get or create progress record
      let progress = await this.prisma.progress.findFirst({
        where: { userId, topicId },
      });

      if (!progress) {
        progress = await this.prisma.progress.create({
          data: {
            userId,
            topicId,
            materialId: null as any,
            unitId: null as any,
            courseId: null as any,
            status: ProgressStatus.inProgress,
          },
        });
      }

      const _previousMastery = progress.status === 'completed';

      if (isPassed) {
        // Quiz passed - unlock mastery
        const updateData: any = {
          lastUpdated: new Date(),
          progressPercentage: Math.max(
            progress?.progressPercentage || 0,
            score || 0,
          ),
          quizScores: {
            ...((progress.quizScores as object) || {}),
            lastScore: score,
            passedAt: new Date().toISOString(),
          },
          status: 'completed',
          isCompleted: true,
          completedAt: new Date(),
        };

        await this.prisma.progress.update({
          where: { id: progress.id },
          data: updateData,
        });

        // Emit xAPI statement for pass
        this.eventEmitter.emit('xapi.statement', {
          actor: { userId },
          verb: 'passed',
          object: { type: 'topic', id: topicId },
          result: { score: { scaled: score / 100 }, success: true },
          timestamp: new Date().toISOString(),
        });

        // Evaluate prescriptive analytics gate (BKT p_known)
        const gateDecision = await this.prescriptiveAnalytics.evaluateGates(
          userId,
          topicId,
        );

        // Architecture Decision: Prescriptive analytics has authority.
        // Even if quiz is passed, if p_known < threshold, we can block unlocking of NEXT topic.
        let nextTopicUnlocked = false;
        let nextTopicId: string | undefined;
        let message = `Congratulations! You've mastered this topic with a score of ${score}%.`;

        if (gateDecision.canProceed) {
          // Try to unlock next topic
          const nextTopicResult = await this.unlockNextTopic(userId, topicId);
          nextTopicUnlocked = nextTopicResult.unlocked;
          nextTopicId = nextTopicResult.nextTopicId;
        } else {
          message = `You passed the quiz, but your predicted knowledge state (${(gateDecision.pKnown * 100).toFixed(1)}%) is below the mastery threshold. Reviewing additional materials is recommended before proceeding.`;
        }

        this.logger.log(
          `User ${userId} passed quiz for topic ${topicId} with score ${score}%. Gate: ${gateDecision.canProceed ? 'OPEN' : 'BLOCKED'} (pKnown: ${gateDecision.pKnown})`,
        );

        return {
          topicId,
          masteryUnlocked: true,
          failedAttempts: 0,
          nextTopicUnlocked,
          nextTopicId,
          message,
          gateDecision,
        };
      } else {
        // Quiz failed - increment failed attempts (only in logs/memory)
        const newFailedAttempts = (progress.quizScores)?.lastScore
          ? 1
          : 1;

        const updateData: any = {
          // failedAttempts not stored in DB
          quizScores: {
            ...((progress.quizScores as object) || {}),
            lastScore: score,
            lastAttemptAt: new Date().toISOString(),
          },
          lastUpdated: new Date(),
        };

        await this.prisma.progress.update({
          where: { id: progress.id },
          data: updateData,
        });

        // Emit xAPI statement for fail
        this.eventEmitter.emit('xapi.statement', {
          actor: { userId },
          verb: 'failed',
          object: { type: 'topic', id: topicId },
          result: { score: { scaled: score / 100 }, success: false },
          timestamp: new Date().toISOString(),
        });

        this.logger.log(
          `User ${userId} failed quiz for topic ${topicId} with score ${score}% (attempt ${newFailedAttempts})`,
        );

        return {
          topicId,
          masteryUnlocked: false,
          failedAttempts: newFailedAttempts,
          nextTopicUnlocked: false,
          message: `You scored ${score}%, but need ${threshold}% to pass. Review the material and try again. Attempt ${newFailedAttempts}.`,
        };
      }
    } catch (error) {
      this.logger.error(
        `Error processing quiz completion for user ${userId}, topic ${topicId}: ${getErrorMessage(error)}`,
      );
      throw error;
    }
  }

  /**
   * Unlock the next topic in sequence after mastering current topic
   */
  async unlockNextTopic(
    userId: string,
    currentTopicId: string,
  ): Promise<{ unlocked: boolean; nextTopicId?: string }> {
    try {
      // Get the current topic to find its unit and order
      const currentTopic = await this.prisma.topic.findUnique({
        where: { id: currentTopicId },
        include: { unit: true },
      });

      if (!currentTopic || !currentTopic.unitId) {
        return { unlocked: false };
      }

      // Find the next topic in the same unit by order
      const nextTopic = await this.prisma.topic.findFirst({
        where: {
          unitId: currentTopic.unitId,
          order: { gt: currentTopic.order },
        },
        orderBy: { order: 'asc' },
      });

      if (!nextTopic) {
        // No more topics in this unit - check if we should unlock next unit
        this.logger.log(
          `No more topics in unit ${currentTopic.unitId} after topic ${currentTopicId}`,
        );
        return { unlocked: false };
      }

      // Create or update progress for next topic to make it accessible
      // We use findFirst instead of upsert to avoid issues with null materialId in unique constraints
      const nextProgress = await this.prisma.progress.findFirst({
        where: {
          userId,
          topicId: nextTopic.id,
          materialId: null,
        },
      });

      if (!nextProgress) {
        await this.prisma.progress.create({
          data: {
            userId,
            topicId: nextTopic.id,
            materialId: null as any,
            unitId: null as any,
            courseId: null as any,
            status: ProgressStatus.notStarted,
            // masteryUnlocked and failedAttempts removed
          },
        });
      } else {
        await this.prisma.progress.update({
          where: { id: nextProgress.id },
          data: {
            lastAccessedAt: new Date(),
          },
        });
      }

      this.logger.log(
        `Unlocked next topic ${nextTopic.id} for user ${userId} after mastering ${currentTopicId}`,
      );

      return { unlocked: true, nextTopicId: nextTopic.id };
    } catch (error) {
      this.logger.error(
        `Error unlocking next topic for user ${userId} after ${currentTopicId}: ${getErrorMessage(error)}`,
      );
      return { unlocked: false };
    }
  }

  /**
   * Reset topic progress (for retaking after failure)
   */
  async resetTopicProgress(userId: string, topicId: string): Promise<void> {
    try {
      await this.prisma.progress.updateMany({
        where: { userId, topicId },
        data: {
          progressPercentage: 0,
          status: ProgressStatus.inProgress,
          isCompleted: false,
          completedAt: null,
          // Don't reset masteryUnlocked or failedAttempts - keep history
        },
      });

      this.logger.log(`Reset progress for user ${userId} on topic ${topicId}`);
    } catch (error) {
      this.logger.error(
        `Error resetting topic progress for user ${userId}, topic ${topicId}: ${getErrorMessage(error)}`,
      );
      throw error;
    }
  }

  /**
   * Check if user can start a quiz for a topic (based on prerequisites)
   * This is a soft check - returns recommendation, doesn't block
   */
  async canStartQuiz(
    userId: string,
    topicId: string,
  ): Promise<{ allowed: boolean; recommendation?: string }> {
    try {
      // Get the topic and its order
      const topic = await this.prisma.topic.findUnique({
        where: { id: topicId },
        include: { unit: true },
      });

      if (!topic || !topic.unitId) {
        return { allowed: true };
      }

      // Check if there's a previous topic in the same unit
      const previousTopic = await this.prisma.topic.findFirst({
        where: {
          unitId: topic.unitId,
          order: { lt: topic.order },
        },
        orderBy: { order: 'desc' },
      });

      if (!previousTopic) {
        // This is the first topic - always allowed
        return { allowed: true };
      }

      // Check if previous topic has mastery
      const previousProgress = await this.prisma.progress.findFirst({
        where: { userId, topicId: previousTopic.id },
      });

      if (previousProgress?.status !== 'completed') {
        return {
          allowed: true, // Soft check - don't block
          recommendation: `Consider completing "${previousTopic.name}" first to build foundational knowledge.`,
        };
      }

      return { allowed: true };
    } catch (error) {
      this.logger.error(
        `Error checking quiz eligibility for user ${userId}, topic ${topicId}: ${getErrorMessage(error)}`,
      );
      return { allowed: true }; // Default to allowed on error
    }
  }

  /**
   * Validate concurrent unit limit (max 4-5 active units)
   */
  async validateConcurrentUnitLimit(
    userId: string,
    maxConcurrent: number = 4,
  ): Promise<{ allowed: boolean; currentActive: number; message?: string }> {
    try {
      const activeUnits = await this.prisma.progress.count({
        where: {
          userId,
          unitId: { not: null },
          status: ProgressStatus.inProgress,
        },
      });

      if (activeUnits >= maxConcurrent) {
        return {
          allowed: false,
          currentActive: activeUnits,
          message: `You already have ${activeUnits} active units. Complete one before starting another.`,
        };
      }

      return { allowed: true, currentActive: activeUnits };
    } catch (error) {
      this.logger.error(
        `Error validating concurrent unit limit for user ${userId}: ${getErrorMessage(error)}`,
      );
      return { allowed: true, currentActive: 0 }; // Default to allowed on error
    }
  }

  /**
   * Activate a unit with concurrent slot assignment
   */
  async activateUnit(
    userId: string,
    unitId: string,
    maxConcurrent: number = 4,
  ): Promise<{ success: boolean; slotNumber?: number; message?: string }> {
    try {
      const validation = await this.validateConcurrentUnitLimit(
        userId,
        maxConcurrent,
      );

      if (!validation.allowed) {
        return { success: false, message: validation.message };
      }

      // Check for active slots
      const activeSlots = await this.prisma.progress.findMany({
        where: {
          userId,
          status: ProgressStatus.inProgress,
          unitId: { not: null }, // Ensure it's a unit progress record
        },
        select: {
          unitId: true,
        },
      });

      const activeCount = activeSlots.length;
      const activeUnitIds = activeSlots.map((slot) => slot.unitId);

      // Find next available slot (conceptually, as we don't store slot numbers)
      // This logic is more about counting active units than assigning a specific slot number
      const nextSlot = 1; // Placeholder, as actual slot numbers are not stored

      // Assuming MAX_CONCURRENT_UNITS is a class property (it's not defined, using maxConcurrent from parameter)
      // The instruction snippet has a nested if, which seems like a copy-paste error.
      // I'm interpreting it as a single check for the free tier limit, and then a potential premium limit.
      if (activeCount >= maxConcurrent) {
        // Using maxConcurrent from parameter
        // This block should ideally not be reached if validation.allowed is false
        // but keeping it for robustness based on the original intent.
        // If there were different limits for premium, that logic would go here.
        return {
          success: false,
          message: `Max concurrent units reached (${maxConcurrent} units).`,
        };
      }

      // Create or update progress record for the unit activation itself
      // We use findFirst to check if a specific unit-activation record exists
      const existing = await this.prisma.progress.findFirst({
        where: {
          userId,
          unitId,
          topicId: null,
          materialId: null,
        },
      });

      if (existing) {
        await this.prisma.progress.update({
          where: { id: existing.id },
          data: {
            status: ProgressStatus.inProgress,
            startedAt: new Date(),
          },
        });
      } else {
        await this.prisma.progress.create({
          data: {
            userId,
            unitId,
            topicId: null,
            materialId: null,
            status: ProgressStatus.inProgress,
            startedAt: new Date(),
          },
        });
      }

      this.logger.log(
        `Activated unit ${unitId} for user ${userId} in slot ${nextSlot}`,
      );

      return { success: true, slotNumber: nextSlot };
    } catch (error) {
      this.logger.error(
        `Error activating unit ${unitId} for user ${userId}: ${getErrorMessage(error)}`,
      );
      throw error;
    }
  }
}
