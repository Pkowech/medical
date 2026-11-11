import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import { PrismaService } from '#infrastructure/prisma/prisma.service';

type ClaimedOutboxEvent = {
  id: string;
  eventType: string;
  payload: Prisma.JsonValue;
  attempts: number;
};

const MAX_BATCH_SIZE = 10;
const LOCK_TIMEOUT_MS = 5 * 60 * 1000;
const MAX_RETRY_DELAY_MS = 5 * 60 * 1000;

@Injectable()
export class ApplicationOutboxProcessor {
  private readonly logger = new Logger(ApplicationOutboxProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @Cron('*/2 * * * * *')
  async processPendingEvents(): Promise<void> {
    for (let index = 0; index < MAX_BATCH_SIZE; index += 1) {
      const event = await this.claimNextEvent();
      if (!event) {
        return;
      }

      try {
        await this.eventEmitter.emitAsync(event.eventType, event.payload);
        await this.prisma.applicationOutboxEvent.update({
          where: { id: event.id },
          data: {
            processedAt: new Date(),
            lockedAt: null,
            aggregateId: null,
            payload: {},
            lastError: null,
          },
        });
      } catch (error) {
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
            lastError: error instanceof Error ? error.name : 'UnknownError',
          },
        });
        this.logger.error(
          `Failed to publish outbox event ${event.id} (${event.eventType}); retry scheduled`,
          error instanceof Error ? error.stack : undefined,
        );
      }
    }
  }

  private async claimNextEvent(): Promise<ClaimedOutboxEvent | null> {
    return this.prisma.$transaction(async transaction => {
      const staleLockBefore = new Date(Date.now() - LOCK_TIMEOUT_MS);
      const rows = await transaction.$queryRaw<Array<{ id: string }>>`
        SELECT "id"
        FROM "application_outbox_events"
        WHERE "processed_at" IS NULL
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
