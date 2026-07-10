import { Injectable, Logger, Inject, OnModuleInit } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom, timeout } from 'rxjs';
import { retry } from 'rxjs/operators';
import { RedisService } from '#infrastructure/redis/redis.service';
import { UserFeaturesService } from '#modules/auth/services/user-features.service';
import { AnalyticsService } from '#infrastructure/grpc/analytics.client';
import { ANALYTICS_CACHE_CONFIG } from './analytics-cache.constants';

export interface ContentFeatures {
  contentId: string;
  contentType: string;
  difficulty: number;
  topics: string[];
  duration: number;
  engagement: number;
  completionRate: number;
  averageScore: number;
  prerequisites: string[];
  learningObjectives: string[];
  metadata: Record<string, any>;
}

interface ContentData {
  id: string;
  type: string;
  difficulty: number;
  topics: string[];
  duration: number;
  metadata: Record<string, unknown>;
}

export interface AIRecommendationInput {
  userId: string;
  userFeatures: number[];
  contentFeatures: ContentFeatures[];
  contextFeatures: number[];
  timestamp: Date;
}

export interface AIModelPrediction {
  contentId: string;
  score: number;
  confidence: number;
  reasoning: string[];
  category: string;
}

export interface FeatureImportance {
  featureName: string;
  importance: number;
  category: 'user' | 'content' | 'context';
}

@Injectable()
export class AIFeaturesService implements OnModuleInit {
  private readonly logger = new Logger(AIFeaturesService.name);
  private readonly cacheTtl = 1800; // 30 minutes
  private analyticsServiceGrpc!: AnalyticsService;
  private readonly grpcTimeoutMs = Number(
    process.env.RUST_GRPC_TIMEOUT_MS || 5000,
  );
  private readonly grpcRetries = Number(process.env.RUST_GRPC_RETRIES || 2);

  // Feature flag to control whether to use Rust service
  private readonly USE_RUST_FEATURES =
    process.env.USE_RUST_FEATURES !== 'false';

  constructor(
    private readonly redisService: RedisService,
    private readonly userFeaturesService: UserFeaturesService,
    @Inject('ANALYTICS_PACKAGE') private readonly client: ClientGrpc,
  ) {}

  onModuleInit() {
    this.analyticsServiceGrpc =
      this.client.getService<AnalyticsService>('AnalyticsService');
  }

  async extractContentFeatures(
    contentId: string,
    contentData: ContentData,
  ): Promise<ContentFeatures> {
    try {
      const cacheKey = ANALYTICS_CACHE_CONFIG.CONTENT.FEATURES(contentId);
      const _cached = await this.redisService.get<string>(cacheKey);

      if (typeof _cached === 'string') {
        return JSON.parse(_cached) as ContentFeatures;
      }

      const features = this.generateContentFeatures(contentId, contentData);

      await this.redisService.set(
        cacheKey,
        JSON.stringify(features),
        this.cacheTtl * 4,
      );

      return features;
    } catch (error) {
      this.logger.error(
        `Failed to extract content features for ${contentId}:`,
        error,
      );
      throw error;
    }
  }

  async generateAiInput(
    userId: string,
    candidateContentIds: string[],
    context?: Record<string, any>,
  ): Promise<AIRecommendationInput> {
    try {
      // Get user features from Rust service or fallback to local
      const userFeatures = await this.getUserFeaturesVector(userId);
      if (!userFeatures) {
        throw new Error(`Unable to generate user features for ${userId}`);
      }

      const contentFeatures = await Promise.all(
        candidateContentIds.map(async (contentId) => {
          const contentData = this.getContentData(contentId);
          return this.extractContentFeatures(contentId, contentData);
        }),
      );

      const contextFeatures = this.generateContextFeatures(userId, context);

      return {
        userId,
        userFeatures,
        contentFeatures,
        contextFeatures,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(
        `Failed to generate AI input for user ${userId}:`,
        error,
      );
      throw error;
    }
  }

  async createFeatureMatrix(
    userIds: string[],
    contentIds: string[],
    context?: Record<string, any>,
  ): Promise<{
    userFeatureMatrix: number[][];
    contentFeatureMatrix: number[][];
    contextFeatureMatrix: number[][];
    userIds: string[];
    contentIds: string[];
  }> {
    try {
      const userFeatureMatrix = await Promise.all(
        userIds.map(async (userId) => {
          const features = await this.getUserFeaturesVector(userId);
          return features ?? (new Array(17).fill(0) as number[]);
        }),
      );

      const contentFeatureMatrix = await Promise.all(
        contentIds.map(async (contentId) => {
          const contentData = this.getContentData(contentId);
          const features = await this.extractContentFeatures(
            contentId,
            contentData,
          );

          return this.contentFeaturesToVector(features);
        }),
      );

      const contextFeatureMatrix = userIds.map((userId) =>
        this.generateContextFeatures(userId, context),
      );

      return {
        userFeatureMatrix,
        contentFeatureMatrix,
        contextFeatureMatrix,
        userIds,
        contentIds,
      };
    } catch (error) {
      this.logger.error('Failed to create feature matrix:', error);
      throw error;
    }
  }

  async predictRecommendations(
    input: AIRecommendationInput,
  ): Promise<AIModelPrediction[]> {
    try {
      const fingerprint = input.contentFeatures
        .map((c) => c.contentId)
        .join(',');
      const cacheKey = ANALYTICS_CACHE_CONFIG.MODEL.PREDICTIONS(
        input.userId,
        fingerprint,
      );
      const _cachedModel = await this.redisService.get<string>(cacheKey);
      if (typeof _cachedModel === 'string') {
        return JSON.parse(_cachedModel) as AIModelPrediction[];
      }

      const predictions = this.simulateMlPredictions(input);

      await this.redisService.set(
        cacheKey,
        JSON.stringify(predictions),
        this.cacheTtl,
      );

      return predictions;
    } catch (error) {
      this.logger.error('Failed to generate predictions:', error);
      throw error;
    }
  }

  async analyzeFeatureImportance(
    userId: string,
    contentIds: string[],
  ): Promise<FeatureImportance[]> {
    try {
      const input = await this.generateAiInput(userId, contentIds);

      const userFeatures = input.userFeatures.map((value, index) => ({
        featureName: this.getUserFeatureName(index),
        importance: Math.abs(value),
        category: 'user' as const,
      }));

      const contentFeatures = input.contentFeatures.flatMap((content) =>
        this.contentFeaturesToVector(content).map((value, index) => ({
          featureName: this.getContentFeatureName(index),
          importance: Math.abs(value),
          category: 'content' as const,
        })),
      );

      const contextFeatures = input.contextFeatures.map((value, index) => ({
        featureName: this.getContextFeatureName(index),
        importance: Math.abs(value),
        category: 'context' as const,
      }));

      return [...userFeatures, ...contentFeatures, ...contextFeatures].sort(
        (a, b) => b.importance - a.importance,
      );
    } catch (error) {
      this.logger.error('Failed to analyze feature importance:', error);
      throw error;
    }
  }

  /**
   * Get user feature vector from Rust service or fallback to local computation
   * This method handles gRPC communication with the Rust analytics service
   */
  private async getUserFeaturesVector(
    userId: string,
  ): Promise<number[] | null> {
    try {
      if (!this.USE_RUST_FEATURES) {
        // Fallback to local computation if Rust service is disabled
        this.logger.debug(
          `Using local feature extraction for user ${userId} (USE_RUST_FEATURES=false)`,
        );
        return this.userFeaturesService.getUserFeatureVector(userId);
      }

      // Try to get from cache first
      const cacheKey = ANALYTICS_CACHE_CONFIG.LEARNING.FEATURE_VECTOR(userId);
      const cached = await this.redisService.get<string>(cacheKey);
      if (cached) {
        return JSON.parse(cached) as number[];
      }

      // Call Rust service via gRPC
      const response = await firstValueFrom(
        this.analyticsServiceGrpc
          .getUserFeatureVector({ user_id: userId })
          .pipe(timeout(this.grpcTimeoutMs), retry(this.grpcRetries)),
      );

      // Cache the result for 1 hour
      await this.redisService.set(
        cacheKey,
        JSON.stringify(response.features),
        3600,
      );

      this.logger.debug(
        `Fetched ${response.features.length} features for user ${userId} via gRPC`,
      );
      return response.features;
    } catch (error) {
      this.logger.warn(
        `Failed to get features from Rust service for user ${userId}, falling back to local: ${String(error)}`,
      );
      // Fallback to local computation on error
      try {
        return await this.userFeaturesService.getUserFeatureVector(userId);
      } catch (fallbackError) {
        this.logger.error(
          `Fallback also failed for user ${userId}:`,
          fallbackError,
        );
        return null;
      }
    }
  }

  private getContentData(contentId: string): ContentData {
    return {
      id: contentId,
      type: 'article',
      difficulty: 0.5,
      topics: ['math', 'science'],
      duration: 30,
      metadata: {
        device: 'desktop',
        topic: 'algebra',
      },
    };
  }

  private generateContentFeatures(
    contentId: string,
    contentData: ContentData,
  ): ContentFeatures {
    // contentData is already typed here
    return {
      contentId,
      contentType: contentData.type,
      difficulty: contentData.difficulty,
      topics: contentData.topics,
      duration: contentData.duration,
      engagement: 0.7,
      completionRate: 0.8,
      averageScore: 0.75,
      prerequisites: [],
      learningObjectives: [],
      metadata: contentData.metadata as Record<string, any>,
    };
  }

  private generateContextFeatures(
    _userId: string,
    context?: Record<string, any>,
  ): number[] {
    return [
      Number(context?.timeOfDay) || 0.5,
      Number(context?.dayOfWeek) || 0.5,
      Number(context?.deviceType) || 0.5,
      Number(context?.location) || 0.5,
    ];
  }

  private contentFeaturesToVector(features: ContentFeatures): number[] {
    return [
      features.difficulty,
      features.duration / 3600,
      features.engagement,
      features.completionRate,
      features.averageScore,
      features.topics.length / 10,
      features.prerequisites.length / 5,
      features.learningObjectives.length / 5,
    ];
  }

  private simulateMlPredictions(
    input: AIRecommendationInput,
  ): AIModelPrediction[] {
    return input.contentFeatures.map((content) => ({
      contentId: content.contentId,
      score: Math.random(),
      confidence: 0.8 + Math.random() * 0.2,
      reasoning: [
        'Based on user learning style',
        'Matches user difficulty preference',
        'Relevant to user interests',
      ],
      category: content.contentType,
    }));
  }

  private getUserFeatureName(index: number): string {
    const names = [
      'sessionDuration',
      'learningVelocity',
      'difficultyProgression',
      'engagementScore',
      'timeSlotPreference',
      'weakAreasCount',
      'strongAreasCount',
      'totalSessions',
      'averageScore',
      'completionRate',
      'retentionRate',
      'streakDays',
      'daysSinceLastActive',
      'socialEngagement',
      'helpSeeking',
      'topPreferenceScore',
      'preferenceDiversity',
    ];
    return names[index] || `userFeature${index}`;
  }

  private getContentFeatureName(index: number): string {
    const names = [
      'difficulty',
      'duration',
      'engagement',
      'completionRate',
      'averageScore',
      'topicCount',
      'prerequisiteCount',
      'learningObjectiveCount',
    ];
    return names[index] || `contentFeature${index}`;
  }

  private getContextFeatureName(index: number): string {
    const names = ['timeOfDay', 'dayOfWeek', 'deviceType', 'location'];
    return names[index] || `contextFeature${index}`;
  }
}
