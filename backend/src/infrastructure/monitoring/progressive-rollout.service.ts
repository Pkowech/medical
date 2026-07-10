import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { PrismaService } from '../prisma/prisma.service';

export type RolloutStrategy =
  | 'percentage'
  | 'user_id_list'
  | 'user_segment'
  | 'gradual';

export interface RolloutConfig {
  featureName: string;
  strategy: RolloutStrategy;
  enabled: boolean;
  startDate?: Date;
  endDate?: Date;
  // For percentage strategy
  percentageRollout?: number; // 0-100
  // For user_id_list strategy
  includedUserIds?: string[];
  excludedUserIds?: string[];
  // For user_segment strategy
  segment?: string; // e.g., 'beta_testers', 'premium_users'
  // For gradual strategy
  dailyIncrementPercent?: number; // Increase rollout by X% per day
}

export interface FeatureVariant {
  userId: string;
  featureName: string;
  variant: 'control' | 'treatment';
  rolloutVersion: number;
  assignedAt: Date;
}

@Injectable()
export class ProgressiveRolloutService {
  private readonly logger = new Logger(ProgressiveRolloutService.name);
  private readonly configPrefix = 'rollout:config:';
  private readonly variantPrefix = 'rollout:variant:';
  private readonly historyPrefix = 'rollout:history:';
  private readonly cachePrefix = 'rollout:cache:';

  constructor(
    private readonly redisService: RedisService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Create or update a rollout configuration
   */
  async setRolloutConfig(config: RolloutConfig): Promise<void> {
    try {
      const key = `${this.configPrefix}${config.featureName}`;

      // Validate configuration
      this.validateRolloutConfig(config);

      // Store configuration
      await this.redisService.set(
        key,
        JSON.stringify(config),
        86400 * 30, // Keep for 30 days
      );

      // Clear cache when config changes
      await this.redisService.del(`${this.cachePrefix}${config.featureName}:*`);

      this.logger.log(
        `Rollout config set for ${config.featureName}: ${config.strategy} (${config.percentageRollout ?? 0}%)`,
      );
    } catch (error) {
      this.logger.error(`Failed to set rollout config:`, error);
      throw error;
    }
  }

  /**
   * Get rollout configuration
   */
  async getRolloutConfig(featureName: string): Promise<RolloutConfig | null> {
    try {
      const key = `${this.configPrefix}${featureName}`;
      const configJson = await this.redisService.get<string>(key);

      if (!configJson) {
        return null;
      }

      return JSON.parse(configJson) as RolloutConfig;
    } catch (error) {
      this.logger.error(`Failed to get rollout config:`, error);
      return null;
    }
  }

  /**
   * Check if a user should get the feature (returns true/false)
   * Caches the decision for performance
   */
  async isUserEligible(userId: string, featureName: string): Promise<boolean> {
    try {
      // Check cache first
      const cacheKey = `${this.cachePrefix}${featureName}:${userId}`;
      const cached = await this.redisService.get<string>(cacheKey);
      if (cached !== null) {
        return cached === 'true';
      }

      const config = await this.getRolloutConfig(featureName);
      if (!config || !config.enabled) {
        await this.redisService.set(cacheKey, 'false', 3600);
        return false;
      }

      // Check date range
      if (config.startDate && new Date() < config.startDate) {
        await this.redisService.set(cacheKey, 'false', 3600);
        return false;
      }
      if (config.endDate && new Date() > config.endDate) {
        await this.redisService.set(cacheKey, 'false', 3600);
        return false;
      }

      let eligible = false;

      switch (config.strategy) {
        case 'percentage':
          eligible = this.isUserInPercentage(
            userId,
            featureName,
            config.percentageRollout ?? 0,
          );
          break;

        case 'user_id_list':
          eligible = this.isUserInList(userId, config);
          break;

        case 'user_segment':
          eligible = await this.isUserInSegment(userId, config.segment || '');
          break;

        case 'gradual':
          eligible = this.isUserInGradualRollout(userId, featureName, config);
          break;

        default:
          eligible = false;
      }

      // Cache the decision for 1 hour
      await this.redisService.set(cacheKey, eligible ? 'true' : 'false', 3600);
      return eligible;
    } catch (error) {
      this.logger.error(`Failed to check user eligibility:`, error);
      return false; // Fail closed for safety
    }
  }

  /**
   * Get assigned variant for A/B testing
   */
  async getVariant(
    userId: string,
    featureName: string,
  ): Promise<FeatureVariant> {
    try {
      const variantKey = `${this.variantPrefix}${featureName}:${userId}`;
      const cached = await this.redisService.get<string>(variantKey);

      if (cached) {
        return JSON.parse(cached) as FeatureVariant;
      }

      // Determine variant based on user hash
      const variant = this.hashToVariant(userId, featureName);
      const assigned: FeatureVariant = {
        userId,
        featureName,
        variant,
        rolloutVersion: 1,
        assignedAt: new Date(),
      };

      // Cache variant assignment for 30 days
      await this.redisService.set(
        variantKey,
        JSON.stringify(assigned),
        86400 * 30,
      );

      // Record in history
      const existingHistory = await this.redisService.getList(
        `${this.historyPrefix}${featureName}`,
        0,
        -1,
      );
      const updatedHistory = [
        JSON.stringify(assigned),
        ...existingHistory,
      ].slice(0, 10000);
      await this.redisService.setList(
        `${this.historyPrefix}${featureName}`,
        updatedHistory,
      );

      return assigned;
    } catch (error) {
      this.logger.error(`Failed to get variant:`, error);
      // Fallback to control
      return {
        userId,
        featureName,
        variant: 'control',
        rolloutVersion: 1,
        assignedAt: new Date(),
      };
    }
  }

  /**
   * Get rollout statistics
   */
  async getRolloutStats(featureName: string): Promise<{
    featureName: string;
    totalUsers: number;
    treatmentUsers: number;
    treatmentPercentage: number;
    config: RolloutConfig | null;
    lastUpdated: Date;
  } | null> {
    try {
      const config = await this.getRolloutConfig(featureName);
      if (!config) {
        return null;
      }

      // Get variant distribution
      const pattern = `${this.variantPrefix}${featureName}:*`;
      const keys = await this.redisService.keys(pattern);

      let treatmentCount = 0;
      for (const key of keys) {
        const variantJson = await this.redisService.get<string>(key as any);
        if (variantJson) {
          const variant = JSON.parse(variantJson) as FeatureVariant;
          if (variant.variant === 'treatment') {
            treatmentCount++;
          }
        }
      }

      const totalUsers = keys.length;
      const treatmentPercentage =
        totalUsers > 0 ? (treatmentCount / totalUsers) * 100 : 0;

      return {
        featureName,
        totalUsers,
        treatmentUsers: treatmentCount,
        treatmentPercentage,
        config,
        lastUpdated: new Date(),
      };
    } catch (error) {
      this.logger.error(`Failed to get rollout stats:`, error);
      return null;
    }
  }

  /**
   * Gradual increase rollout percentage
   */
  async graduateRollout(featureName: string): Promise<void> {
    try {
      const config = await this.getRolloutConfig(featureName);
      if (!config || config.strategy !== 'gradual') {
        throw new Error('Feature not found or not using gradual strategy');
      }

      const increment = config.dailyIncrementPercent || 10;
      const newPercentage = Math.min(
        100,
        (config.percentageRollout || 0) + increment,
      );

      config.percentageRollout = newPercentage;
      config.strategy = 'percentage'; // Switch to percentage-based after graduation

      await this.setRolloutConfig(config);
      this.logger.log(`Graduated ${featureName} to ${newPercentage}% rollout`);
    } catch (error) {
      this.logger.error(`Failed to graduate rollout:`, error);
      throw error;
    }
  }

  /**
   * Rollback a feature flag
   */
  async rollback(featureName: string): Promise<void> {
    try {
      const config = await this.getRolloutConfig(featureName);
      if (!config) {
        throw new Error('Feature not found');
      }

      config.enabled = false;
      await this.setRolloutConfig(config);

      this.logger.warn(`Rolled back feature: ${featureName}`);
    } catch (error) {
      this.logger.error(`Failed to rollback feature:`, error);
      throw error;
    }
  }

  /**
   * Get rollout comparison for A/B test analysis
   */
  getABTestResults(): Promise<{
    control: any;
    treatment: any;
    difference: number;
    recommendation: string;
  } | null> {
    try {
      // This would integrate with PerformanceMetricsService
      // to compare metrics between control and treatment groups
      // Placeholder for actual implementation
      return Promise.resolve(null);
    } catch (error) {
      this.logger.error(`Failed to get A/B test results:`, error);
      return Promise.resolve(null);
    }
  }

  // ============ Private helper methods ============

  /**
   * Check if user falls in percentage rollout using consistent hashing
   */
  private isUserInPercentage(
    userId: string,
    featureName: string,
    percentage: number,
  ): boolean {
    const hash = this.hashFunction(userId + featureName);
    return hash % 100 < percentage;
  }

  /**
   * Check if user is in included/excluded lists
   */
  private isUserInList(userId: string, config: RolloutConfig): boolean {
    if (config.includedUserIds && config.includedUserIds.includes(userId)) {
      return true;
    }
    if (config.excludedUserIds && config.excludedUserIds.includes(userId)) {
      return false;
    }
    // If neither list contains user, use percentage
    return this.isUserInPercentage(
      userId,
      config.featureName,
      config.percentageRollout ?? 0,
    );
  }

  /**
   * Check if user is in specified segment
   */
  private async isUserInSegment(
    userId: string,
    segment: string,
  ): Promise<boolean> {
    try {
      // For now, implement a simple segment check based on user properties
      // This would be extended to use actual user segments from the database
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true },
      });

      if (!user) {
        return false;
      }

      // Check if user email matches segment criteria
      // This is a placeholder - implement actual segment logic
      return segment === 'beta_testers' && user.email.includes('beta');
    } catch (error) {
      this.logger.error(`Failed to check user segment:`, error);
      return false;
    }
  }

  /**
   * Check if user should get feature in gradual rollout
   */
  private isUserInGradualRollout(
    userId: string,
    featureName: string,
    config: RolloutConfig,
  ): boolean {
    const percentage = config.percentageRollout ?? 0;
    const dailyIncrement = config.dailyIncrementPercent ?? 10;

    // Calculate current day's percentage based on start date
    if (!config.startDate) {
      return this.isUserInPercentage(userId, featureName, percentage);
    }

    const startTime = config.startDate.getTime();
    const currentTime = new Date().getTime();
    const daysPassed = Math.floor(
      (currentTime - startTime) / (24 * 60 * 60 * 1000),
    );
    const currentPercentage = Math.min(
      100,
      percentage + daysPassed * dailyIncrement,
    );

    return this.isUserInPercentage(userId, featureName, currentPercentage);
  }

  /**
   * Consistent hash function for user ID
   */
  private hashFunction(input: string): number {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Assign variant based on user hash
   */
  private hashToVariant(
    userId: string,
    featureName: string,
  ): 'control' | 'treatment' {
    const hash = this.hashFunction(userId + featureName);
    return hash % 2 === 0 ? 'control' : 'treatment';
  }

  /**
   * Validate rollout configuration
   */
  private validateRolloutConfig(config: RolloutConfig): void {
    if (!config.featureName) {
      throw new Error('Feature name is required');
    }

    if (config.strategy === 'percentage') {
      if (
        config.percentageRollout === undefined ||
        config.percentageRollout < 0 ||
        config.percentageRollout > 100
      ) {
        throw new Error('Percentage rollout must be between 0 and 100');
      }
    }

    if (
      config.startDate &&
      config.endDate &&
      config.startDate > config.endDate
    ) {
      throw new Error('Start date must be before end date');
    }
  }
}
