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

function decodePayload(value: Prisma.JsonValue): AuditOutboxPayload | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }

  const record = value;
  const validEventTypes: string[] = Object.values(securityEventTypes);
  if (
    typeof record.eventType !== 'string' ||
    !validEventTypes.includes(record.eventType) ||
    typeof record.userId !== 'string' ||
    typeof record.ipAddress !== 'string' ||
    typeof record.userAgent !== 'string'
  ) {
    return null;
  }

  const eventData = record.eventData;
  if (
    eventData !== undefined &&
    (typeof eventData !== 'object' ||
      eventData === null ||
      Array.isArray(eventData))
  ) {
    return null;
  }

  return {
    eventType: record.eventType as SecurityEventType,
    userId: record.userId,
    ipAddress: record.ipAddress,
    userAgent: record.userAgent,
    ...(eventData ? { eventData } : {}),
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
    for (let processed = 0; processed < 10; processed += 1) {
      let selectedId: string | undefined;

      try {
        const result = await this.prisma.$transaction(async (transaction) => {
          const rows = await transaction.$queryRaw<OutboxRow[]>`
            SELECT "id", "payload", "created_at" AS "createdAt"
            FROM "login_audit_outbox"
            WHERE "available_at" <= CURRENT_TIMESTAMP
            ORDER BY "created_at"
            LIMIT 1
            FOR UPDATE SKIP LOCKED
          `;
          const row = rows[0];
          if (!row) {
            return 'empty' as const;
          }
          selectedId = row.id;

          const payload = decodePayload(row.payload);
          if (!payload) {
            await this.deferEvent(transaction, row.id, 'InvalidPayload');
            return 'deferred' as const;
          }

          await this.auditLogService.persistOutboxEvent(
            transaction,
            payload,
            row.createdAt,
          );
          await transaction.$executeRaw`
            DELETE FROM "login_audit_outbox" WHERE "id" = ${row.id}
          `;
          return 'processed' as const;
        });

        if (result === 'empty') {
          return;
        }
        if (result === 'deferred') {
          this.logger.error(
            `Deferred malformed authentication audit outbox event ${selectedId}`,
          );
        }
      } catch (error) {
        const errorType = error instanceof Error ? error.name : 'UnknownError';
        this.logger.error(
          `Failed to persist authentication audit outbox event ${selectedId ?? 'unknown'}: ${errorType}`,
        );
        if (selectedId) {
          const failedId = selectedId;
          try {
            await this.prisma.$transaction(async (transaction) => {
              await this.deferEvent(transaction, failedId, errorType);
            });
          } catch (retryError) {
            const retryErrorType =
              retryError instanceof Error ? retryError.name : 'UnknownError';
            this.logger.error(
              `Failed to defer authentication audit outbox event ${failedId}: ${retryErrorType}`,
            );
            return;
          }
        } else {
          return;
        }
      }
    }
  }

  private async deferEvent(
    transaction: Prisma.TransactionClient,
    id: string,
    errorType: string,
  ): Promise<void> {
    await transaction.$executeRaw`
      UPDATE "login_audit_outbox"
      SET
        "attempts" = "attempts" + 1,
        "available_at" = CURRENT_TIMESTAMP
          + (LEAST(300, POWER(2, LEAST("attempts", 8))) * INTERVAL '1 second'),
        "last_error" = ${errorType.slice(0, 100)}
      WHERE "id" = ${id}
    `;
  }
}
