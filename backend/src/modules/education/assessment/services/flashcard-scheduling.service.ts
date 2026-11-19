import { BadRequestException, Injectable } from '@nestjs/common';
import { Flashcard, Prisma, UserFlashcardProgress } from '@prisma/client';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';
import { AssessmentAnalyticsService } from '#modules/ai-analytics/services/assessment-analytics.service';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';

@Injectable()
export class FlashcardSchedulingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly analyticsService: AssessmentAnalyticsService,
  ) {}

  private getProgressScopeWhere(filters: {
    courseId?: string;
    unitId?: string;
    topicId?: string;
  }): Prisma.UserFlashcardProgressWhereInput {
    if (!filters.courseId && !filters.unitId && !filters.topicId) return {};

    return {
      flashcard: {
        question: {
          is: {
            ...(filters.topicId ? { topicIds: { has: filters.topicId } } : {}),
            ...(filters.unitId ? { unitId: filters.unitId } : {}),
            ...(filters.courseId
              ? {
                  OR: [
                    { courseId: filters.courseId },
                    { unit: { is: { courseId: filters.courseId } } },
                  ],
                }
              : {}),
          },
        },
      },
    };
  }

  @ApiOperation({ summary: 'Get flashcard statistics for a user' })
  @ApiResponse({ status: 200, description: 'User flashcard statistics' })
  async getCardStats(
    userId: string,
    filters: { courseId?: string; unitId?: string; topicId?: string } = {},
  ): Promise<{
    totalCards: number;
    dueToday: number;
    mastered: number;
    needsReview: number;
    avgEaseFactor: number;
    total: number;
    due: number;
    upcoming: number;
    averageInterval: number;
  }> {
    const cards = await this.prisma.userFlashcardProgress.findMany({
      where: {
        userId,
        ...this.getProgressScopeWhere(filters),
      },
      select: {
        easeFactor: true,
        interval: true,
        repetitions: true,
        correctStreak: true,
        nextReview: true,
      },
    });
    const dueToday = cards.filter(
      (card) => card.nextReview <= new Date(),
    ).length;
    const mastered = cards.filter(
      (card) => card.correctStreak >= 2 && card.interval >= 30,
    ).length;
    const totalInterval = cards.reduce((sum, card) => sum + card.interval, 0);
    const totalEaseFactor = cards.reduce(
      (sum, card) => sum + card.easeFactor,
      0,
    );

    return {
      totalCards: cards.length,
      dueToday,
      mastered,
      needsReview: cards.length - mastered,
      avgEaseFactor: cards.length ? totalEaseFactor / cards.length : 2.5,
      total: cards.length,
      due: dueToday,
      upcoming: cards.length - dueToday,
      averageInterval: cards.length ? totalInterval / cards.length : 0,
    };
  }

  @ApiOperation({ summary: 'Get due flashcards for a user' })
  @ApiResponse({
    status: 200,
    description: 'List of due flashcards',
    type: Array,
  })
  async getDueCards(
    userId: string,
    filters: { courseId?: string; unitId?: string; topicId?: string } = {},
  ): Promise<Array<UserFlashcardProgress & { flashcard: Flashcard }>> {
    return this.prisma.userFlashcardProgress.findMany({
      where: {
        userId,
        nextReview: { lte: new Date() },
        ...this.getProgressScopeWhere(filters),
      },
      include: { flashcard: true },
      orderBy: { nextReview: 'asc' },
    });
  }

  /**
   * Get high-risk/struggling topic recommendations based on flashcard performance.
   */
  async getHighRiskTopics(userId: string, limit: number = 5) {
    return this.analyticsService.getFocusRecommendations(userId, limit);
  }

  async getScheduledReviews(
    userId: string,
    startDate: Date,
    endDate: Date,
    filters: { courseId?: string; unitId?: string; topicId?: string } = {},
  ): Promise<
    Array<{
      date: string;
      title: string;
      description: string;
      count: number;
      courseId: string | null;
      unitId: string | null;
      topicId: string | null;
    }>
  > {
    if (
      Number.isNaN(startDate.getTime()) ||
      Number.isNaN(endDate.getTime()) ||
      endDate < startDate
    ) {
      throw new BadRequestException('A valid review date range is required');
    }

    const [progressCards, topics] = await Promise.all([
      this.prisma.userFlashcardProgress.findMany({
        where: {
          userId,
          nextReview: { lte: endDate },
          ...this.getProgressScopeWhere(filters),
        },
        select: {
          nextReview: true,
          flashcard: {
            select: {
              question: {
                select: {
                  topicIds: true,
                  course: { select: { id: true, name: true } },
                  unit: {
                    select: {
                      id: true,
                      name: true,
                      course: { select: { id: true, name: true } },
                    },
                  },
                },
              },
            },
          },
        },
      }),
      this.prisma.topic.findMany({
        select: { id: true, name: true },
      }),
    ]);
    const topicNames = new Map(topics.map((topic) => [topic.id, topic.name]));
    const startDay = startDate.toISOString().slice(0, 10);
    const groups = new Map<
      string,
      {
        date: string;
        title: string;
        description: string;
        count: number;
        courseId: string | null;
        unitId: string | null;
        topicId: string | null;
      }
    >();

    for (const progress of progressCards) {
      const question = progress.flashcard.question;
      const topicId = question?.topicIds[0] ?? null;
      const topicName = topicId ? topicNames.get(topicId) : undefined;
      const course = question?.course ?? question?.unit?.course;
      const unitId = question?.unit?.id ?? null;
      const reviewDay = progress.nextReview.toISOString().slice(0, 10);
      const date = reviewDay < startDay ? startDay : reviewDay;
      const key = `${date}:${course?.id ?? 'general'}:${unitId ?? 'general'}:${topicId ?? 'general'}`;
      const existing = groups.get(key);
      if (existing) {
        existing.count += 1;
        existing.title = `Review ${existing.count} ${existing.count === 1 ? 'card' : 'cards'}${topicName ? `: ${topicName}` : ''}`;
      } else {
        const title = `Review 1 card${topicName ? `: ${topicName}` : ''}`;
        groups.set(key, {
          date,
          title,
          description: course?.name
            ? `Spaced repetition review for ${course.name}`
            : 'Spaced repetition review',
          count: 1,
          courseId: course?.id ?? null,
          unitId,
          topicId,
        });
      }
    }

    return Array.from(groups.values()).sort((left, right) =>
      left.date.localeCompare(right.date),
    );
  }
}
