import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  PrismaService,
  AnyPrisma,
} from '../../../../infrastructure/prisma/prisma.service';
import { AssessmentProgressDto } from '../../../../common/dto/assessment.dto';
import { RedisService } from '../../../../infrastructure/redis/redis.service';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
// Local type for assessment progress used by this service
type AssessmentProgress = {
  userId: string;
  assessmentId: string;
  completionPercentage: number;
  lastAttemptedAt?: Date;
  totalAttempts: number;
  bestScore?: number;
  isPassed?: boolean;
  resultsAvailable?: boolean;
};

@Injectable()
@ApiTags('assessment-progress')
export class AssessmentProgressService {
  private readonly logger = new Logger(AssessmentProgressService.name);

  private hideUnavailableResults(
    progress: AssessmentProgress,
    showResults: boolean,
  ): AssessmentProgress {
    if (showResults) {
      return { ...progress, resultsAvailable: true };
    }

    const safeProgress = { ...progress };
    delete safeProgress.bestScore;
    delete safeProgress.isPassed;
    return { ...safeProgress, resultsAvailable: false };
  }

  private async applyResultVisibility(
    progressRecords: AssessmentProgress[],
  ): Promise<AssessmentProgress[]> {
    const assessmentIds = [
      ...new Set(progressRecords.map(({ assessmentId }) => assessmentId)),
    ];
    const quizzes = assessmentIds.length
      ? await this.prisma.quiz.findMany({
          where: { id: { in: assessmentIds } },
          select: { id: true, showResults: true },
        })
      : [];
    const resultsVisibility = new Map(
      quizzes.map((quiz) => [quiz.id, quiz.showResults]),
    );
    return progressRecords.map((progress) =>
      this.hideUnavailableResults(
        progress,
        resultsVisibility.get(progress.assessmentId) === true,
      ),
    );
  }

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @ApiOperation({ summary: 'Update user progress for an assessment' })
  @ApiResponse({
    status: 200,
    description: 'Progress updated successfully',
    type: () => AssessmentProgressDto,
  })
  async updateProgress(
    userId: string,
    assessmentId: string,
  ): Promise<AssessmentProgress> {
    const cacheKey = `progress:${userId}:${assessmentId}`;
    // NOTE: Do NOT read from cache here \u2014 this is a write operation and must
    // always persist to the database regardless of any cached state.

    const quiz = await this.prisma.quiz.findUnique({
      where: { id: assessmentId },
      include: { unit: { select: { courseId: true } } },
    });
    if (!quiz) {
      this.logger.error(`Assessment ${assessmentId} not found`);
      throw new NotFoundException(
        `Assessment with ID ${assessmentId} not found`,
      );
    }

    const attempts = await this.prisma.quizAttempt.findMany({
      where: { userId, quizId: assessmentId },
      select: {
        startedAt: true,
        completedAt: true,
        timeTaken: true,
        percentage: true,
        isPassed: true,
      },
      orderBy: { startedAt: 'desc' },
    });
    if (!attempts.length) {
      throw new NotFoundException(
        `No quiz attempts found for user ${userId} and assessment ${assessmentId}`,
      );
    }
    const completedAttempts = attempts.filter((attempt) => attempt.completedAt);
    const bestScore = completedAttempts.length
      ? Math.max(...completedAttempts.map((attempt) => attempt.percentage))
      : 0;

    const updatedProgress = await this.prisma.assessmentProgress.upsert({
      where: { userId_assessmentId: { userId, assessmentId } },
      update: {
        completionPercentage: completedAttempts.length ? 100 : 0,
        lastAttemptedAt: attempts[0].startedAt,
        totalAttempts: attempts.length,
        bestScore,
        isPassed: completedAttempts.some((attempt) => attempt.isPassed),
      },
      create: {
        userId,
        assessmentId,
        completionPercentage: completedAttempts.length ? 100 : 0,
        lastAttemptedAt: attempts[0].startedAt,
        totalAttempts: attempts.length,
        bestScore,
        isPassed: completedAttempts.some((attempt) => attempt.isPassed),
      },
    });

    const result: AssessmentProgress = {
      userId: updatedProgress.userId,
      assessmentId: updatedProgress.assessmentId,
      completionPercentage: updatedProgress.completionPercentage,
      lastAttemptedAt: updatedProgress.lastAttemptedAt ?? undefined,
      totalAttempts: updatedProgress.totalAttempts,
      bestScore: updatedProgress.bestScore ?? undefined,
      isPassed: updatedProgress.isPassed,
    };

    // Write fresh progress to cache and bust the quiz results cache so
    // getUserQuizResults reflects the latest submission immediately.
    await Promise.all([
      this.redisService.set(cacheKey, JSON.stringify(result), 24 * 60 * 60),
      this.redisService.del(`quiz:results:${userId}:${quiz.unitId ?? ''}`),
      this.redisService.del(`quiz:results:v2:${userId}:${quiz.unitId ?? ''}`),
    ]);
    this.logger.log(
      `Updated progress for user ${userId}, assessment ${assessmentId}`,
    );

    // Emit event for orchestration services (weakness detection, etc.)
    if (completedAttempts.length > 0) {
      const timestamp = new Date();
      const latestCompletedAttempt = completedAttempts.reduce(
        (latest, attempt) =>
          (attempt.completedAt ?? attempt.startedAt) >
          (latest.completedAt ?? latest.startedAt)
            ? attempt
            : latest,
      );
      const score = latestCompletedAttempt.percentage;
      this.eventEmitter.emit('assessment.completed', {
        userId,
        assessmentId,
        courseId: quiz.unit?.courseId,
        topicId: quiz.topicId ?? undefined,
        score,
        maxScore: 100,
        timestamp,
        attemptData: {
          score,
          maxScore: 100,
          passed: latestCompletedAttempt.isPassed,
          progressPercentage: result.completionPercentage,
          timeSpentMinutes: Math.ceil(
            (latestCompletedAttempt.timeTaken ?? 0) / 60,
          ),
          timestamp: timestamp.toISOString(),
        },
      });
    }

    return this.hideUnavailableResults(result, quiz.showResults);
  }

  @ApiOperation({ summary: 'Get user progress for an assessment' })
  @ApiResponse({
    status: 200,
    description: 'User progress details',
    type: () => AssessmentProgressDto,
  })
  async getProgress(
    userId: string,
    assessmentId: string,
  ): Promise<AssessmentProgress> {
    const quiz = await this.prisma.quiz.findUnique({
      where: { id: assessmentId },
      select: { showResults: true },
    });
    const cacheKey = `progress:${userId}:${assessmentId}`;
    const cachedProgress = await this.redisService.get(cacheKey);
    if (cachedProgress) {
      this.logger.log(
        `Retrieved cached progress for user ${userId}, assessment ${assessmentId}`,
      );
      return this.hideUnavailableResults(
        JSON.parse(cachedProgress),
        quiz?.showResults === true,
      );
    }

    const progress = await (
      this.prisma as AnyPrisma
    ).assessmentProgress.findUnique({
      where: { userId_assessmentId: { userId, assessmentId } as any },
    });

    if (!progress) {
      this.logger.error(
        `Progress not found for user ${userId}, assessment ${assessmentId}`,
      );
      throw new NotFoundException(
        `Progress not found for user ${userId} and assessment ${assessmentId}`,
      );
    }

    const result: AssessmentProgress = {
      userId: progress.userId,
      assessmentId: progress.assessmentId,
      completionPercentage: progress.completionPercentage,
      lastAttemptedAt: progress.lastAttemptedAt ?? undefined,
      totalAttempts: progress.totalAttempts,
      bestScore: progress.bestScore ?? undefined,
      isPassed: progress.isPassed,
    };

    await this.redisService.set(cacheKey, JSON.stringify(result), 24 * 60 * 60); // 1 day TTL
    return this.hideUnavailableResults(result, quiz?.showResults === true);
  }

  @ApiOperation({ summary: 'Get all progress records for a user' })
  @ApiResponse({
    status: 200,
    description: 'List of user progress records',
    type: () => [AssessmentProgressDto],
  })
  async getAllProgress(userId: string): Promise<AssessmentProgress[]> {
    const cacheKey = `progress_all:${userId}`;
    const cachedProgress = await this.redisService.get(cacheKey);
    if (cachedProgress) {
      this.logger.log(`Retrieved cached progress records for user ${userId}`);
      return this.applyResultVisibility(JSON.parse(cachedProgress));
    }

    const progressRecords = await (
      this.prisma as AnyPrisma
    ).assessmentProgress.findMany({
      where: { userId },
    });

    const result: AssessmentProgress[] = progressRecords.map((progress) => ({
      userId: progress.userId,
      assessmentId: progress.assessmentId,
      completionPercentage: progress.completionPercentage,
      lastAttemptedAt: progress.lastAttemptedAt ?? undefined,
      totalAttempts: progress.totalAttempts,
      bestScore: progress.bestScore ?? undefined,
      isPassed: progress.isPassed,
    }));

    await this.redisService.set(cacheKey, JSON.stringify(result), 24 * 60 * 60); // 1 day TTL
    this.logger.log(
      `Fetched ${result.length} progress records for user ${userId}`,
    );
    return this.applyResultVisibility(result);
  }

  @ApiOperation({ summary: 'Delete user progress for an assessment' })
  @ApiResponse({ status: 200, description: 'Progress deleted successfully' })
  async deleteProgress(userId: string, assessmentId: string): Promise<void> {
    const progress = await (
      this.prisma as AnyPrisma
    ).assessmentProgress.findUnique({
      where: { userId_assessmentId: { userId, assessmentId } as any },
    });

    if (!progress) {
      this.logger.error(
        `Progress not found for user ${userId}, assessment ${assessmentId}`,
      );
      throw new NotFoundException(
        `Progress not found for user ${userId} and assessment ${assessmentId}`,
      );
    }

    await (this.prisma as AnyPrisma).assessmentProgress.delete({
      where: { userId_assessmentId: { userId, assessmentId } as any },
    });

    await this.redisService.del(`progress:${userId}:${assessmentId}`);
    await this.redisService.del(`progress_all:${userId}`);
    this.logger.log(
      `Deleted progress for user ${userId}, assessment ${assessmentId}`,
    );
  }
}
