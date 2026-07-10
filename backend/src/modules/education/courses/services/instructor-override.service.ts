// FEED-002: Instructor Override Authority
// Instructors can hide, mark irrelevant, or update explanations for questions.
// All actions are audit-logged and affected students are notified.

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '#infrastructure/prisma/prisma.service';
import { getErrorMessage } from '#common/utils/error.utils';

export type OverrideAction = 'hide' | 'mark_irrelevant' | 'update_explanation';

export interface ApplyOverrideDto {
  instructorId: string;
  questionId: string;
  action: OverrideAction;
  reason?: string;
  newExplanation?: string;
}

@Injectable()
export class InstructorOverrideService {
  private readonly logger = new Logger(InstructorOverrideService.name);

  constructor(private readonly prisma: PrismaService) {}

  async applyOverride(dto: ApplyOverrideDto): Promise<void> {
    // Log the override
    await this.prisma.instructorOverride.create({
      data: {
        instructorId: dto.instructorId,
        questionId: dto.questionId,
        action: dto.action,
        reason: dto.reason,
      },
    });

    // Apply the action
    switch (dto.action) {
      case 'hide':
        await this.prisma.question.update({
          where: { id: dto.questionId },
          data: { isActive: false },
        });
        await this.notifyAffectedStudents(
          dto.questionId,
          'removed from the question bank',
        );
        break;

      case 'mark_irrelevant':
        await this.prisma.question.update({
          where: { id: dto.questionId },
          data: {
            metadata: { irrelevant: true, markedAt: new Date().toISOString() },
          },
        });
        break;

      case 'update_explanation':
        if (dto.newExplanation) {
          await this.prisma.question.update({
            where: { id: dto.questionId },
            data: { explanation: dto.newExplanation },
          });
          await this.notifyAffectedStudents(
            dto.questionId,
            'had its explanation updated by an instructor',
          );
        }
        break;
    }

    this.logger.log(
      `Instructor ${dto.instructorId} applied "${dto.action}" to question ${dto.questionId}.`,
    );
  }

  /**
   * Notify students who answered this question that it was modified.
   */
  private async notifyAffectedStudents(
    questionId: string,
    actionDescription: string,
  ): Promise<void> {
    try {
      const affectedUsers = await this.prisma.userResponse.findMany({
        where: { questionId },
        select: { userId: true },
        distinct: ['userId'],
        take: 100, // Cap to avoid mass notifications
      });

      for (const { userId } of affectedUsers) {
        await (this.prisma as any).notification.create({
          data: {
            userId,
            message: `A question you previously answered has been ${actionDescription}. Your past score is unaffected.`,
            type: 'instructor_override',
            severity: 'suggestion',
            metadata: { questionId },
          },
        });
      }
    } catch (error) {
      this.logger.error(`Failed to notify students: ${getErrorMessage(error)}`);
    }
  }

  async getOverridesForQuestion(questionId: string) {
    return this.prisma.instructorOverride.findMany({
      where: { questionId },
      orderBy: { appliedAt: 'desc' },
    });
  }
}
