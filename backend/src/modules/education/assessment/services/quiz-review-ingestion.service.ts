import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';
import { RedisService } from '../../../../infrastructure/redis/redis.service';
import { SM2AlgorithmService } from './sm2-algorithm.service';

@Injectable()
export class QuizReviewIngestionService {
  private readonly logger = new Logger(QuizReviewIngestionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly sm2Algorithm: SM2AlgorithmService,
  ) {}

  async recordTopicQuizReviews(
    userId: string,
    topicId: string | null,
    answers: Array<{ questionId: string; isCorrect: boolean }>,
    attemptId: string,
  ): Promise<number> {
    const now = new Date();
    const scheduledCount = await this.prisma.$transaction(async (tx) => {
      let scheduled = 0;
      for (const answer of answers) {
        const question = await tx.question.findFirst({
          where: {
            id: answer.questionId,
            ...(topicId ? { topicIds: { has: topicId } } : {}),
          },
          include: { options: true },
        });
        if (!question) {
          this.logger.warn(
            `Skipping flashcard review for question ${answer.questionId}; it is not mapped to topic ${topicId ?? 'all topics'}.`,
          );
          continue;
        }
        const sourceKey = `quiz-review:${attemptId}:${answer.questionId}`;
        if (await tx.flashcardResult.findUnique({ where: { sourceKey } })) {
          continue;
        }

        let flashcard = await tx.flashcard.findFirst({
          where: { questionId: question.id },
        });
        const existingProgress = flashcard
          ? await tx.userFlashcardProgress.findUnique({
              where: {
                userId_flashcardId: { userId, flashcardId: flashcard.id },
              },
            })
          : null;
        if (answer.isCorrect && !existingProgress) continue;

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

        await tx.flashcardResult.create({
          data: {
            userId,
            flashcardId: flashcard.id,
            sourceKey,
            passed: answer.isCorrect,
            attemptedAt: now,
          },
        });
        scheduled += 1;
      }
      return scheduled;
    });

    await this.redisService.del(`due_flashcards:${userId}`);
    return scheduledCount;
  }

}
