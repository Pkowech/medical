import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '#infrastructure/prisma/prisma.service';
import { MetricsService } from '#infrastructure/metrics/metrics.service';
import { handleServiceError } from '#common/utils/error.utils';
import { ProgressService } from './progress.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class XapiService {
  private logger = new Logger(XapiService.name);

  // Health metrics for monitoring duplicate detection
  private metrics = {
    totalStatementsProcessed: 0,
    duplicatesDetected: 0,
    canonicalHashesComputed: 0,
    failedProcessing: 0,
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly progressService: ProgressService,
    private readonly events: EventEmitter2,
    private readonly metricsService: MetricsService,
  ) {}

  async saveStatement(statement: any, userId?: string): Promise<any> {
    try {
      this.metrics.totalStatementsProcessed++;
      // Record to central metrics service
      this.metricsService.recordXapiProcessed('success');

      // statement is expected to be a Tin Can/xAPI statement object
      const verb = statement?.verb?.id || statement?.verb?.display || 'unknown';
      const actor = statement?.actor || { id: userId };
      const object = statement?.object;
      const result = statement?.result;
      const context = statement?.context;
      const occurredAt = statement?.timestamp
        ? new Date(statement.timestamp)
        : new Date();

      // Extract a stable xAPI statement id (if present) for idempotency
      let statementId =
        statement?.id ||
        statement?.statementId ||
        statement?.statement_id ||
        statement?.raw?.id ||
        undefined;

      // If no explicit id, compute a canonical SHA-256 of the statement as a fallback
      if (!statementId) {
        try {
          const canonical = this.canonicalize(statement);
          statementId = createHash('sha256').update(canonical).digest('hex');
          this.metrics.canonicalHashesComputed++;
          this.metricsService.recordXapiCanonicalHashComputed();
          this.logger.debug(
            'Computed canonical statementId (sha256) for incoming xAPI statement',
            { statementId },
          );
        } catch (err) {
          this.logger.warn(
            'Failed to compute canonical statement hash for xAPI statement',
            (err as any)?.message || err,
          );
        }
      }

      if (statementId) {
        const existing = await this.prisma.xapiStatement.findUnique({
          where: { statementId } as any,
        });
        if (existing) {
          this.metrics.duplicatesDetected++;
          this.metricsService.recordXapiDuplicate();
          // update derived rate gauge
          this.metricsService.updateXapiDuplicateRate(
            this.metrics.totalStatementsProcessed,
            this.metrics.duplicatesDetected,
          );
          this.logger.debug(
            'Duplicate xAPI statement detected; returning existing',
            { statementId, duplicateCount: this.metrics.duplicatesDetected },
          );
          // Emit duplicate detection event for monitoring
          this.events.emit('xapi.duplicate.detected', { statementId, userId });
          return existing;
        }
      }

      // Try to find materialId from object.id or context
      let materialId: string | undefined;
      if (object?.id && typeof object.id === 'string') {
        // Object IDs may be in format '/api/materials/{id}' or 'urn:material:{id}' or similar
        const match = object.id.match(
          /materials\/(?<id>[0-9a-fA-F-]{36})|urn:material:(?<urn>[0-9a-fA-F-]{36})/,
        );
        if (match && (match.groups?.id || match.groups?.urn)) {
          materialId = match.groups?.id || match.groups?.urn;
        }
      }

      let created;
      try {
        created = await this.prisma.xapiStatement.create({
          data: {
            userId: userId || undefined,
            materialId: materialId || undefined,
            statementId: statementId || undefined,
            verb: typeof verb === 'string' ? verb : JSON.stringify(verb),
            actor: actor || undefined,
            object: object || undefined,
            result: result || undefined,
            context: context || undefined,
            raw: statement,
            occurredAt,
          },
        });
      } catch (error: any) {
        // Handle unique constraint violation (P2002) for race conditions
        if (error.code === 'P2002' && statementId) {
          this.logger.log(
            'Race condition detected for statementId, retrieving existing record',
            { statementId },
          );
          const existing = await this.prisma.xapiStatement.findUnique({
            where: { statementId } as any,
          });
          if (existing) {
            return existing;
          }
        }
        throw error;
      }

      // Optional: map verbs to progress
      if (
        materialId &&
        (verb.includes('view') ||
          verb.includes('read') ||
          verb.includes('watched'))
      ) {
        try {
          // If result or context indicates percent, use that
          const percent = result?.completion || result?.progress || undefined;
          if (userId) {
            if (percent && typeof percent === 'number') {
              await this.progressService.updateUnitMaterialTopicProgress(
                userId,
                {
                  materialId,
                  status: percent >= 100 ? 'completed' : 'inProgress',
                  progressPercentage: Math.round(percent),
                  timeSpent: result?.timeSpent ?? 0,
                } as any,
              );
            } else {
              // Mark read if no percent but a view/read verb
              await this.progressService.markMaterialAsRead(userId, materialId);
            }
          } else {
            this.logger.warn('Skipping progress update; userId undefined');
          }
        } catch (err) {
          this.logger.warn(
            'Failed to map xAPI statement to progress',
            (err as any)?.message || err,
          );
        }
      }

      // fire analytics hook
      this.events.emit('xapi.statement.created', { id: created.id, userId });

      return created;
    } catch (error) {
      this.metrics.failedProcessing++;
      this.metricsService.recordXapiProcessingFailure('processing_error');
      handleServiceError(error, this.logger, 'saveStatement');
    }
  }

  // Health check: return current duplicate detection metrics
  getHealthMetrics(): any {
    const dupRate =
      this.metrics.totalStatementsProcessed > 0
        ? (
            (this.metrics.duplicatesDetected /
              this.metrics.totalStatementsProcessed) *
            100
          ).toFixed(2)
        : '0.00';

    return {
      status: 'ok',
      xapi: {
        totalProcessed: this.metrics.totalStatementsProcessed,
        duplicatesDetected: this.metrics.duplicatesDetected,
        duplicateRatePercent: parseFloat(dupRate),
        canonicalHashesComputed: this.metrics.canonicalHashesComputed,
        failedProcessing: this.metrics.failedProcessing,
      },
    };
  }

  // Helper: deterministic canonicalization of an object for stable hashing.
  // Produces a JSON string with keys sorted recursively so semantically-equal
  // statements with different key order produce the same canonical form.
  // Ignores volatile fields like storedAt, createdAt to focus on semantic content.
  private canonicalize(input: any): string {
    // List of volatile fields to exclude from canonicalization
    const volatileFields = new Set([
      'storedAt',
      'stored_at',
      'createdAt',
      'created_at',
      'updatedAt',
      'updated_at',
    ]);

    const normalize = (val: any): any => {
      if (val === null || val === undefined) {
        return null;
      }
      if (Array.isArray(val)) {
        return val.map(normalize);
      }
      if (typeof val === 'object') {
        // For Date objects, convert to ISO string
        if (val instanceof Date) {
          return val.toISOString();
        }
        const out: Record<string, any> = {};
        const keys = Object.keys(val)
          .filter((k) => !volatileFields.has(k)) // Exclude volatile fields
          .sort();
        for (const k of keys) {
          out[k] = normalize(val[k]);
        }
        return out;
      }
      // primitives
      return val;
    };

    const normalized = normalize(input);
    return JSON.stringify(normalized);
  }
}
