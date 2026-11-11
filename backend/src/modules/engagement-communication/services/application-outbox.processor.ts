import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import { PrismaService } from '#infrastructure/prisma/prisma.service';
import { MetricsService } from '#infrastructure/metrics/metrics.service';

type ClaimedOutboxEvent = {
  id: string;
  eventType: string;
  payload: Prisma.JsonValue;
  attempts: number;
};

const MAX_BATCH_SIZE = 10;
const MAX_OUTBOX_RETRIES = 8;
const LOCK_TIMEOUT_MS = 5 * 60 * 1000;
const MAX_RETRY_DELAY_MS = 5 * 60 * 1000;
const STALE_EVENT_AGE_MS = 10 * 60 * 1000;

export type OutboxEventState = 'pending' | 'processed' | 'failed';

@Injectable()
export class ApplicationOutboxProcessor {
  private readonly logger = new Logger(ApplicationOutboxProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly metrics: MetricsService,
  ) {}

  @Cron('*/2 * * * * *')
  async processPendingEvents(): Promise<void> {
    for (let index = 0; index < MAX_BATCH_SIZE; index += 1) {
      const event = await this.claimNextEvent();
      if (!event) {
        return;
      }

      try {
        if (this.eventEmitter.listenerCount(event.eventType) === 0) {
          throw new Error(`No listener registered for ${event.eventType}`);
        }
        await this.eventEmitter.emitAsync(event.eventType, event.payload);
        await this.prisma.applicationOutboxEvent.update({
          where: { id: event.id },
          data: {
            processedAt: new Date(),
            lockedAt: null,
            aggregateId: null,
            payload: {},
            lastError: null,
            failedAt: null,
          },
        });
      } catch (error) {
        const nextAttempt = event.attempts + 1;
        const isDeadLetter = nextAttempt >= MAX_OUTBOX_RETRIES;
        const retryDelay = Math.min(
          1000 * 2 ** Math.min(event.attempts, 8),
          MAX_RETRY_DELAY_MS,
        );
        await this.prisma.applicationOutboxEvent.update({
          where: { id: event.id },
          data: {
            attempts: { increment: 1 },
            availableAt: new Date(Date.now() + retryDelay),
            lockedAt: null,
            failedAt: isDeadLetter ? new Date() : null,
            lastError: getSafeErrorCode(error),
          },
        });
        this.logger.error(
          isDeadLetter
            ? `Outbox event ${event.id} (${event.eventType}) reached the retry limit and was dead-lettered`
            : `Failed to publish outbox event ${event.id} (${event.eventType}); retry scheduled`,
        );
      }
    }
  }

  @Cron('*/30 * * * * *')
  async updateOutboxMonitoring(): Promise<void> {
    const now = new Date();
    const staleBefore = new Date(now.getTime() - STALE_EVENT_AGE_MS);
    const [pending, failed, stale] = await Promise.all([
      this.prisma.applicationOutboxEvent.count({
        where: { processedAt: null, failedAt: null },
      }),
      this.prisma.applicationOutboxEvent.count({
        where: { failedAt: { not: null } },
      }),
      this.prisma.applicationOutboxEvent.count({
        where: {
          processedAt: null,
          failedAt: null,
          createdAt: { lt: staleBefore },
        },
      }),
    ]);

    this.metrics.setApplicationOutboxCounts({ pending, failed, stale });
    if (stale > 0) {
      this.logger.warn(
        `${stale} application outbox event(s) have remained unprocessed for over 10 minutes`,
      );
    }
  }

  async inspectEvents(state: OutboxEventState = 'pending', limit = 50) {
    const take = Math.max(1, Math.min(200, Math.floor(limit)));
    const where: Prisma.ApplicationOutboxEventWhereInput =
      state === 'processed'
        ? { processedAt: { not: null } }
        : state === 'failed'
          ? { failedAt: { not: null } }
          : { processedAt: null, failedAt: null };

    return this.prisma.applicationOutboxEvent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take,
      select: {
        id: true,
        eventType: true,
        aggregateId: true,
        dedupeKey: true,
        payload: true,
        createdAt: true,
        availableAt: true,
        attempts: true,
        lastError: true,
        lockedAt: true,
        processedAt: true,
        failedAt: true,
      },
    });
  }

  async replayEvent(id: string): Promise<void> {
    await this.prisma.$transaction(async transaction => {
      const rows = await transaction.$queryRaw<Array<{ id: string }>>`
        SELECT "id"
        FROM "application_outbox_events"
        WHERE "id" = ${id}
        FOR UPDATE
      `;
      if (!rows.length) {
        throw new NotFoundException('Outbox event not found');
      }

      const event = await transaction.applicationOutboxEvent.findUniqueOrThrow({
        where: { id },
        select: { lockedAt: true, processedAt: true, failedAt: true },
      });
      if (
        event.lockedAt &&
        event.lockedAt.getTime() > Date.now() - LOCK_TIMEOUT_MS
      ) {
        throw new ConflictException('Outbox event is currently being processed');
      }
      if (!event.failedAt) {
        throw new ConflictException(
          'Only dead-lettered events can be replayed',
        );
      }

      await transaction.applicationOutboxEvent.update({
        where: { id },
        data: {
          attempts: 0,
          availableAt: new Date(),
          lastError: null,
          lockedAt: null,
          processedAt: null,
          failedAt: null,
        },
      });
    });
  }

  private async claimNextEvent(): Promise<ClaimedOutboxEvent | null> {
    return this.prisma.$transaction(async transaction => {
      const staleLockBefore = new Date(Date.now() - LOCK_TIMEOUT_MS);
      const rows = await transaction.$queryRaw<Array<{ id: string }>>`
        SELECT "id"
        FROM "application_outbox_events"
        WHERE "processed_at" IS NULL
        AND "failed_at" IS NULL
          AND "attempts" < ${MAX_OUTBOX_RETRIES}
          AND "available_at" <= CURRENT_TIMESTAMP
          AND ("locked_at" IS NULL OR "locked_at" < ${staleLockBefore})
        ORDER BY "created_at"
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      `;
      const row = rows[0];
      if (!row) {
        return null;
      }

      return transaction.applicationOutboxEvent.update({
        where: { id: row.id },
        data: { lockedAt: new Date() },
        select: {
          id: true,
          eventType: true,
          payload: true,
          attempts: true,
        },
      });
    });
  }
}

function getSafeErrorCode(error: unknown): string {
  if (
    error instanceof Error &&
    /^[A-Za-z][A-Za-z0-9_]{0,79}$/.test(error.name)
  ) {
    return error.name;
  }
  return 'UnknownError';
}
