import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';
import { RedisService } from '../../../../infrastructure/redis/redis.service';
import { SM2AlgorithmService } from './sm2-algorithm.service';
import { CreateFlashcardDto } from '#common/dto';
import {
  Flashcard,
  UserFlashcardProgress,
  QuestionDifficulty,
  UserActivityType,
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
    private readonly sm2Algorithm: SM2AlgorithmService,
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
    idempotencyKey: string,
  ): Promise<UserFlashcardProgress> {
    if (quality < 1 || quality > 5) {
      throw new BadRequestException('Quality must be between 1 and 5');
    }
    if (
      typeof idempotencyKey !== 'string' ||
      idempotencyKey.trim().length === 0 ||
      idempotencyKey.length > 200
    ) {
      throw new BadRequestException(
        'An idempotency key of at most 200 characters is required.',
      );
    }

    const reviewedAt = new Date();
    const updatedUserProgress = await this.prisma.$transaction(async (tx) => {
      const userProgress = await tx.userFlashcardProgress.findFirst({
        where: { id: userFlashcardProgressId, userId },
      });
      if (!userProgress) {
        throw new NotFoundException('User flashcard progress not found');
      }

      const sourceKey = `flashcard-review:${userId}:${idempotencyKey}`;
      const sourceFingerprint = JSON.stringify({
        userFlashcardProgressId,
        quality,
      });
      const activity = await tx.userActivity.createMany({
        data: [
          {
            userId,
            sourceKey,
            type: UserActivityType.FLASHCARD_REVIEW,
            description: 'Reviewed a flashcard',
            details: { sourceFingerprint },
            createdAt: reviewedAt,
          },
        ],
        skipDuplicates: true,
      });
      if (activity.count === 0) {
        const existingActivity = await tx.userActivity.findUnique({
          where: { sourceKey },
          select: { details: true },
        });
        const details = existingActivity?.details;
        if (
          !details ||
          typeof details !== 'object' ||
          !('sourceFingerprint' in details) ||
          details.sourceFingerprint !== sourceFingerprint
        ) {
          throw new ConflictException(
            'The idempotency key was already used for a different flashcard review.',
          );
        }
        return userProgress;
      }

      const sm2Card = {
        easeFactor: userProgress.easeFactor,
        interval: userProgress.interval,
        repetitions: userProgress.repetitions,
        correctStreak: userProgress.correctStreak,
        lastReviewDate: userProgress.lastReview || new Date(),
        nextReviewDate: userProgress.nextReview,
      };
      const result = this.sm2Algorithm.reviewCard(sm2Card, quality);
      const progress = await tx.userFlashcardProgress.update({
        where: { id: userFlashcardProgressId },
        data: {
          easeFactor: result.updated.easeFactor,
          interval: result.updated.interval,
          nextReview: result.updated.nextReviewDate,
          lastReview: reviewedAt,
          correctStreak: result.updated.correctStreak,
          repetitions: result.updated.repetitions,
        },
      });

      const flashcardResult = await tx.flashcardResult.create({
        data: {
          userId,
          flashcardId: userProgress.flashcardId,
          passed: quality >= 3,
          attemptedAt: reviewedAt,
          sourceKey,
        },
      });

      await tx.userActivity.update({
        where: { sourceKey },
        data: {
          details: {
            sourceId: flashcardResult.id,
            sourceFingerprint,
            flashcardId: userProgress.flashcardId,
            passed: quality >= 3,
          },
        },
      });

      return progress;
    });

    // Invalidate Redis cache keys
    await this.redisService.del(`due_flashcards:${userId}`);
    this.logger.log(
      `Updated user flashcard progress ${userFlashcardProgressId} with quality ${quality}, next review in ${updatedUserProgress.interval} days`,
    );
    return updatedUserProgress;
  }
}
