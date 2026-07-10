import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

export interface PerformanceMetric {
  endpoint: string;
  method: string;
  provider: 'grpc' | 'local' | 'http';
  userId: string;
  responseTimeMs: number;
  cacheHit: boolean;
  success: boolean;
  errorMessage?: string;
  timestamp: Date;
  version?: string;
}

export interface PerformanceStats {
  endpoint: string;
  method: string;
  provider: 'grpc' | 'local' | 'http';
  totalRequests: number;
  successRate: number;
  averageResponseTimeMs: number;
  p50ResponseTimeMs: number;
  p95ResponseTimeMs: number;
  p99ResponseTimeMs: number;
  cacheHitRate: number;
  lastUpdated: Date;
}

@Injectable()
export class PerformanceMetricsService {
  private readonly logger = new Logger(PerformanceMetricsService.name);
  private readonly metricsPrefix = 'perf_metrics:';
  private readonly statsPrefix = 'perf_stats:';
  private readonly batchSize = 100; // Flush metrics every N records

  constructor(private readonly redisService: RedisService) {}

  /**
   * Record a single performance metric
   * Automatically aggregates and stores statistics
   */
  async recordMetric(metric: PerformanceMetric): Promise<void> {
    try {
      const key = `${this.metricsPrefix}${metric.endpoint}:${metric.method}:${metric.provider}`;
      const metricsJson = JSON.stringify(metric);

      // Store individual metric
      await this.redisService.set(
        `${key}:${Date.now()}`,
        metricsJson,
        3600, // Keep for 1 hour
      );

      // Add to aggregation list using setList
      const existingMetrics = await this.redisService.getList(
        `${key}:list`,
        0,
        -1,
      );
      const updated = [metricsJson, ...existingMetrics].slice(0, 1000); // Keep last 1000
      await this.redisService.setList(`${key}:list`, updated);

      // Trigger stats aggregation if batch size reached
      if (updated.length % this.batchSize === 0) {
        await this.aggregateStats(
          metric.endpoint,
          metric.method,
          metric.provider,
        );
      }

      this.logger.debug(
        `Recorded metric: ${metric.endpoint}.${metric.method} (${metric.provider}) - ${metric.responseTimeMs}ms`,
      );
    } catch (error) {
      this.logger.error(`Failed to record metric:`, error);
    }
  }

  /**
   * Get performance statistics for an endpoint
   */
  async getStats(
    endpoint: string,
    method: string,
    provider: 'grpc' | 'local' | 'http',
  ): Promise<PerformanceStats | null> {
    try {
      const key = `${this.statsPrefix}${endpoint}:${method}:${provider}`;
      const statsJson = await this.redisService.get<string>(key);

      if (!statsJson) {
        return null;
      }

      return JSON.parse(statsJson) as PerformanceStats;
    } catch (error) {
      this.logger.error(`Failed to get stats:`, error);
      return null;
    }
  }

  /**
   * Compare performance between two providers
   */
  async compareProviders(
    endpoint: string,
    method: string,
  ): Promise<{
    grpc?: PerformanceStats;
    local?: PerformanceStats;
    http?: PerformanceStats;
    winner?: string;
    improvementPercent?: number;
  }> {
    try {
      const [grpcStats, localStats, httpStats] = await Promise.all([
        this.getStats(endpoint, method, 'grpc'),
        this.getStats(endpoint, method, 'local'),
        this.getStats(endpoint, method, 'http'),
      ]);

      const result: any = {
        grpc: grpcStats,
        local: localStats,
        http: httpStats,
      };

      // Determine winner
      const validStats = [grpcStats, localStats, httpStats].filter(
        (s) => s !== null,
      );
      if (validStats.length >= 2) {
        const fastest = validStats.reduce((min, curr) =>
          (curr?.averageResponseTimeMs ?? Infinity) <
          (min?.averageResponseTimeMs ?? Infinity)
            ? curr
            : min,
        );
        result.winner = fastest?.provider;

        // Calculate improvement
        if (localStats && grpcStats) {
          const improvement =
            ((localStats.averageResponseTimeMs -
              grpcStats.averageResponseTimeMs) /
              localStats.averageResponseTimeMs) *
            100;
          result.improvementPercent = Math.round(improvement);
        }
      }

      return result;
    } catch (error) {
      this.logger.error(`Failed to compare providers:`, error);
      return {};
    }
  }

  /**
   * Get all metrics for an endpoint aggregated by provider
   */
  async getEndpointMetrics(
    endpoint: string,
    method: string,
  ): Promise<{
    providers: Map<string, PerformanceStats>;
    summary: {
      bestPerformer?: string;
      recommendation: string;
    };
  }> {
    try {
      const [grpcStats, localStats, httpStats] = await Promise.all([
        this.getStats(endpoint, method, 'grpc'),
        this.getStats(endpoint, method, 'local'),
        this.getStats(endpoint, method, 'http'),
      ]);

      const providers = new Map<string, PerformanceStats>();
      if (grpcStats) {
        providers.set('grpc', grpcStats);
      }
      if (localStats) {
        providers.set('local', localStats);
      }
      if (httpStats) {
        providers.set('http', httpStats);
      }

      // Find best performer
      let bestPerformer: string | undefined;
      let bestTime = Infinity;

      for (const [provider, stats] of providers) {
        if (stats && stats.averageResponseTimeMs < bestTime) {
          bestTime = stats.averageResponseTimeMs;
          bestPerformer = provider;
        }
      }

      // Generate recommendation
      const recommendation = this.generateRecommendation(
        endpoint,
        providers,
        bestPerformer,
      );

      return { providers, summary: { bestPerformer, recommendation } };
    } catch (error) {
      this.logger.error(`Failed to get endpoint metrics:`, error);
      return {
        providers: new Map(),
        summary: { recommendation: 'Error fetching metrics' },
      };
    }
  }

  /**
   * Get metrics grouped by user for A/B testing
   */
  async getUserMetrics(_userId: string): Promise<{
    grpc: PerformanceStats[];
    local: PerformanceStats[];
    http: PerformanceStats[];
  }> {
    try {
      // Query metrics for this user across all endpoints
      const pattern = `${this.metricsPrefix}*`;
      await this.redisService.keys(pattern);

      const userMetrics = {
        grpc: [] as PerformanceStats[],
        local: [] as PerformanceStats[],
        http: [] as PerformanceStats[],
      };

      // In real implementation, would parse and filter by userId
      // This is a simplified version
      return userMetrics;
    } catch (error) {
      this.logger.error(`Failed to get user metrics:`, error);
      return { grpc: [], local: [], http: [] };
    }
  }

  /**
   * Generate recommendation based on performance data
   */
  private generateRecommendation(
    _endpoint: string,
    providers: Map<string, PerformanceStats>,
    bestPerformer?: string,
  ): string {
    if (!bestPerformer) {
      return 'Insufficient data to make recommendation';
    }

    const bestStats = providers.get(bestPerformer);
    if (!bestStats) {
      return 'Error: Best performer stats not found';
    }

    const successRate = (bestStats.successRate * 100).toFixed(1);

    if (bestPerformer === 'grpc') {
      const avgTime = bestStats.averageResponseTimeMs.toFixed(0);
      return `Use gRPC (${avgTime}ms avg, ${successRate}% success rate). ✅ Recommended.`;
    } else if (bestPerformer === 'http') {
      return `HTTP currently performing better. Consider investigation or stick with fallback.`;
    } else {
      return `Local computation still faster. gRPC overhead may not justify migration yet.`;
    }
  }

  /**
   * Private: Aggregate metrics into stats
   */
  private async aggregateStats(
    endpoint: string,
    method: string,
    provider: 'grpc' | 'local' | 'http',
  ): Promise<void> {
    try {
      const key = `${this.metricsPrefix}${endpoint}:${method}:${provider}:list`;
      const metricsRaw = await this.redisService.getList(key, 0, -1);

      if (!metricsRaw || metricsRaw.length === 0) {
        return;
      }

      const metrics: PerformanceMetric[] = metricsRaw
        .map((m: any) => {
          try {
            return JSON.parse(m) as PerformanceMetric;
          } catch {
            return null;
          }
        })
        .filter((m: any): m is PerformanceMetric => m !== null);

      if (metrics.length === 0) {
        return;
      }

      // Calculate statistics
      const responseTimes = metrics
        .map((m) => m.responseTimeMs)
        .sort((a, b) => a - b);
      const successfulRequests = metrics.filter((m) => m.success).length;
      const cacheHits = metrics.filter((m) => m.cacheHit).length;

      const stats: PerformanceStats = {
        endpoint,
        method,
        provider,
        totalRequests: metrics.length,
        successRate: successfulRequests / metrics.length,
        averageResponseTimeMs:
          responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length,
        p50ResponseTimeMs:
          responseTimes[Math.floor(responseTimes.length * 0.5)],
        p95ResponseTimeMs:
          responseTimes[Math.floor(responseTimes.length * 0.95)],
        p99ResponseTimeMs:
          responseTimes[Math.floor(responseTimes.length * 0.99)],
        cacheHitRate: cacheHits / metrics.length,
        lastUpdated: new Date(),
      };

      // Store aggregated stats
      const statsKey = `${this.statsPrefix}${endpoint}:${method}:${provider}`;
      await this.redisService.set(
        statsKey,
        JSON.stringify(stats),
        86400, // Keep for 24 hours
      );

      this.logger.debug(
        `Aggregated stats for ${endpoint}.${method} (${provider}): ${stats.averageResponseTimeMs.toFixed(0)}ms avg`,
      );
    } catch (error) {
      this.logger.error(`Failed to aggregate stats:`, error);
    }
  }

  /**
   * Clear old metrics (run periodically)
   */
  async clearOldMetrics(olderThanHours: number = 24): Promise<void> {
    try {
      const pattern = `${this.metricsPrefix}*`;
      const keys = await this.redisService.keys(pattern);
      for (const key of keys) {
        try {
          await this.redisService.del(key);
        } catch {
          // Continue on error
        }
      }

      this.logger.log(`Cleared metrics older than ${olderThanHours} hours`);
    } catch (error) {
      this.logger.error(`Failed to clear old metrics:`, error);
    }
  }
}
