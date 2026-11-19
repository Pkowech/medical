import { Injectable, Logger } from '@nestjs/common';
import { Flashcard, QuestionDifficulty } from '@prisma/client';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';
import { RedisService } from '../../../../infrastructure/redis/redis.service';
import { SyncFlashcardDto } from '../../../../common/dto/flashcard.dto';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';

@Injectable()
export class FlashcardSyncService {
  private readonly logger = new Logger(FlashcardSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
  ) {}

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
}
