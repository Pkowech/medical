import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { RedisService } from '#infrastructure/redis/redis.service';
import { UnitCompletedEvent } from '../events/unit-completed.event';

@Injectable()
export class CoursePredictionHandler {
  private readonly logger = new Logger(CoursePredictionHandler.name);
  private readonly CACHE_TTL = 86400; // 24 hours in seconds

  constructor(private readonly redisService: RedisService) {}

  @OnEvent('unit.completed')
  async handleUnitCompleted(event: UnitCompletedEvent): Promise<void> {
    const startTime = Date.now();

    try {
      this.logger.log('Processing unit completion event', {
        userId: event.userId,
        unitId: event.unitId,
        courseId: event.courseId,
      });

      // TODO: When prerequisite relationships are added to schema:
      // 1. Query courses that have this unit/course as a prerequisite
      // 2. Refresh BKT predictions for those courses
      // 3. Cache predictions with 24h TTL

      // For now, cache the completion event itself for future processing
      const cacheKey = `course:predictions:${event.userId}:${event.courseId}`;
      await this.redisService.set(
        cacheKey,
        JSON.stringify({
          lastUpdated: event.completedAt,
          progressPercentage: event.progressPercentage,
          unitId: event.unitId,
        }),
        this.CACHE_TTL,
      );

      const duration = Date.now() - startTime;
      this.logger.log('Unit completion event processed successfully', {
        userId: event.userId,
        courseId: event.courseId,
        durationMs: duration,
      });

      // Alert if processing took too long
      if (duration > 500) {
        this.logger.warn('Event processing exceeded 500ms threshold', {
          durationMs: duration,
          userId: event.userId,
          courseId: event.courseId,
        });
      }
    } catch (error) {
      // Graceful degradation: log error but don't throw
      // Unit completion should succeed even if prediction refresh fails
      this.logger.error('Failed to process unit completion event', {
        userId: event.userId,
        unitId: event.unitId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
