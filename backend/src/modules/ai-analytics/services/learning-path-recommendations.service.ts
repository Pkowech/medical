// src/modules/ai-analytics/services/learning-path-recommendations.service.ts
// Refactored to gRPC-only pattern following study-analytics.service.ts best practices.
// All ML-based recommendations delegated to Rust; returns empty arrays on gRPC failure.

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '#infrastructure/prisma/prisma.service';
import { AiAnalyticsService } from '#modules/ai-analytics/services/ai-analytics.service';
import { RedisService } from '#infrastructure/redis/redis.service';
import { getErrorMessage } from '#common/utils/error.utils';
import { ANALYTICS_CACHE_CONFIG } from './analytics-cache.constants';
import { LearningPath } from '@prisma/client';

export interface RecommendationScore {
  pathId: string;
  score: number;
  reasons: string[];
  confidence: number;
  estimatedCompletionTime: number;
}

@Injectable()
export class LearningPathRecommendationsService {
  private readonly logger = new Logger(LearningPathRecommendationsService.name);
  private readonly CACHE_TTL = 900; // 15 minutes

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiAnalyticsService: AiAnalyticsService,
    private readonly redisService: RedisService,
  ) {}

  /**
   * Get personalized learning path recommendations for a user.
   * Delegates to Rust gRPC service; returns empty array on failure.
   */
  async getRecommendations(
    userId: string,
    limit: number = 10,
  ): Promise<RecommendationScore[]> {
    const cacheKey = ANALYTICS_CACHE_CONFIG.RECOMMENDATIONS.PATH(userId, limit);

    try {
      const cached = await this.redisService.get(cacheKey);
      if (cached) {
        this.logger.debug(`Cache HIT for path recommendations ${userId}`);
        return JSON.parse(cached as string);
      }

      this.logger.debug(`Cache MISS for path recommendations ${userId}`);

      // Call Rust service via AI Analytics (gRPC)
      const rustRecommendations =
        await this.aiAnalyticsService.getRecommendationsAI(userId);

      // Enrich with learning path metadata from database
      const recommendations = await this.enrichRustRecommendations(
        rustRecommendations,
        limit,
      );

      // Cache the result
      await this.redisService.set(
        cacheKey,
        JSON.stringify(recommendations),
        this.CACHE_TTL,
      );

      return recommendations;
    } catch (error) {
      this.logger.error(
        `Error generating recommendations for user ${userId}: ${getErrorMessage(error)}`,
      );
      return [];
    }
  }

  /**
   * Enrich Rust recommendations with database metadata.
   * Includes specialization-based matching logic.
   */
  private async enrichRustRecommendations(
    rustRecs: any[],
    limit: number,
    userId?: string,
  ): Promise<RecommendationScore[]> {
    const pathIds = rustRecs.map((r) => r.materialId || r.id).filter(Boolean);

    // Fetch user specialization if userId is provided
    let userSpecialization: string | null = null;
    if (userId) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { specialization: true },
      });
      userSpecialization = user?.specialization || null;
    }

    const paths = await this.prisma.learningPath.findMany({
      where: {
        OR: [
          { id: { in: pathIds } },
          userSpecialization ? { specialization: userSpecialization } : {},
        ].filter((cond) => Object.keys(cond).length > 0),
        status: 'published',
      },
      include: {
        milestones: true,
      },
      take: limit,
    });

    return paths.map((path) => {
      const rustRec =
        rustRecs.find((r) => (r.materialId || r.id) === path.id) || {};

      const isSpecializationMatch =
        userSpecialization && path.specialization === userSpecialization;

      return {
        pathId: path.id,
        score: isSpecializationMatch
          ? Math.max(rustRec.score || 0.5, 0.9)
          : rustRec.score || 0.5,
        reasons: [
          isSpecializationMatch
            ? `Matches your specialization: ${userSpecialization}`
            : rustRec.reason || 'AI recommended based on your profile',
        ],
        confidence: isSpecializationMatch ? 0.95 : rustRec.confidence || 0.7,
        estimatedCompletionTime: path.estimatedDurationWeeks || 4,
      };
    });
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
   * Delegates to Rust gRPC service; returns empty array on failure.
   */
  async getCollaborativeRecommendations(
    userId: string,
    limit: number = 5,
  ): Promise<RecommendationScore[]> {
    const cacheKey = ANALYTICS_CACHE_CONFIG.RECOMMENDATIONS.COLLABORATIVE(
      userId,
      limit,
    );

    try {
      const cached = await this.redisService.get(cacheKey);
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
        await this.aiAnalyticsService.getCollaborativeRecommendations(
          userId,
          limit,
        );

      // Enrich with learning path data
      const recommendations = await this.enrichCollaborativeRecommendations(
        rustRecs,
        limit,
      );

      // Cache the result
      await this.redisService.set(
        cacheKey,
        JSON.stringify(recommendations),
        this.CACHE_TTL,
      );

      return recommendations;
    } catch (error) {
      this.logger.error(
        `Error in collaborative recommendations: ${getErrorMessage(error)}`,
      );
      return [];
    }
  }

  /**
   * Enrich collaborative recommendations with path details.
   */
  private async enrichCollaborativeRecommendations(
    rustRecs: any[],
    limit: number,
  ): Promise<RecommendationScore[]> {
    const pathIds = rustRecs.map((r) => r.item_id).filter(Boolean);

    if (pathIds.length === 0) {
      return [];
    }

    const paths = await this.prisma.learningPath.findMany({
      where: {
        id: { in: pathIds },
        status: 'published',
      },
      include: {
        milestones: true,
      },
      take: limit,
    });

    return paths.map((path) => {
      const rustRec = rustRecs.find((r) => r.item_id === path.id) || {};
      return {
        pathId: path.id,
        score: rustRec.score || 0.7,
        reasons: ['Recommended based on similar learners'],
        confidence: 0.8,
        estimatedCompletionTime: path.estimatedDurationWeeks || 4,
      };
    });
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
      return [];
    }
  }
}
