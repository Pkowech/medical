import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  NotificationPriority,
  QuestionModerationStatus,
} from '@prisma/client';
import { PrismaService } from '#infrastructure/prisma/prisma.service';
import { getErrorMessage } from '#common/utils/error.utils';
import type {
  DecideQuestionModerationDto,
  QuestionFlagIssue,
} from '../dto/question-flag.dto';

export interface CreateFlagDto {
  questionId: string;
  userId: string;
  issue: QuestionFlagIssue;
  description?: string;
}

const AUTO_FLAG_THRESHOLD = 5;

@Injectable()
export class QuestionFlagService {
  private readonly logger = new Logger(QuestionFlagService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createFlag(dto: CreateFlagDto) {
    const questionExists = await this.prisma.question.findUnique({
      where: { id: dto.questionId },
      select: { id: true },
    });

    if (!questionExists) {
      throw new NotFoundException('Question not found.');
    }

    const created = await this.prisma.$transaction(async transaction => {
      const existing = await transaction.questionFlag.findFirst({
        where: {
          questionId: dto.questionId,
          userId: dto.userId,
          issueType: dto.issue,
        },
        select: { id: true },
      });

      if (existing) {
        return false;
      }

      await transaction.questionFlag.create({
        data: {
          questionId: dto.questionId,
          userId: dto.userId,
          issueType: dto.issue,
          description: dto.description,
        },
      });

      let moderationCase = await transaction.questionModerationCase.findUnique({
        where: { questionId: dto.questionId },
        select: { id: true, status: true },
      });

      if (!moderationCase) {
        moderationCase = await transaction.questionModerationCase.upsert({
          where: { questionId: dto.questionId },
          create: { questionId: dto.questionId },
          update: {},
          select: { id: true, status: true },
        });

        const openedEvent = await transaction.questionModerationEvent.findFirst({
          where: { caseId: moderationCase.id, action: 'opened' },
          select: { id: true },
        });

        if (!openedEvent) {
          await transaction.questionModerationEvent.create({
            data: {
              caseId: moderationCase.id,
              actorId: dto.userId,
              action: 'opened',
              toStatus: QuestionModerationStatus.open,
              reason: 'Learner report submitted.',
            },
          });
        }
      } else if (
        moderationCase.status === QuestionModerationStatus.resolved ||
        moderationCase.status === QuestionModerationStatus.dismissed
      ) {
        const reopenResult = await transaction.questionModerationCase.updateMany({
          where: {
            id: moderationCase.id,
            status: moderationCase.status,
          },
          data: {
            status: QuestionModerationStatus.open,
            assignedModeratorId: null,
            resolution: null,
            resolutionNote: null,
            openedAt: new Date(),
            closedAt: null,
          },
        });

        if (reopenResult.count === 1) {
          await transaction.questionModerationEvent.create({
            data: {
              caseId: moderationCase.id,
              actorId: dto.userId,
              action: 'reopened',
              fromStatus: moderationCase.status,
              toStatus: QuestionModerationStatus.open,
              reason: 'A new learner report reopened this question.',
            },
          });
        }
      }

      return true;
    });

    if (created) {
      await this.checkAutoFlag(dto.questionId, dto.issue);
    }

    return { duplicate: !created };
  }

  async getFlagsForQuestion(questionId: string) {
    return this.prisma.questionFlag.findMany({
      where: { questionId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getModerationQueue(
    status?: QuestionModerationStatus,
    includeClosed = false,
  ) {
    const cases = await this.prisma.questionModerationCase.findMany({
      where: status
        ? { status }
        : includeClosed
          ? undefined
          : {
              status: {
                in: [
                  QuestionModerationStatus.open,
                  QuestionModerationStatus.in_review,
                ],
              },
            },
      orderBy: [{ openedAt: 'asc' }],
      take: 100,
      include: {
        question: {
          select: {
            id: true,
            text: true,
            category: true,
            difficulty: true,
            isActive: true,
            updatedAt: true,
            course: { select: { id: true, title: true } },
            unit: { select: { id: true, title: true } },
            questionFlags: {
              orderBy: { createdAt: 'desc' },
              take: 50,
              select: {
                id: true,
                issueType: true,
                description: true,
                createdAt: true,
              },
            },
            _count: { select: { questionFlags: true } },
          },
        },
        assignedModerator: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        events: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          include: {
            actor: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
    });

    return cases.map(({ question, ...moderationCase }) => ({
      ...moderationCase,
      question: {
        ...question,
        flags: question.questionFlags,
        flagCount: question._count.questionFlags,
      },
    }));
  }

  async claimCase(questionId: string, moderatorId: string) {
    return this.prisma.$transaction(async transaction => {
      const moderationCase = await transaction.questionModerationCase.findUnique({
        where: { questionId },
      });

      if (!moderationCase) {
        throw new NotFoundException('Moderation case not found.');
      }

      if (
        moderationCase.status !== QuestionModerationStatus.open &&
        moderationCase.status !== QuestionModerationStatus.in_review
      ) {
        throw new ConflictException('This moderation case is already closed.');
      }

      if (
        moderationCase.status === QuestionModerationStatus.in_review &&
        moderationCase.assignedModeratorId !== moderatorId
      ) {
        throw new ConflictException('This case is assigned to another moderator.');
      }

      if (moderationCase.status === QuestionModerationStatus.in_review) {
        return moderationCase;
      }

      const claimResult = await transaction.questionModerationCase.updateMany({
        where: {
          id: moderationCase.id,
          status: QuestionModerationStatus.open,
        },
        data: {
          status: QuestionModerationStatus.in_review,
          assignedModeratorId: moderatorId,
        },
      });

      if (claimResult.count !== 1) {
        throw new ConflictException('This case was claimed by another moderator.');
      }

      await transaction.questionModerationEvent.create({
        data: {
          caseId: moderationCase.id,
          actorId: moderatorId,
          action: 'claimed',
          fromStatus: moderationCase.status,
          toStatus: QuestionModerationStatus.in_review,
        },
      });

      return transaction.questionModerationCase.findUniqueOrThrow({
        where: { id: moderationCase.id },
      });
    });
  }

  async decideCase(
    questionId: string,
    moderatorId: string,
    decision: DecideQuestionModerationDto,
  ) {
    return this.prisma.$transaction(async transaction => {
      const moderationCase = await transaction.questionModerationCase.findUnique({
        where: { questionId },
      });

      if (!moderationCase) {
        throw new NotFoundException('Moderation case not found.');
      }

      if (moderationCase.status !== QuestionModerationStatus.in_review) {
        throw new ConflictException('Claim the case before recording a decision.');
      }

      if (moderationCase.assignedModeratorId !== moderatorId) {
        throw new ConflictException('Only the assigned moderator can decide this case.');
      }

      if (decision.status === 'resolved' && !decision.resolution) {
        throw new ConflictException('A resolution category is required.');
      }

      const status =
        decision.status === 'resolved'
          ? QuestionModerationStatus.resolved
          : QuestionModerationStatus.dismissed;
      const decisionResult = await transaction.questionModerationCase.updateMany({
        where: {
          id: moderationCase.id,
          status: QuestionModerationStatus.in_review,
          assignedModeratorId: moderatorId,
        },
        data: {
          status,
          resolution: decision.resolution ?? 'dismissed',
          resolutionNote: decision.reason,
          closedAt: new Date(),
        },
      });

      if (decisionResult.count !== 1) {
        throw new ConflictException('This case changed before the decision was saved.');
      }

      if (
        decision.status === 'resolved' &&
        decision.resolution === 'question_withdrawn'
      ) {
        await transaction.question.update({
          where: { id: questionId },
          data: { isActive: false },
        });
      }

      await transaction.questionModerationEvent.create({
        data: {
          caseId: moderationCase.id,
          actorId: moderatorId,
          action: decision.status,
          fromStatus: moderationCase.status,
          toStatus: status,
          reason: decision.reason,
        },
      });

      return transaction.questionModerationCase.findUniqueOrThrow({
        where: { id: moderationCase.id },
      });
    });
  }

  /**
   * If 5+ flags share the same issue for a question, notify instructors.
   */
  private async checkAutoFlag(
    questionId: string,
    issue: QuestionFlagIssue,
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

      const instructors = question.courseId
        ? await this.prisma.courseInstructor.findMany({
            where: { courseId: question.courseId },
            select: { userId: true },
            take: 5,
          })
        : [];

      const preview = question.text.substring(0, 80);

      for (const instructor of instructors) {
        await this.prisma.notification.create({
          data: {
            userId: instructor.userId,
            message: `Question flagged ${count}x for "${issue}": "${preview}...". Please review.`,
            type: 'question_flag_alert',
            priority: NotificationPriority.high,
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
