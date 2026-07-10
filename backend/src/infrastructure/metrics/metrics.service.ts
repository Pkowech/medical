import { Injectable, OnModuleInit } from '@nestjs/common';
import { Counter, Gauge, Registry, collectDefaultMetrics } from 'prom-client';

@Injectable()
export class MetricsService implements OnModuleInit {
  private register: Registry;
  private requestCounter: Counter;
  private errorCounter: Counter;
  private responseTimeHistogram: Gauge;
  private activeConnections: Gauge;
  private memoryUsage: Gauge;
  // xAPI-specific metrics
  private xapiStatementsTotal: Counter;
  private xapiDuplicatesTotal: Counter;
  private xapiCanonicalHashesTotal: Counter;
  private xapiProcessingFailuresTotal: Counter;
  private xapiDuplicateRatePercent: Gauge;
  // Analytics metrics
  private analyticsRequestsTotal: Counter;
  private analyticsDegradationTotal: Counter;
  private analyticsDegradationRatePercent: Gauge;

  constructor() {
    // Create a new registry
    this.register = new Registry();

    // Request counter
    this.requestCounter = new Counter({
      name: 'medtrack_http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'path', 'status'],
      registers: [this.register],
    });

    // Error counter
    this.errorCounter = new Counter({
      name: 'medtrack_http_errors_total',
      help: 'Total number of HTTP errors',
      labelNames: ['method', 'path', 'status', 'error'],
      registers: [this.register],
    });

    // Response time histogram
    this.responseTimeHistogram = new Gauge({
      name: 'medtrack_http_response_time_seconds',
      help: 'HTTP response time in seconds',
      labelNames: ['method', 'path'],
      registers: [this.register],
    });

    // Active connections gauge
    this.activeConnections = new Gauge({
      name: 'medtrack_active_connections',
      help: 'Number of active connections',
      registers: [this.register],
    });

    // Memory usage gauge
    this.memoryUsage = new Gauge({
      name: 'medtrack_memory_usage_bytes',
      help: 'Process memory usage in bytes',
      registers: [this.register],
      collect() {
        const usage = process.memoryUsage();
        this.set(usage.heapUsed);
      },
    });

    // xAPI metrics
    this.xapiStatementsTotal = new Counter({
      name: 'xapi_statements_total',
      help: 'Total number of xAPI statements processed',
      labelNames: ['status'],
      registers: [this.register],
    });

    this.xapiDuplicatesTotal = new Counter({
      name: 'xapi_duplicates_total',
      help: 'Total number of duplicate xAPI statements detected',
      registers: [this.register],
    });

    this.xapiCanonicalHashesTotal = new Counter({
      name: 'xapi_canonical_hashes_total',
      help: 'Total number of canonical SHA-256 hashes computed as fallback',
      registers: [this.register],
    });

    this.xapiProcessingFailuresTotal = new Counter({
      name: 'xapi_processing_failures_total',
      help: 'Total number of xAPI statement processing failures',
      labelNames: ['error_type'],
      registers: [this.register],
    });

    this.xapiDuplicateRatePercent = new Gauge({
      name: 'xapi_duplicate_rate_percent',
      help: 'Current duplicate detection rate as percentage',
      registers: [this.register],
    });

    // Analytics metrics initialization
    this.analyticsRequestsTotal = new Counter({
      name: 'analytics_requests_total',
      help: 'Total number of analytics evaluation requests',
      labelNames: ['status'],
      registers: [this.register],
    });

    this.analyticsDegradationTotal = new Counter({
      name: 'analytics_degradation_total',
      help: 'Total number of analytics service degradations',
      registers: [this.register],
    });

    this.analyticsDegradationRatePercent = new Gauge({
      name: 'analytics_degradation_rate_percent',
      help: 'Current analytics degradation rate as percentage',
      registers: [this.register],
    });
  }

  onModuleInit() {
    // Enable default metrics (GC, memory, eventloop, etc)
    collectDefaultMetrics({ register: this.register });
  }

  // Increment request counter
  incrementRequestCounter(method: string, path: string, status: number): void {
    this.requestCounter.inc({ method, path, status });
  }

  // xAPI metric helpers
  recordXapiProcessed(
    status: 'success' | 'duplicate' | 'error' = 'success',
  ): void {
    this.xapiStatementsTotal.inc({ status });
  }

  recordXapiDuplicate(): void {
    this.xapiDuplicatesTotal.inc();
  }

  recordXapiCanonicalHashComputed(): void {
    this.xapiCanonicalHashesTotal.inc();
  }

  recordXapiProcessingFailure(errorType: string = 'unknown'): void {
    this.xapiProcessingFailuresTotal.inc({ error_type: errorType });
  }

  updateXapiDuplicateRate(total: number, duplicates: number): void {
    const rate = total > 0 ? (duplicates / total) * 100 : 0;
    this.xapiDuplicateRatePercent.set(rate);
  }

  // Analytics metric helpers
  recordAnalyticsEvaluation(status: 'success' | 'degraded'): void {
    this.analyticsRequestsTotal.inc({ status });
    if (status === 'degraded') {
      this.analyticsDegradationTotal.inc();
    }
  }

  updateAnalyticsDegradationRate(total: number, degradations: number): void {
    const rate = total > 0 ? (degradations / total) * 100 : 0;
    this.analyticsDegradationRatePercent.set(rate);
  }

  // Increment error counter
  incrementErrorCounter(
    method: string,
    path: string,
    status: number,
    error: string,
  ): void {
    this.errorCounter.inc({ method, path, status, error });
  }

  // Record response time
  recordResponseTime(method: string, path: string, time: number): void {
    this.responseTimeHistogram.set({ method, path }, time);
  }

  // Update active connections
  setActiveConnections(count: number): void {
    this.activeConnections.set(count);
  }

  // Get all metrics
  async getMetrics(): Promise<string> {
    return this.register.metrics();
  }

  /**
   * Returns a lightweight JSON summary of xAPI-related metrics
   * This mirrors the previous `PrometheusService.getMetricsSummary()`.
   */
  async getMetricsSummary(): Promise<{
    xapiStatementsTotal: number;
    xapiDuplicatesTotal: number;
    xapiCanonicalHashesTotal: number;
    xapiProcessingFailuresTotal: number;
    xapiDuplicateRatePercent: number;
    analyticsRequestsTotal: number;
    analyticsDegradationTotal: number;
    analyticsDegradationRatePercent: number;
  }> {
    const getCounter = async (name: string) => {
      const metric = this.register.getSingleMetric(name);
      if (!metric) {
        return 0;
      }
      const m = await metric.get();
      return m.values.reduce(
        (s, v) => s + (typeof v?.value === 'number' ? v.value : 0),
        0,
      );
    };

    const getGauge = async (name: string) => {
      const metric = this.register.getSingleMetric(name);
      if (!metric) {
        return 0;
      }
      const m = await metric.get();
      return typeof m.values[0]?.value === 'number' ? m.values[0].value : 0;
    };

    return {
      xapiStatementsTotal: await getCounter('xapi_statements_total'),
      xapiDuplicatesTotal: await getCounter('xapi_duplicates_total'),
      xapiCanonicalHashesTotal: await getCounter('xapi_canonical_hashes_total'),
      xapiProcessingFailuresTotal: await getCounter(
        'xapi_processing_failures_total',
      ),
      xapiDuplicateRatePercent: await getGauge('xapi_duplicate_rate_percent'),
      analyticsRequestsTotal: await getCounter('analytics_requests_total'),
      analyticsDegradationTotal: await getCounter(
        'analytics_degradation_total',
      ),
      analyticsDegradationRatePercent: await getGauge(
        'analytics_degradation_rate_percent',
      ),
    };
  }
}
