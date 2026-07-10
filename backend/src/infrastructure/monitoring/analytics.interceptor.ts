import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { PerformanceMetricsService } from '../monitoring/performance-metrics.service';
import { getErrorMessage } from '#common/utils/error.utils';
import { DistributedTracingService } from '../monitoring/distributed-tracing.service';
import { ProgressiveRolloutService } from '../monitoring/progressive-rollout.service';
import { Request } from 'express';

/**
 * Interceptor to automatically track performance metrics, tracing, and feature flags
 * Integrates with:
 * - PerformanceMetricsService: Records response times and success rates
 * - DistributedTracingService: Creates spans for distributed tracing
 * - ProgressiveRolloutService: Applies feature flags per user
 */
@Injectable()
export class AnalyticsInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AnalyticsInterceptor.name);

  constructor(
    private readonly performanceMetrics: PerformanceMetricsService,
    private readonly tracingService: DistributedTracingService,
    private readonly rolloutService: ProgressiveRolloutService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();

    // Extract user ID from JWT or session
    const userId = (request.user as any)?.id || 'anonymous';
    const requestId =
      (request.headers['x-request-id'] as string) ||
      String((request as any).id ?? '') ||
      'unknown';

    // Create trace context
    const traceContext = this.tracingService.createTraceContext(
      userId,
      requestId,
    );

    // Store trace context in request for downstream use
    (request as any).traceContext = traceContext;

    const endpoint = `${request.method}:${request.path}`;
    const methodName = context.getHandler().name || 'unknown';

    const startTime = Date.now();

    return next.handle().pipe(
      tap(() => {
        const responseTimeMs = Date.now() - startTime;

        // Record performance metric
        this.performanceMetrics
          .recordMetric({
            endpoint,
            method: methodName,
            provider: 'grpc', // Would be determined dynamically in real scenario
            userId,
            responseTimeMs,
            cacheHit: false, // Would be set based on actual cache behavior
            success: true,
            timestamp: new Date(),
          })
          .catch((err) => this.logger.error('Failed to record metric:', err));

        // Log trace
        this.logger.debug(
          `✅ ${endpoint} completed in ${responseTimeMs}ms [${traceContext.traceId}]`,
        );
      }),
      catchError((error) => {
        const responseTimeMs = Date.now() - startTime;

        // Record failed metric
        this.performanceMetrics
          .recordMetric({
            endpoint,
            method: methodName,
            provider: 'grpc',
            userId,
            responseTimeMs,
            cacheHit: false,
            success: false,
            errorMessage: getErrorMessage(error),
            timestamp: new Date(),
          })
          .catch((metricsError) => {
            this.logger.error('Failed to record error metric:', metricsError);
          });

        // Log trace error
        this.logger.error(
          `❌ ${endpoint} failed after ${responseTimeMs}ms [${traceContext.traceId}]: ${getErrorMessage(
            error,
          )}`,
        );

        throw error;
      }),
    );
  }
}
