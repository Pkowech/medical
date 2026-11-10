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

  @Cron('*/2 * * * * *')
  async processPendingEvents(): Promise<void> {
    for (let processed = 0; processed < MAX_BATCH_SIZE; processed += 1) {
      let selectedId: string | undefined;

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

          await this.auditLogService.persistOutboxEvent(
            transaction,
            payload,
            currentRow.createdAt,
          );
          await transaction.$executeRaw`
            DELETE FROM "login_audit_outbox" WHERE "id" = ${currentRow.id}
          `;

          return currentRow;
        });

        if (!row) {
          return;
        }
      } catch (error) {
        const errorType = error instanceof Error ? error.name : 'UnknownError';
        this.logger.error(
          `Failed to persist authentication audit outbox event ${selectedId ?? 'unknown'}: ${errorType}`,
        );

        if (!selectedId) {
          return;
        }

        try {
          const shouldRetry = await this.prisma.$transaction(async (transaction) =>
            this.retryOrDrop(transaction, selectedId!, errorType),
          );

          if (shouldRetry) {
            this.logger.warn(
              `Requeued authentication audit outbox event ${selectedId} after transient persistence failure`,
            );
          } else {
            this.logger.warn(
              `Dropped authentication audit outbox event ${selectedId} after ${MAX_OUTBOX_RETRIES} persistence failures`,
            );
          }
        } catch (retryError) {
          const retryErrorType =
            retryError instanceof Error ? retryError.name : 'UnknownError';
          this.logger.error(
            `Failed to requeue authentication audit outbox event ${selectedId}: ${retryErrorType}`,
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

