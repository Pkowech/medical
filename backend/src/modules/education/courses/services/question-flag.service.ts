// FEED-001: Student Question Flagging
// Allows students to flag problematic quiz questions. Auto-flags to instructor when 5+ flags share the same issue.

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '#infrastructure/prisma/prisma.service';
import { getErrorMessage } from '#common/utils/error.utils';

export type FlagIssueType =
  | 'ambiguous'
  | 'incorrect'
  | 'outdated'
  | 'inappropriate';

export interface CreateFlagDto {
  questionId: string;
  userId: string;
  issue: FlagIssueType;
  description?: string;
}

const AUTO_FLAG_THRESHOLD = 5;

@Injectable()
export class QuestionFlagService {
  private readonly logger = new Logger(QuestionFlagService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createFlag(dto: CreateFlagDto): Promise<void> {
    // Prevent duplicate flags from same user on same question with same issue
    const existing = await this.prisma.questionFlag.findFirst({
      where: {
        questionId: dto.questionId,
        userId: dto.userId,
        issueType: dto.issue,
      },
    });

    if (existing) {
      return;
    }

    await this.prisma.questionFlag.create({
      data: {
        questionId: dto.questionId,
        userId: dto.userId,
        issueType: dto.issue,
        description: dto.description,
      },
    });

    // Check if auto-flag threshold reached
    await this.checkAutoFlag(dto.questionId, dto.issue);
  }

  async getFlagsForQuestion(questionId: string) {
    return this.prisma.questionFlag.findMany({
      where: { questionId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * If 5+ flags share the same issue for a question, notify instructors.
   */
  private async checkAutoFlag(
    questionId: string,
    issue: FlagIssueType,
  ): Promise<void> {
    try {
      const count = await this.prisma.questionFlag.count({
        where: { questionId, issueType: issue },
      });

      if (count < AUTO_FLAG_THRESHOLD) {
        return;
      }

      const question = await this.prisma.question.findUnique({
        where: { id: questionId },
        select: { text: true, courseId: true },
      });

      if (!question) {
        return;
      }

      // Find instructors of the course this question belongs to
      const instructors = question.courseId
        ? await this.prisma.courseInstructor.findMany({
            where: { courseId: question.courseId },
            select: { userId: true },
            take: 5,
          })
        : [];

      const preview = question.text.substring(0, 80);

      for (const instructor of instructors) {
        await (this.prisma as any).notification.create({
          data: {
            userId: instructor.userId,
            message: `⚠️ Question flagged ${count}x for "${issue}": "${preview}...". Please review.`,
            type: 'question_flag_alert',
            severity: 'important',
            metadata: { questionId, issue, flagCount: count },
          },
        });
      }

      this.logger.warn(
        `Question ${questionId} auto-flagged for "${issue}" after ${count} reports.`,
      );
    } catch (error) {
      this.logger.error(`Auto-flag check failed: ${getErrorMessage(error)}`);
    }
  }
}
