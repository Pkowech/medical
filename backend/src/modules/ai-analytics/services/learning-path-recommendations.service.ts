// src/modules/ai-analytics/services/learning-path-recommendations.service.ts
// Refactored to gRPC-only pattern following study-analytics.service.ts best practices.
// All ML-based recommendations are delegated to Rust.

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '#infrastructure/prisma/prisma.service';
import { LearningAnalyticsService } from '#modules/ai-analytics/services/learning-analytics.service';
import { AiAnalyticsService } from '#modules/ai-analytics/services/ai-analytics.service';
import { RedisService } from '#infrastructure/redis/redis.service';
import { getErrorMessage } from '#common/utils/error.utils';
import { ANALYTICS_CACHE_CONFIG } from './analytics-cache.constants';
import { LearningPath } from '@prisma/client';
import { normalizeCareerStage } from '#common/constants/career-stages';
import { evaluateLearningPathEligibility } from '#common/utils/learning-path-eligibility';
import { getRecommendationWindow } from '#common/utils/recommendation-limits';

export interface RecommendationScore {
  pathId: string;
  score: number;
  reasons: string[];
  confidence?: number;
  estimatedCompletionTime?: number;
}

@Injectable()
export class LearningPathRecommendationsService {
  private readonly logger = new Logger(LearningPathRecommendationsService.name);
  private readonly CACHE_TTL = 900; // 15 minutes

  constructor(
    private readonly prisma: PrismaService,
    private readonly learningAnalyticsService: LearningAnalyticsService,
    private readonly aiAnalyticsService: AiAnalyticsService,
    private readonly redisService: RedisService,
  ) {}

  /**
   * Get personalized learning path recommendations for a user.
   * Delegates ranking to Rust and enriches the results with path metadata.
   */
  async getRecommendations(
    userId: string,
    limit: number = 10,
  ): Promise<RecommendationScore[]> {
    const window = getRecommendationWindow(limit, 10);
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { careerStage: true },
      });
      const careerStage = normalizeCareerStage(user?.careerStage);
      if (!careerStage) {
        return [];
      }

      const rustRecommendations =
        await this.learningAnalyticsService.getPathRecommendations(
          userId,
          window.candidateLimit,
        );

      const recommendations = await this.enrichRustRecommendations(
        rustRecommendations,
        window.resultLimit,
        careerStage,
      );
      return recommendations;
    } catch (error) {
      this.logger.error(
        `Error generating recommendations for user ${userId}: ${getErrorMessage(error)}`,
      );
      throw error;
    }
  }

  /**
   * Enrich Rust-ranked paths with metadata, preserving the engine's order.
   */
  private async enrichRustRecommendations(
    rustRecs: Array<{
      pathId: string;
      score: number;
      reasons: string[];
      confidence: number;
    }>,
    limit: number,
    careerStage: string,
  ): Promise<RecommendationScore[]> {
    const rankedRecommendations = rustRecs;
    const pathIds = rankedRecommendations.map(
      (recommendation) => recommendation.pathId,
    );
    if (!pathIds.length) return [];

    const paths = await this.prisma.learningPath.findMany({
      where: {
        id: { in: pathIds },
        status: 'published',
        targetCareerStages: { has: careerStage },
      },
    });

    const pathsById = new Map(paths.map((path) => [path.id, path]));
    return rankedRecommendations.flatMap((recommendation) => {
      const path = pathsById.get(recommendation.pathId);
      if (
        !path ||
        !evaluateLearningPathEligibility(
          path.targetCareerStages,
          careerStage,
        ).eligible
      ) {
        return [];
      }

      return [
        {
          pathId: path.id,
          score: recommendation.score,
          reasons: recommendation.reasons,
          confidence: recommendation.confidence,
          estimatedCompletionTime: path.estimatedDurationWeeks ?? undefined,
        },
      ];
    }).slice(0, limit);
  }

  /**
   * Thin adapter used by analytics to request recommendations given metrics/patterns.
   */
  async recommendForUser(
    userId: string,
    _context: { metrics?: any; patterns?: any },
    limit: number = 10,
  ): Promise<RecommendationScore[]> {
    return this.getRecommendations(userId, limit);
  }

  /**
   * Get collaborative filtering recommendations.
   * Delegates ranking to Rust and returns only published paths with metadata.
   */
  async getCollaborativeRecommendations(
    userId: string,
    limit: number = 5,
  ): Promise<RecommendationScore[]> {
    const window = getRecommendationWindow(limit, 5);
    const cacheKey = `${ANALYTICS_CACHE_CONFIG.RECOMMENDATIONS.COLLABORATIVE(
      userId,
      window.resultLimit,
    )}:enriched:v3`;

    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { careerStage: true },
      });
      const careerStage = normalizeCareerStage(user?.careerStage);
      if (!careerStage) {
        return [];
      }
      const stageCacheKey = `${cacheKey}:${careerStage}`;

      const cached = await this.redisService.get(stageCacheKey);
      if (cached) {
        this.logger.debug(
          `Cache HIT for collaborative recommendations ${userId}`,
        );
        return JSON.parse(cached as string);
      }

      this.logger.debug(
        `Cache MISS for collaborative recommendations ${userId}`,
      );

      // Call Rust service (gRPC)
      const rustRecs =
        await this.learningAnalyticsService.getCollaborativeRecommendations(
          userId,
          window.candidateLimit,
        );

      // Enrich with learning path data
      const recommendations = await this.enrichCollaborativeRecommendations(
        rustRecs,
        window.resultLimit,
        careerStage,
      );

      // Cache the result
      await this.redisService.set(
        stageCacheKey,
        JSON.stringify(recommendations),
        this.CACHE_TTL,
      );

      return recommendations;
    } catch (error) {
      this.logger.error(
        `Error in collaborative recommendations: ${getErrorMessage(error)}`,
      );
      throw error;
    }
  }

  /**
   * Enrich collaborative recommendations with path details.
   */
  private async enrichCollaborativeRecommendations(
    rustRecs: Array<{ item_id: string; score: number; reason: string }>,
    limit: number,
    careerStage: string,
  ): Promise<RecommendationScore[]> {
    const pathIds = rustRecs.map((recommendation) => recommendation.item_id);

    if (pathIds.length === 0) {
      return [];
    }

    const paths = await this.prisma.learningPath.findMany({
      where: {
        id: { in: pathIds },
        status: 'published',
        targetCareerStages: { has: careerStage },
      },
      include: {
        milestones: true,
      },
      take: pathIds.length,
    });

    const pathsById = new Map(paths.map((path) => [path.id, path]));
    return rustRecs.flatMap((recommendation) => {
      const path = pathsById.get(recommendation.item_id);
      if (
        !path ||
        !evaluateLearningPathEligibility(
          path.targetCareerStages,
          careerStage,
        ).eligible
      ) {
        return [];
      }

      return [
        {
          pathId: path.id,
          score: recommendation.score,
          reasons: [recommendation.reason],
          estimatedCompletionTime:
            path.estimatedDurationWeeks ?? undefined,
        },
      ];
    }).slice(0, limit);
  }

  /**
   * Get trending paths.
   * Delegates to Rust gRPC service; returns empty array on failure.
   */
  async getTrendingPaths(limit: number = 5): Promise<LearningPath[]> {
    try {
      // Call Rust service via AI Analytics (gRPC)
      const rustTrendingPaths =
        await this.aiAnalyticsService.getTrendingPaths(limit);

      // Enrich with learning path metadata
      const pathIds = rustTrendingPaths.map((p) => p.path_id);

      if (pathIds.length === 0) {
        return [];
      }

      const paths = await this.prisma.learningPath.findMany({
        where: {
          id: { in: pathIds },
          status: 'published',
        },
        take: limit,
      });

      return paths;
    } catch (error) {
      this.logger.error(
        `Error getting trending paths: ${getErrorMessage(error)}`,
      );
      throw error;
    }
  }
}
