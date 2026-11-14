import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '#infrastructure/prisma/prisma.service';
import { MetricsService } from '#infrastructure/metrics/metrics.service';
import { handleServiceError } from '#common/utils/error.utils';
import { ProgressService } from './progress.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

type XapiRecord = Record<string, unknown>;

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
      const verb = this.normalizeVerb(statement?.verb);
      const actor = statement?.actor || { id: userId };
      const object = statement?.object;
      const result = statement?.result;
      const context = statement?.context;
      const occurredAt = statement?.timestamp
        ? new Date(statement.timestamp)
        : new Date();

      // Extract a stable xAPI statement id (if present) for idempotency
      const rawStatementId =
        statement?.id ||
        statement?.statementId ||
        statement?.statement_id ||
        statement?.raw?.id ||
        undefined;
      let statementId =
        typeof rawStatementId === 'string' && rawStatementId.trim()
          ? rawStatementId.trim()
          : undefined;

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

      if (userId && this.isLearningVerb(verb) && !statementId) {
        throw new BadRequestException(
          'A stable xAPI statement ID is required for learning progress.',
        );
      }

      const idempotencyKey = statementId
        ? `xapi:${createHash('sha256').update(statementId).digest('hex')}`
        : undefined;
      let created;
      let duplicate = false;
      let existing = statementId
        ? await this.prisma.xapiStatement.findUnique({
            where: { statementId } as any,
          })
        : null;
      if (existing) {
        this.assertSameStatementOwnerAndContent(existing, userId, statement);
        duplicate = true;
        this.recordDuplicateStatement(statementId!, userId);
      }

      const objectId =
        typeof object?.id === 'string' ? object.id : undefined;
      const objectIds = objectId?.match(
        /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
      );
      const candidateMaterialId = objectIds?.[objectIds.length - 1];
      const material = candidateMaterialId
        ? await this.prisma.material.findUnique({
            where: { id: candidateMaterialId },
            select: { id: true },
          })
        : null;
      const materialId = material?.id;
      const contextCourseId = this.getContextId(context, 'course-id');
      const contextUnitId = this.getContextId(context, 'unit-id');

      if (existing) {
        created = existing;
      } else {
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
          if (error.code === 'P2002' && statementId) {
            existing = await this.prisma.xapiStatement.findUnique({
              where: { statementId } as any,
            });
            if (existing) {
              this.assertSameStatementOwnerAndContent(existing, userId, statement);
              created = existing;
              duplicate = true;
              this.recordDuplicateStatement(statementId, userId);
            } else {
              throw error;
            }
          } else {
            throw error;
          }
        }
      }

      if (userId && this.isLearningVerb(verb)) {
        await this.recordLearningProgress({
          userId,
          verb,
          materialId: existing?.materialId ?? materialId,
          courseId: contextCourseId,
          unitId: contextUnitId,
          result,
          idempotencyKey: idempotencyKey!,
          occurredAt: existing?.occurredAt ?? occurredAt,
        });
      }

      if (!duplicate) {
        this.events.emit('xapi.statement.created', { id: created.id, userId });
      }

      return created;
    } catch (error) {
      this.metrics.failedProcessing++;
      this.metricsService.recordXapiProcessingFailure('processing_error');
      handleServiceError(error, this.logger, 'saveStatement');
    }
  }

  private normalizeVerb(verb: unknown): string {
    if (typeof verb === 'string') {
      return verb.split(/[/#]/).filter(Boolean).pop()?.toLowerCase() ?? '';
    }
    if (typeof verb !== 'object' || verb === null) {
      return '';
    }

    const record = verb as XapiRecord;
    const id = record['id'];
    if (typeof id === 'string') {
      return id.split(/[/#]/).filter(Boolean).pop()?.toLowerCase() ?? '';
    }

    const display = record['display'];
    if (typeof display === 'object' && display !== null) {
      const labels = display as XapiRecord;
      const label = labels['en-US'] ?? labels['en'];
      if (typeof label === 'string') {
        return label.toLowerCase();
      }
    }

    return '';
  }

  private getContextId(context: unknown, suffix: string): string | undefined {
    const value = this.getContextValue(context, suffix);
    return typeof value === 'string' ? value : undefined;
  }

  private getContextValue(context: unknown, suffix: string): unknown {
    if (typeof context !== 'object' || context === null) {
      return undefined;
    }
    const extensions = (context as XapiRecord)['extensions'];
    if (typeof extensions !== 'object' || extensions === null) {
      return undefined;
    }

    const entry = Object.entries(extensions as XapiRecord).find(
      ([key]) => key.toLowerCase().endsWith(`/${suffix}`),
    );
    return entry?.[1];
  }

  private isLearningVerb(verb: string): boolean {
    return [
      'attempted',
      'completed',
      'experienced',
      'passed',
      'played',
      'progressed',
    ].includes(verb);
  }

  private assertSameStatementOwnerAndContent(
    existing: { userId: string | null; raw: unknown },
    userId: string | undefined,
    statement: unknown,
  ): void {
    if (existing.userId !== (userId ?? null)) {
      throw new ForbiddenException(
        'The xAPI statement ID is already associated with another user.',
      );
    }
    if (this.canonicalize(existing.raw) !== this.canonicalize(statement)) {
      throw new ConflictException(
        'The xAPI statement ID was already used with different statement content.',
      );
    }
  }

  private recordDuplicateStatement(
    statementId: string,
    userId: string | undefined,
  ): void {
    this.metrics.duplicatesDetected++;
    this.metricsService.recordXapiDuplicate();
    this.metricsService.updateXapiDuplicateRate(
      this.metrics.totalStatementsProcessed,
      this.metrics.duplicatesDetected,
    );
    this.logger.debug('Duplicate xAPI statement detected', {
      statementId,
      duplicateCount: this.metrics.duplicatesDetected,
    });
    this.events.emit('xapi.duplicate.detected', { statementId, userId });
  }

  private async recordLearningProgress(input: {
    userId: string;
    verb: string;
    materialId?: string;
    courseId?: string;
    unitId?: string;
    result?: XapiRecord;
    idempotencyKey: string;
    occurredAt: Date;
  }): Promise<void> {
    const {
      userId,
      verb,
      materialId,
      courseId,
      unitId,
      result,
      idempotencyKey,
      occurredAt,
    } = input;
    const material = materialId
      ? await this.prisma.material.findUnique({
          where: { id: materialId },
          select: { id: true, topicId: true, unitId: true },
        })
      : null;
    const resolvedUnitId = material?.unitId ?? unitId;
    const unit = resolvedUnitId
      ? await this.prisma.unit.findUnique({
          where: { id: resolvedUnitId },
          select: { id: true, courseId: true },
        })
      : null;
    const resolvedCourseId = unit?.courseId ?? courseId;

    if (
      material &&
      resolvedCourseId &&
      ['completed', 'experienced', 'passed', 'played', 'progressed'].includes(
        verb,
      )
    ) {
      const extensions =
        typeof result?.['extensions'] === 'object' &&
        result['extensions'] !== null
          ? (result['extensions'] as XapiRecord)
          : {};
      const progressValue = extensions[
        Object.keys(extensions).find((key) => key.toLowerCase().endsWith('/progress')) ??
          ''
      ];
      const isComplete =
        ['completed', 'passed'].includes(verb) ||
        result?.['completion'] === true ||
        (typeof progressValue === 'number' && progressValue >= 100);

      if (verb === 'experienced' || verb === 'played') {
        await this.progressService.markMaterialAsRead(
          userId,
          material.id,
          BigInt(occurredAt.getTime()),
          idempotencyKey,
        );
        return;
      }

      const progressPercentage =
        isComplete
          ? 100
          : typeof progressValue === 'number'
            ? Math.min(100, Math.max(0, progressValue))
            : 0;

      await this.progressService.updateUnitMaterialTopicProgress(userId, {
        courseId: resolvedCourseId,
        unitId: resolvedUnitId,
        materialId: material.id,
        topicId: material.topicId ?? undefined,
        status: isComplete ? 'completed' : 'inProgress',
        progressPercentage,
        timeSpent: 0,
        clientTimestamp: occurredAt.getTime(),
        idempotencyKey,
      });
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
