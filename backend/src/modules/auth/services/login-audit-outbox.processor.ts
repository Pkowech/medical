import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { PrismaService } from '#infrastructure/prisma/prisma.service';
import {
  securityEventTypes,
  type SecurityEventType,
} from '#common/dto/security.dto';
import { AuditLogService, AuditOutboxPayload } from './audit-log.service';

type OutboxRow = {
  id: string;
  payload: Prisma.JsonValue;
  createdAt: Date;
};

const MAX_BATCH_SIZE = 10;
const MAX_OUTBOX_RETRIES = 8;
const MAX_BACKOFF_SECONDS = 300;
const MAX_TRANSACTION_START_WAIT_MS = 10_000;

function getErrorDetails(error: unknown): {
  name: string;
  message: string;
  code?: string;
} {
  if (error instanceof Error) {
    const candidate = error as Error & { code?: unknown };
    return {
      name: error.name,
      message: error.message.slice(0, 500),
      ...(typeof candidate.code === 'string' ? { code: candidate.code } : {}),
    };
  }

  return {
    name: 'UnknownError',
    message: String(error).slice(0, 500),
  };
}

function decodePayload(value: Prisma.JsonValue): AuditOutboxPayload | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const validEventTypes = new Set<string>(Object.values(securityEventTypes));

  if (
    typeof record.eventType !== 'string' ||
    !validEventTypes.has(record.eventType) ||
    typeof record.userId !== 'string' ||
    typeof record.ipAddress !== 'string' ||
    typeof record.userAgent !== 'string'
  ) {
    return null;
  }

  const eventData = record.eventData;
  if (
    eventData !== undefined &&
    (typeof eventData !== 'object' || eventData === null || Array.isArray(eventData))
  ) {
    return null;
  }

  return {
    eventType: record.eventType as SecurityEventType,
    userId: record.userId,
    ipAddress: record.ipAddress,
    userAgent: record.userAgent,
    ...(eventData ? { eventData: eventData as Record<string, unknown> } : {}),
  };
}

@Injectable()
export class LoginAuditOutboxProcessor {
  private readonly logger = new Logger(LoginAuditOutboxProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  @Cron('*/2 * * * * *', { waitForCompletion: true })
  async processPendingEvents(): Promise<void> {
    for (let processed = 0; processed < MAX_BATCH_SIZE; processed += 1) {
      let selectedId: string | undefined;
      let operation = 'poll';

      try {
        const row = await this.prisma.$transaction(async (transaction) => {
          const rows = await transaction.$queryRaw<OutboxRow[]>`
            SELECT "id", "payload", "created_at" AS "createdAt"
            FROM "login_audit_outbox"
            WHERE "available_at" <= CURRENT_TIMESTAMP
            ORDER BY "created_at"
            LIMIT 1
            FOR UPDATE SKIP LOCKED
          `;

          const currentRow = rows[0];
          if (!currentRow) {
            return null;
          }

          selectedId = currentRow.id;
          const payload = decodePayload(currentRow.payload);
          if (!payload) {
            operation = 'reschedule malformed event';
            const isRetained = await this.retryOrDrop(transaction, currentRow.id, 'InvalidPayload');
            if (isRetained) {
              this.logger.error(
                `Deferred malformed authentication audit outbox event ${currentRow.id}`,
              );
            } else {
              this.logger.warn(
                `Dropped malformed authentication audit outbox event ${currentRow.id} after ${MAX_OUTBOX_RETRIES} failed attempts`,
              );
            }
            return null;
          }

          operation = 'persist event';
          await this.auditLogService.persistOutboxEvent(
            transaction,
            payload,
            currentRow.createdAt,
          );
          operation = 'delete processed event';
          await transaction.$executeRaw`
            DELETE FROM "login_audit_outbox" WHERE "id" = ${currentRow.id}
          `;

          return currentRow;
        }, { maxWait: MAX_TRANSACTION_START_WAIT_MS });

        if (!row) {
          return;
        }
      } catch (error) {
        const errorDetails = getErrorDetails(error);
        const errorType = errorDetails.code ?? errorDetails.name;
        const errorSummary = `${errorDetails.name}${errorDetails.code ? ` (${errorDetails.code})` : ''}: ${errorDetails.message}`;
        const failureMessage = `Failed to ${operation} authentication audit outbox event ${selectedId ?? 'unknown'}: ${errorSummary}`;
        if (operation === 'poll' && errorDetails.code === 'P2028') {
          this.logger.warn(
            `${failureMessage}. The next scheduled poll will retry.`,
          );
        } else {
          this.logger.error(failureMessage);
        }

        if (!selectedId) {
          return;
        }

        const eventId = selectedId;
        try {
          const shouldRetry = await this.prisma.$transaction(async (transaction) =>
            this.retryOrDrop(transaction, eventId, errorType),
          );

          if (shouldRetry) {
            this.logger.warn(
              `Requeued authentication audit outbox event ${eventId} after transient persistence failure`,
            );
          } else {
            this.logger.warn(
              `Dropped authentication audit outbox event ${eventId} after ${MAX_OUTBOX_RETRIES} persistence failures`,
            );
          }
        } catch (retryError) {
          const retryErrorDetails = getErrorDetails(retryError);
          this.logger.error(
            `Failed to requeue authentication audit outbox event ${eventId}: ${retryErrorDetails.name}${retryErrorDetails.code ? ` (${retryErrorDetails.code})` : ''}: ${retryErrorDetails.message}`,
          );
          return;
        }
      }
    }
  }

  private async retryOrDrop(
    transaction: Prisma.TransactionClient,
    id: string,
    errorType: string,
  ): Promise<boolean> {
    const rows = await transaction.$queryRaw<{ attempts: number }[]>`
      SELECT "attempts"
      FROM "login_audit_outbox"
      WHERE "id" = ${id}
      FOR UPDATE
    `;

    const attempts = Number(rows[0]?.attempts ?? 0);
    if (attempts >= MAX_OUTBOX_RETRIES) {
      await transaction.$executeRaw`
        DELETE FROM "login_audit_outbox" WHERE "id" = ${id}
      `;
      return false;
    }

    await transaction.$executeRaw`
      UPDATE "login_audit_outbox"
      SET
        "attempts" = "attempts" + 1,
        "available_at" = CURRENT_TIMESTAMP
          + (
            LEAST(${MAX_BACKOFF_SECONDS}, POWER(2, LEAST("attempts", 8))) * INTERVAL '1 second'
          ),
        "last_error" = ${errorType.slice(0, 100)}
      WHERE "id" = ${id}
    `;

    return true;
  }
}

