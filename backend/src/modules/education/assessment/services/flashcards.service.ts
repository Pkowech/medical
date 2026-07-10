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
          front: dto.front ?? '',
          back: dto.back ?? '',
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
        interval: 1,
        nextReview: new Date(),
        correctStreak: 0,
        lastReview: new Date(),
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
  }> {
    // Route through Rust gRPC via AssessmentAnalyticsService
    const grpcStats =
      await this.analyticsService.getSpacedRepetitionStats(userId);
    return {
      totalCards: grpcStats.totalCards,
      dueToday: grpcStats.dueToday,
      mastered: grpcStats.masteredCards,
      needsReview: grpcStats.learningCards + grpcStats.relearningCards,
      avgEaseFactor: grpcStats.avgEaseFactor,
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
  async getDueCards(userId: string): Promise<Flashcard[]> {
    const cacheKey = `due_flashcards:${userId}`;
    const cachedCards = await this.redisService.get<string>(cacheKey);
    if (cachedCards) {
      return JSON.parse(cachedCards);
    }

    // Use analytics service to get due card ids, then fetch full Flashcard records
    const dueProtoCards = await this.analyticsService.getDueCards(userId);
    const cardIds = (dueProtoCards || [])
      .map((c: any) => c.card_id)
      .filter(Boolean);

    if (cardIds.length === 0) {
      await this.redisService.set(cacheKey, JSON.stringify([]), 1 * 60 * 60);
      return [];
    }

    const flashcards = await this.prisma.flashcard.findMany({
      where: { id: { in: cardIds } },
    });

    // Preserve order returned by analytics
    const flashcardMap = new Map(flashcards.map((f) => [f.id, f]));
    const ordered = cardIds
      .map((id: string) => flashcardMap.get(id))
      .filter(Boolean);

    await this.redisService.set(cacheKey, JSON.stringify(ordered), 1 * 60 * 60);
    return ordered as Flashcard[];
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
  ): Promise<UserFlashcardProgress> {
    if (quality < 1 || quality > 5) {
      throw new BadRequestException('Quality must be between 1 and 5');
    }

    const userProgress = await this.prisma.userFlashcardProgress.findUnique({
      where: { id: userFlashcardProgressId },
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
