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
  isPassed: boolean;
};

@Injectable()
@ApiTags('assessment-progress')
export class AssessmentProgressService {
  private readonly logger = new Logger(AssessmentProgressService.name);

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
    progressData: Partial<AssessmentProgress>,
  ): Promise<AssessmentProgress> {
    const cacheKey = `progress:${userId}:${assessmentId}`;
    const cachedProgress = await this.redisService.get(cacheKey);
    if (cachedProgress) {
      this.logger.log(
        `Retrieved cached progress for user ${userId}, assessment ${assessmentId}`,
      );
      return JSON.parse(cachedProgress);
    }

    const quiz = await this.prisma.quiz.findUnique({
      where: { id: assessmentId },
    });
    if (!quiz) {
      this.logger.error(`Assessment ${assessmentId} not found`);
      throw new NotFoundException(
        `Assessment with ID ${assessmentId} not found`,
      );
    }

    const existingProgress = await (
      this.prisma as AnyPrisma
    ).assessmentProgress.findUnique({
      where: { userId_assessmentId: { userId, assessmentId } as any },
    });

    const updatedProgress = await (
      this.prisma as AnyPrisma
    ).assessmentProgress.upsert({
      where: { userId_assessmentId: { userId, assessmentId } as any },
      update: {
        completionPercentage:
          progressData.completionPercentage ??
          existingProgress?.completionPercentage ??
          0,
        lastAttemptedAt: progressData.lastAttemptedAt ?? new Date(),
        totalAttempts:
          progressData.totalAttempts ?? existingProgress?.totalAttempts ?? 0,
        bestScore: progressData.bestScore ?? existingProgress?.bestScore ?? 0,
        isPassed: progressData.isPassed ?? existingProgress?.isPassed ?? false,
      },
      create: {
        userId,
        assessmentId,
        completionPercentage: progressData.completionPercentage ?? 0,
        lastAttemptedAt: progressData.lastAttemptedAt ?? new Date(),
        totalAttempts: progressData.totalAttempts ?? 1,
        bestScore: progressData.bestScore ?? 0,
        isPassed: progressData.isPassed ?? false,
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

    await this.redisService.set(cacheKey, JSON.stringify(result), 24 * 60 * 60); // 1 day TTL
    this.logger.log(
      `Updated progress for user ${userId}, assessment ${assessmentId}`,
    );

    // Emit event for orchestration services (weakness detection, etc.)
    this.eventEmitter.emit('assessment.completed', {
      userId,
      assessmentId,
      score: progressData.bestScore ?? 0,
      maxScore: 100,
      timestamp: new Date(),
    });

    return result;
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
    const cacheKey = `progress:${userId}:${assessmentId}`;
    const cachedProgress = await this.redisService.get(cacheKey);
    if (cachedProgress) {
      this.logger.log(
        `Retrieved cached progress for user ${userId}, assessment ${assessmentId}`,
      );
      return JSON.parse(cachedProgress);
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
    return result;
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
      return JSON.parse(cachedProgress);
    }

    const progressRecords = await (
      this.prisma as AnyPrisma
    ).assessmentProgress.findMany({
      where: { userId },
    });

    const result = progressRecords.map((progress) => ({
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
    return result;
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
