import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { v4 as uuidv4 } from 'uuid';

export interface TraceSpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  operationName: string;
  serviceName: string;
  provider: 'grpc' | 'local' | 'http';
  startTime: Date;
  endTime?: Date;
  durationMs?: number;
  status: 'pending' | 'success' | 'error';
  tags: Record<string, string | number | boolean>;
  logs: Array<{
    timestamp: Date;
    message: string;
    level: 'info' | 'warn' | 'error';
  }>;
  errorMessage?: string;
}

export interface TraceContext {
  traceId: string;
  spanId: string;
  userId?: string;
  requestId?: string;
}

@Injectable()
export class DistributedTracingService {
  private readonly logger = new Logger(DistributedTracingService.name);
  private readonly tracePrefix = 'trace:';
  private readonly spanPrefix = 'span:';
  private readonly localTraces = new Map<string, TraceSpan>();

  constructor(private readonly redisService: RedisService) {}

  /**
   * Create a new trace context
   */
  createTraceContext(userId?: string, requestId?: string): TraceContext {
    return {
      traceId: uuidv4(),
      spanId: uuidv4(),
      userId,
      requestId,
    };
  }

  /**
   * Start a new span within a trace
   */
  startSpan(
    traceContext: TraceContext,
    operationName: string,
    serviceName: string,
    provider: 'grpc' | 'local' | 'http',
  ): Promise<TraceSpan> {
    const span: TraceSpan = {
      traceId: traceContext.traceId,
      spanId: uuidv4(),
      parentSpanId: traceContext.spanId,
      operationName,
      serviceName,
      provider,
      startTime: new Date(),
      status: 'pending',
      tags: {
        userId: traceContext.userId || 'anonymous',
        requestId: traceContext.requestId || 'unknown',
      },
      logs: [],
    };

    this.localTraces.set(span.spanId, span);
    return Promise.resolve(span);
  }

  /**
   * Add a tag to a span
   */
  addTag(span: TraceSpan, key: string, value: string | number | boolean): void {
    span.tags[key] = value;
  }

  /**
   * Add a log entry to a span
   */
  addLog(
    span: TraceSpan,
    message: string,
    level: 'info' | 'warn' | 'error' = 'info',
  ): void {
    span.logs.push({ timestamp: new Date(), message, level });
  }

  /**
   * End a span and record it
   */
  async endSpan(
    span: TraceSpan,
    status: 'success' | 'error' = 'success',
    errorMessage?: string,
  ): Promise<void> {
    span.endTime = new Date();
    span.durationMs = span.endTime.getTime() - span.startTime.getTime();
    span.status = status;
    if (errorMessage) {
      span.errorMessage = errorMessage;
    }

    try {
      // Store in Redis for centralized tracing system
      const spanKey = `${this.spanPrefix}${span.traceId}:${span.spanId}`;
      await this.redisService.set(
        spanKey,
        JSON.stringify(span),
        3600, // Keep for 1 hour
      );

      // Add to trace aggregation
      const traceKey = `${this.tracePrefix}${span.traceId}`;
      const existingSpans = await this.redisService.getList(
        `${traceKey}:spans`,
        0,
        -1,
      );
      const updatedSpans = [spanKey, ...existingSpans].slice(0, 1000);
      await this.redisService.setList(`${traceKey}:spans`, updatedSpans);

      // Log span completion
      const statusEmoji = status === 'success' ? '✅' : '❌';
      this.logger.debug(
        `${statusEmoji} Span: ${span.operationName} (${span.provider}) - ${span.durationMs}ms [${span.spanId}]`,
      );
    } catch (error) {
      this.logger.error(`Failed to end span:`, error);
    }

    this.localTraces.delete(span.spanId);
  }

  /**
   * Get full trace with all spans
   */
  async getTrace(traceId: string): Promise<{
    traceId: string;
    spans: TraceSpan[];
    totalDurationMs: number;
    successRate: number;
  } | null> {
    try {
      const traceKey = `${this.tracePrefix}${traceId}`;
      const spanKeys = await this.redisService.getList(
        `${traceKey}:spans`,
        0,
        -1,
      );

      if (!spanKeys || spanKeys.length === 0) {
        return null;
      }

      const spans: TraceSpan[] = [];
      for (const spanKey of spanKeys) {
        const spanJson = await this.redisService.get<string>(spanKey);
        if (spanJson) {
          spans.push(JSON.parse(spanJson));
        }
      }

      if (spans.length === 0) {
        return null;
      }

      // Calculate metrics
      const sortedSpans = spans.sort(
        (a, b) => a.startTime.getTime() - b.startTime.getTime(),
      );
      const firstSpan = sortedSpans[0];
      const lastSpan = sortedSpans[sortedSpans.length - 1];

      const totalDurationMs =
        (lastSpan.endTime?.getTime() ?? 0) - firstSpan.startTime.getTime();
      const successfulSpans = spans.filter(
        (s) => s.status === 'success',
      ).length;
      const successRate = successfulSpans / spans.length;

      return {
        traceId,
        spans: sortedSpans,
        totalDurationMs,
        successRate,
      };
    } catch (error) {
      this.logger.error(`Failed to get trace:`, error);
      return null;
    }
  }

  /**
   * Get traces for a specific user
   */
  async getUserTraces(
    userId: string,
    limit: number = 100,
  ): Promise<TraceSpan[]> {
    try {
      const pattern = `${this.spanPrefix}*`;
      const spanKeys = await this.redisService.keys(pattern);

      const userSpans: TraceSpan[] = [];

      for (const key of spanKeys.slice(0, limit)) {
        const spanJson = await this.redisService.get<string>(key);
        if (spanJson) {
          const span = JSON.parse(spanJson) as TraceSpan;
          if (span.tags.userId === userId) {
            userSpans.push(span);
          }
        }
      }

      return userSpans;
    } catch (error) {
      this.logger.error(`Failed to get user traces:`, error);
      return [];
    }
  }

  /**
   * Generate trace summary
   */
  async generateTraceSummary(traceId: string): Promise<string> {
    const trace = await this.getTrace(traceId);
    if (!trace) {
      return 'Trace not found';
    }

    const lines: string[] = [
      `\n📊 Trace Summary: ${traceId}`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `Total Duration: ${trace.totalDurationMs}ms`,
      `Success Rate: ${(trace.successRate * 100).toFixed(1)}%`,
      `Span Count: ${trace.spans.length}`,
      `\nSpans:`,
    ];

    for (const span of trace.spans) {
      const indent = span.parentSpanId ? '  └─' : '  ├─';
      const statusIcon = span.status === 'success' ? '✅' : '❌';
      lines.push(
        `${indent} ${statusIcon} ${span.operationName} (${span.provider}) - ${span.durationMs}ms`,
      );

      if (span.errorMessage) {
        lines.push(`     ⚠️ Error: ${span.errorMessage}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Get performance analysis across traces
   */
  async getPerformanceAnalysis(filter?: {
    provider?: string;
    operation?: string;
    userId?: string;
  }): Promise<{
    averageDurationMs: number;
    p95DurationMs: number;
    p99DurationMs: number;
    errorRate: number;
    totalTraces: number;
  } | null> {
    try {
      const pattern = `${this.spanPrefix}*`;
      const spanKeys = await this.redisService.keys(pattern);

      const spans: TraceSpan[] = [];

      for (const key of spanKeys) {
        const spanJson = await this.redisService.get<string>(key);
        if (spanJson) {
          const span = JSON.parse(spanJson) as TraceSpan;

          // Apply filters
          if (filter?.provider && span.provider !== filter.provider) {
            continue;
          }
          if (filter?.operation && span.operationName !== filter.operation) {
            continue;
          }
          if (filter?.userId && span.tags.userId !== filter.userId) {
            continue;
          }

          spans.push(span);
        }
      }

      if (spans.length === 0) {
        return null;
      }

      const durations = spans
        .filter((s) => s.durationMs !== undefined)
        .map((s) => s.durationMs!)
        .sort((a, b) => (a ?? 0) - (b ?? 0));

      const errors = spans.filter((s) => s.status === 'error').length;

      return {
        averageDurationMs:
          durations.reduce((a, b) => (a ?? 0) + (b ?? 0), 0) / durations.length,
        p95DurationMs: durations[Math.floor(durations.length * 0.95)] ?? 0,
        p99DurationMs: durations[Math.floor(durations.length * 0.99)] ?? 0,
        errorRate: errors / spans.length,
        totalTraces: new Set(spans.map((s) => s.traceId)).size,
      };
    } catch (error) {
      this.logger.error(`Failed to get performance analysis:`, error);
      return null;
    }
  }

  /**
   * Clear old traces (run periodically)
   */
  async clearOldTraces(olderThanHours: number = 24): Promise<void> {
    try {
      const pattern = `${this.tracePrefix}*`;
      const keys = await this.redisService.keys(pattern);

      let deleted = 0;
      for (const key of keys) {
        try {
          await this.redisService.del(key);
          deleted++;
        } catch {
          // Continue on error
        }
      }

      this.logger.log(
        `Cleared ${deleted} traces older than ${olderThanHours} hours`,
      );
    } catch (error) {
      this.logger.error(`Failed to clear old traces:`, error);
    }
  }
}
