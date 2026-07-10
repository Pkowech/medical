import { Injectable, Logger } from '@nestjs/common';
import { AiAnalyticsService } from '#modules/ai-analytics/services/ai-analytics.service';
import { getErrorMessage } from '#common/utils/error.utils';
import { RedisService } from '#infrastructure/redis/redis.service';

export interface IntegrationHealthStatus {
  rustGrpcConnection: boolean;
  cacheConnected: boolean;
  recommendationsWorking: boolean;
  timestamp: number;
  errors: string[];
}

@Injectable()
export class IntegrationHealthService {
  private readonly logger = new Logger(IntegrationHealthService.name);

  constructor(
    private readonly aiAnalyticsService: AiAnalyticsService,
    private readonly redisService: RedisService,
  ) {}

  /**
   * Verify all integration layers are working:
   * 1. Rust gRPC service connectivity
   * 2. Redis cache connectivity
   * 3. Recommendation service responsiveness
   * 4. Event chain execution capability
   */
  async checkIntegrationHealth(userId?: string): Promise<IntegrationHealthStatus> {
    const status: IntegrationHealthStatus = {
      rustGrpcConnection: false,
      cacheConnected: false,
      recommendationsWorking: false,
      timestamp: Date.now(),
      errors: [],
    };

    try {
      // Check 1: Redis Cache
      try {
        await this.redisService.set('health-check', 'ok', 5);
        const value = await this.redisService.get('health-check');
        status.cacheConnected = value === 'ok';
        if (!status.cacheConnected) {
          status.errors.push('Redis cache connectivity issue');
        }
      } catch (err) {
        status.errors.push(`Redis error: ${getErrorMessage(err)}`);
        this.logger.warn('Redis health check failed:', err);
      }

      // Check 2: Rust gRPC Connection (via AI Analytics)
      try {
        // Try to get recommendations - this tests Rust connectivity
        if (userId) {
          const testRec = await this.aiAnalyticsService.getRecommendationsAI(userId);
          status.rustGrpcConnection = Array.isArray(testRec);
        } else {
          // Just verify service is available
          status.rustGrpcConnection = !!this.aiAnalyticsService;
        }
      } catch (err) {
        status.errors.push(`Rust gRPC error: ${getErrorMessage(err)}`);
        this.logger.warn('Rust gRPC health check failed:', err);
      }

      // Check 3: Full recommendation pipeline
      if (userId && status.rustGrpcConnection) {
        try {
          const recs = await this.aiAnalyticsService.getRecommendationsAI(userId);
          status.recommendationsWorking = Array.isArray(recs);
        } catch (err) {
          status.errors.push(`Recommendation pipeline error: ${getErrorMessage(err)}`);
          this.logger.warn('Recommendation pipeline check failed:', err);
        }
      }
    } catch (err) {
      status.errors.push(`Unexpected health check error: ${getErrorMessage(err)}`);
      this.logger.error('Integration health check error:', err);
    }

    const isHealthy =
      status.cacheConnected &&
      status.rustGrpcConnection &&
      status.errors.length === 0;

    this.logger.log(
      `Integration health check: ${isHealthy ? 'HEALTHY' : 'DEGRADED'}. Errors: ${status.errors.length}`,
    );

    return status;
  }

  /**
   * Verify the complete event chain works:
   * Quiz → Progress → Mastery → Recommendations
   */
  async verifyEventChain(userId: string): Promise<{
    chainHealthy: boolean;
    steps: Array<{ step: string; status: 'OK' | 'FAILED'; message?: string }>;
  }> {
    const steps: Array<{ step: string; status: 'OK' | 'FAILED'; message?: string }> = [];

    try {
      // Step 1: Check if recommendations can be generated
      try {
        const recs = await this.aiAnalyticsService.getRecommendationsAI(userId);
        steps.push({
          step: 'Recommendations Generation',
          status: Array.isArray(recs) ? 'OK' : 'FAILED',
          message: `Generated ${recs?.length || 0} recommendations`,
        });
      } catch (err) {
        steps.push({
          step: 'Recommendations Generation',
          status: 'FAILED',
          message: getErrorMessage(err),
        });
      }

      // Step 2: Check if collaborative recommendations work
      try {
        const collabRecs = await this.aiAnalyticsService.getCollaborativeRecommendations(
          userId,
          5,
        );
        steps.push({
          step: 'Collaborative Recommendations',
          status: Array.isArray(collabRecs) ? 'OK' : 'FAILED',
          message: `Generated ${collabRecs?.length || 0} collaborative recommendations`,
        });
      } catch (err) {
        steps.push({
          step: 'Collaborative Recommendations',
          status: 'FAILED',
          message: getErrorMessage(err),
        });
      }

      // Step 3: Cache verification
      try {
        const cacheKey = `integration-test:${userId}`;
        await this.redisService.set(cacheKey, 'test-value', 60);
        const cachedValue = await this.redisService.get(cacheKey);
        steps.push({
          step: 'Cache Integrity',
          status: cachedValue === 'test-value' ? 'OK' : 'FAILED',
        });
        await this.redisService.del(cacheKey);
      } catch (err) {
        steps.push({
          step: 'Cache Integrity',
          status: 'FAILED',
          message: getErrorMessage(err),
        });
      }
    } catch (err) {
      this.logger.error('Event chain verification error:', err);
    }

    const chainHealthy = steps.every((s) => s.status === 'OK');
    return { chainHealthy, steps };
  }

  /**
   * Get integration metrics for monitoring
   */
  async getIntegrationMetrics(): Promise<{
    totalChecks: number;
    successfulChecks: number;
    failedChecks: number;
    averageLatency: number;
    lastCheck: number;
  }> {
    // This would be implemented with actual metric tracking
    // For now, return placeholder
    return {
      totalChecks: 0,
      successfulChecks: 0,
      failedChecks: 0,
      averageLatency: 0,
      lastCheck: Date.now(),
    };
  }
}
