import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';
import { RedisService } from '../../../../infrastructure/redis/redis.service';
import { AssessmentProgressService } from './assessment-progress.service';
import { SM2AlgorithmService } from './sm2-algorithm.service';
import { AssessmentAnalyticsService } from '#modules/ai-analytics/services/assessment-analytics.service';
import { CreateFlashcardDto } from '#common/dto';
import { SyncFlashcardDto } from '../../../../common/dto/flashcard.dto';
import {
  Flashcard,
  UserFlashcardProgress,
  QuestionDifficulty,
} from '@prisma/client';
import { QuestionNotFoundException } from '../../../../common/exceptions/not-found.exception';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@Injectable()
@ApiTags('flashcards')
export class FlashcardsService {
  private readonly logger = new Logger(FlashcardsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly progressService: AssessmentProgressService,
    private readonly sm2Algorithm: SM2AlgorithmService,
    private readonly analyticsService: AssessmentAnalyticsService,
  ) {}

  @ApiOperation({ summary: 'Create a new flashcard' })
  @ApiResponse({
    status: 201,
    description: 'Flashcard created successfully',
    type: Object,
  })
  async createFlashcard(
    userId: string,
    dto: CreateFlashcardDto,
  ): Promise<Flashcard> {
    // Find or create the base Flashcard (content only)
    let flashcard: Flashcard | null;
    if (dto.questionId) {
      flashcard = await this.prisma.flashcard.findFirst({
        where: { questionId: dto.questionId },
      });
      if (!flashcard) {
        const question = await this.prisma.question.findUnique({
          where: { id: dto.questionId },
        });
        if (!question) {
          throw new QuestionNotFoundException(dto.questionId);
        }
        flashcard = await this.prisma.flashcard.create({
          data: {
            questionId: dto.questionId,
            front: dto.front ?? question.text ?? '',
            back: dto.back ?? question.explanation ?? '',
            // Other Flashcard properties like tags, difficulty, hints
            difficulty: question.difficulty,
            tags: question.tags,
            hints: [],
          },
        });
      }
    } else {
      // If no questionId, create a standalone flashcard
      flashcard = await this.prisma.flashcard.create({
        data: {
          front: dto.front ?? dto.question ?? dto.content ?? '',
          back: dto.back ?? dto.answer ?? '',
          difficulty: dto.difficulty
            ? (dto.difficulty as QuestionDifficulty)
            : QuestionDifficulty.medium,
          tags: dto.tags || [],
          hints: dto.hints || [],
        },
      });
    }

    // Now, create or update UserFlashcardProgress for this user and flashcard
    await this.prisma.userFlashcardProgress.upsert({
      where: {
        userId_flashcardId: {
          userId,
          flashcardId: flashcard.id,
        },
      },
      update: {}, // No updates on upsert if it exists, just ensure it's there
      create: {
        userId,
        flashcardId: flashcard.id,
        easeFactor: 2.5,
        interval: 0,
        nextReview: new Date(),
        correctStreak: 0,
        lastReview: null,
        repetitions: 0,
      },
    });

    // The method returns Flashcard, so we return the created/found flashcard
    // The user-specific progress is handled by userFlashcardProgress
    return flashcard;
  }

  @ApiOperation({ summary: 'Get flashcard statistics for a user' })
  @ApiResponse({ status: 200, description: 'User flashcard statistics' })
  async getCardStats(userId: string): Promise<{
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
      where: { userId },
      select: {
        easeFactor: true,
        interval: true,
        repetitions: true,
        nextReview: true,
      },
    });
    const dueToday = cards.filter((card) => card.nextReview <= new Date()).length;
    const mastered = cards.filter((card) => card.repetitions >= 2).length;
    const totalInterval = cards.reduce((sum, card) => sum + card.interval, 0);
    const totalEaseFactor = cards.reduce((sum, card) => sum + card.easeFactor, 0);

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

  /**
   * Get high-risk/struggling topic recommendations based on flashcard performance.
   */
  async getHighRiskTopics(userId: string, limit: number = 5) {
    return this.analyticsService.getFocusRecommendations(userId, limit);
  }

  @ApiOperation({ summary: 'Get due flashcards for a user' })
  @ApiResponse({
    status: 200,
    description: 'List of due flashcards',
    type: Array,
  })
  async getDueCards(
    userId: string,
  ): Promise<Array<UserFlashcardProgress & { flashcard: Flashcard }>> {
    return this.prisma.userFlashcardProgress.findMany({
      where: { userId, nextReview: { lte: new Date() } },
      include: { flashcard: true },
      orderBy: { nextReview: 'asc' },
    });
  }

  async getScheduledReviews(
    userId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<
    Array<{
      date: string;
      title: string;
      description: string;
      count: number;
      courseId: string | null;
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
        where: { userId, nextReview: { lte: endDate } },
        select: {
          nextReview: true,
          flashcard: {
            select: {
              question: {
                select: {
                  topicIds: true,
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
        topicId: string | null;
      }
    >();

    for (const progress of progressCards) {
      const question = progress.flashcard.question;
      const topicId = question?.topicIds[0] ?? null;
      const topicName = topicId ? topicNames.get(topicId) : undefined;
      const course = question?.unit?.course;
      const reviewDay = progress.nextReview.toISOString().slice(0, 10);
      const date = reviewDay < startDay ? startDay : reviewDay;
      const key = `${date}:${course?.id ?? 'general'}:${topicId ?? 'general'}`;
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
          topicId,
        });
      }
    }

    return Array.from(groups.values()).sort((left, right) =>
      left.date.localeCompare(right.date),
    );
  }

  @ApiOperation({ summary: 'Update a flashcard after review' })
  @ApiResponse({
    status: 200,
    description: 'Flashcard updated successfully',
    type: Object,
  })
  async updateCard(
    userFlashcardProgressId: string,
    quality: number,
    userId: string,
  ): Promise<UserFlashcardProgress> {
    if (quality < 1 || quality > 5) {
      throw new BadRequestException('Quality must be between 1 and 5');
    }

    const userProgress = await this.prisma.userFlashcardProgress.findFirst({
      where: { id: userFlashcardProgressId, userId },
      include: { flashcard: true },
    });

    if (!userProgress) {
      throw new NotFoundException('User flashcard progress not found');
    }

    // Use SM-2 algorithm to calculate new values
    const sm2Card = {
      easeFactor: userProgress.easeFactor,
      interval: userProgress.interval,
      repetitions: userProgress.repetitions,
      correctStreak: userProgress.correctStreak,
      lastReviewDate: userProgress.lastReview || new Date(),
      nextReviewDate: userProgress.nextReview,
    };

    const result = this.sm2Algorithm.reviewCard(sm2Card, quality);

    const updatedUserProgress = await this.prisma.userFlashcardProgress.update({
      where: { id: userFlashcardProgressId },
      data: {
        easeFactor: result.updated.easeFactor,
        interval: result.updated.interval,
        nextReview: result.updated.nextReviewDate,
        lastReview: new Date(),
        correctStreak: result.updated.correctStreak,
        repetitions: result.updated.repetitions,
      },
    });

    // Update AssessmentProgress
    await this.progressService.updateProgress(
      userProgress.userId,
      userProgress.flashcardId,
      {
        completionPercentage: ((result.updated.repetitions || 0) / 10) * 100,
        lastAttemptedAt: new Date(),
        totalAttempts: result.updated.repetitions || 0,
        bestScore: quality >= 3 ? 100 : 0,
        isPassed: quality >= 3,
      },
    );

    // Invalidate Redis cache keys
    await this.redisService.del(`due_flashcards:${userProgress.userId}`);
    this.logger.log(
      `Updated user flashcard progress ${userFlashcardProgressId} with quality ${quality}, next review in ${result.updated.interval} days`,
    );
    return updatedUserProgress;
  }

  async recordTopicQuizReviews(
    userId: string,
    topicId: string,
    answers: Array<{ questionId: string; isCorrect: boolean }>,
  ): Promise<number> {
    const now = new Date();
    const scheduledCount = await this.prisma.$transaction(async (tx) => {
      for (const answer of answers) {
        const question = await tx.question.findFirst({
          where: { id: answer.questionId, topicIds: { has: topicId } },
          include: { options: true },
        });
        if (!question) {
          throw new NotFoundException(
            `Question ${answer.questionId} not found for topic ${topicId}`,
          );
        }

        let flashcard = await tx.flashcard.findFirst({
          where: { questionId: question.id },
        });
        if (!flashcard) {
          const correctAnswers = question.options
            .filter((option) => option.isCorrect)
            .map((option) => option.text);
          flashcard = await tx.flashcard.create({
            data: {
              questionId: question.id,
              front: question.text,
              back: question.explanation || correctAnswers.join('\n'),
              difficulty: question.difficulty,
              tags: question.tags,
              hints: [],
            },
          });
        }

        const progress = await tx.userFlashcardProgress.upsert({
          where: {
            userId_flashcardId: { userId, flashcardId: flashcard.id },
          },
          update: {},
          create: {
            userId,
            flashcardId: flashcard.id,
            easeFactor: 2.5,
            interval: 0,
            repetitions: 0,
            correctStreak: 0,
            nextReview: now,
          },
        });
        const review = this.sm2Algorithm.reviewCard(
          {
            easeFactor: progress.easeFactor,
            interval: progress.interval,
            repetitions: progress.repetitions,
            correctStreak: progress.correctStreak,
            lastReviewDate: progress.lastReview ?? undefined,
            nextReviewDate: progress.nextReview,
          },
          answer.isCorrect ? 4 : 2,
        );

        await tx.userFlashcardProgress.update({
          where: { id: progress.id },
          data: {
            easeFactor: review.updated.easeFactor,
            interval: review.updated.interval,
            repetitions: review.updated.repetitions,
            correctStreak: review.updated.correctStreak,
            lastReview: now,
            nextReview: review.updated.nextReviewDate,
          },
        });
      }
      return answers.length;
    });

    await this.redisService.del(`due_flashcards:${userId}`);
    return scheduledCount;
  }

  @ApiOperation({ summary: 'Sync flashcards for a user' })
  @ApiResponse({
    status: 200,
    description: 'Flashcards synced successfully',
    type: Array,
  })
  async syncCards(
    userId: string,
    cards: SyncFlashcardDto[],
  ): Promise<Flashcard[]> {
    const syncedFlashcards: Flashcard[] = [];
    for (const card of cards) {
      if (!card.questionId && (!card.front || !card.back)) {
        // Ensure enough info to create a flashcard
        this.logger.warn(
          `Skipping sync for card without questionId or front/back content for user ${userId}`,
        );
        continue;
      }

      // Find or create the base Flashcard (content only)
      let flashcard: Flashcard | null;
      if (card.questionId) {
        flashcard = await this.prisma.flashcard.findFirst({
          where: { questionId: card.questionId },
        });
        if (!flashcard) {
          const question = await this.prisma.question.findUnique({
            where: { id: card.questionId },
          });
          if (!question) {
            this.logger.warn(
              `Question with ID ${card.questionId} not found for sync. Skipping.`,
            );
            continue;
          }
          flashcard = await this.prisma.flashcard.create({
            data: {
              questionId: card.questionId,
              front: card.front ?? question.text ?? '',
              back: card.back ?? question.explanation ?? '',
              difficulty: question.difficulty,
              tags: question.tags,
              hints: [],
            },
          });
        }
      } else {
        // If no questionId, create a standalone flashcard
        flashcard = await this.prisma.flashcard.create({
          data: {
            front: card.front ?? '',
            back: card.back ?? '',
            difficulty: card.difficulty
              ? (card.difficulty as QuestionDifficulty)
              : QuestionDifficulty.medium,
            tags: card.tags || [],
            hints: card.hints || [],
          },
        });
      }

      // Now, find or update UserFlashcardProgress for this user and flashcard
      const existingUserProgress =
        await this.prisma.userFlashcardProgress.findUnique({
          where: {
            userId_flashcardId: {
              userId,
              flashcardId: flashcard.id,
            },
          },
        });

      if (existingUserProgress) {
        // If user progress exists, update it if the incoming card has newer data
        if (
          card.updatedAt &&
          existingUserProgress.updatedAt &&
          existingUserProgress.updatedAt > card.updatedAt
        ) {
          // Local data is newer, do nothing or push existing
          syncedFlashcards.push(flashcard); // Push the base flashcard
        } else {
          // Incoming data is newer or no updatedAt, update user progress
          await this.prisma.userFlashcardProgress.update({
            where: { id: existingUserProgress.id },
            data: {
              easeFactor: card.easeFactor ?? existingUserProgress.easeFactor,
              interval: card.interval ?? existingUserProgress.interval,
              nextReview: card.nextReview ?? existingUserProgress.nextReview,
              correctStreak:
                card.correctStreak ?? existingUserProgress.correctStreak,
              lastReview: card.lastReview ?? existingUserProgress.lastReview,
              repetitions: card.repetitions ?? existingUserProgress.repetitions,
            },
          });
          syncedFlashcards.push(flashcard); // Push the base flashcard
        }
      } else {
        // If no user progress exists, create a new one
        await this.prisma.userFlashcardProgress.create({
          data: {
            userId,
            flashcardId: flashcard.id,
            easeFactor: card.easeFactor || 2.5,
            interval: card.interval || 1,
            nextReview: card.nextReview || new Date(),
            correctStreak: card.correctStreak || 0,
            lastReview: card.lastReview || new Date(),
            repetitions: card.repetitions || 0,
          },
        });
        syncedFlashcards.push(flashcard); // Push the base flashcard
      }
    }

    await this.redisService.del(`due_flashcards:${userId}`);
    return syncedFlashcards;
  }
}
