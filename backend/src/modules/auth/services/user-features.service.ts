/* eslint-disable @typescript-eslint/no-unused-vars */

import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '#infrastructure/redis/redis.service';

export interface UserActivity {
  userId: string;
  action: string;
  contentId?: string;
  contentType?: string;
  timestamp: Date;
  duration?: number;
  score?: number;
  metadata?: Record<string, any>;
}

export interface UserLearningPattern {
  preferredTimeSlots: string[];
  averageSessionDuration: number;
  learningVelocity: number;
  difficultyProgression: number;
  contentPreferences: Record<string, number>;
  weakAreas: string[];
  strongAreas: string[];
  engagementScore: number;
}

export interface UserFeatureProfile {
  userId: string;
  learningPattern: UserLearningPattern;
  behaviorMetrics: {
    totalSessions: number;
    averageScore: number;
    completionRate: number;
    retentionRate: number;
    streakDays: number;
    lastActiveDate: Date;
  };
  preferences: {
    contentTypes: Record<string, number>;
    difficultyLevel: string;
    learningStyle: string;
    topicInterests: Record<string, number>;
  };
  contextualFeatures: {
    timePatterns: Record<string, number>;
    deviceUsage: Record<string, number>;
    socialEngagement: number;
    helpSeekingBehavior: number;
  };
  lastUpdated: Date;
}

@Injectable()
export class UserFeaturesService {
  private readonly logger = new Logger(UserFeaturesService.name);
  private readonly CACHE_TTL = 3600; // 1 hour
  private readonly FEATURE_CACHE_PREFIX = 'user_features:';
  private readonly ACTIVITY_CACHE_PREFIX = 'user_activities:';

  constructor(private readonly redisService: RedisService) {}

  /**
   * Get user features (simplified view of feature profile)
   */
  async getUserFeatures(
    userId: string,
  ): Promise<Partial<UserFeatureProfile> | null> {
    try {
      const profile = await this.getUserFeatureProfile(userId);
      if (!profile) {
        this.logger.warn(`No feature profile found for user ${userId}`);
        return null;
      }

      // Return a simplified version of the profile for the controller
      return {
        userId: profile.userId,
        learningPattern: {
          averageSessionDuration:
            (profile.learningPattern as any).averageSessionDuration ?? 0,
          learningVelocity:
            (profile.learningPattern as any).learningVelocity ?? 0,
          difficultyProgression:
            (profile.learningPattern as any).difficultyProgression ?? 0,
          weakAreas: (profile.learningPattern as any).weakAreas ?? [],
          strongAreas: (profile.learningPattern as any).strongAreas ?? [],
          contentPreferences: profile.learningPattern.contentPreferences,
          engagementScore: profile.learningPattern.engagementScore,
        } as UserLearningPattern,
        preferences: profile.preferences,
        lastUpdated: profile.lastUpdated,
      };
    } catch (error) {
      this.logger.error(`Failed to get user features for ${userId}:`, error);
      return null;
    }
  }

  /**
   * Enable a specific feature for a user
   */
  async enableFeature(userId: string, feature: string): Promise<boolean> {
    try {
      const profile = await this.getUserFeatureProfile(userId);
      if (!profile) {
        this.logger.warn(`No feature profile found for user ${userId}`);
        return false;
      }

      // Add feature to user preferences or metadata
      profile.preferences.contentTypes[feature] =
        (profile.preferences.contentTypes[feature] || 0) + 1;
      profile.lastUpdated = new Date();

      // Update cache
      const cacheKey = `${this.FEATURE_CACHE_PREFIX}${userId}`;
      await this.redisService.set(
        cacheKey,
        JSON.stringify(profile),
        this.CACHE_TTL,
      );

      this.logger.debug(`Enabled feature ${feature} for user ${userId}`);
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to enable feature ${feature} for user ${userId}:`,
        error,
      );
      return false;
    }
  }

  /**
   * Disable a specific feature for a user
   */
  async disableFeature(userId: string, feature: string): Promise<boolean> {
    try {
      const profile = await this.getUserFeatureProfile(userId);
      if (!profile) {
        this.logger.warn(`No feature profile found for user ${userId}`);
        return false;
      }

      // Remove or reduce feature from preferences
      if (profile.preferences.contentTypes[feature]) {
        delete profile.preferences.contentTypes[feature];
        profile.lastUpdated = new Date();

        // Update cache
        const cacheKey = `${this.FEATURE_CACHE_PREFIX}${userId}`;
        await this.redisService.set(
          cacheKey,
          JSON.stringify(profile),
          this.CACHE_TTL,
        );

        this.logger.debug(`Disabled feature ${feature} for user ${userId}`);
        return true;
      }

      this.logger.warn(`Feature ${feature} was not enabled for user ${userId}`);
      return false;
    } catch (error) {
      this.logger.error(
        `Failed to disable feature ${feature} for user ${userId}:`,
        error,
      );
      return false;
    }
  }

  /**
   * Track user activity and update features incrementally
   */
  async trackActivity(activity: UserActivity): Promise<void> {
    try {
      // Store recent activity
      const activityKey = `${this.ACTIVITY_CACHE_PREFIX}${activity.userId}`;
      const recentActivities = await this.getRecentActivities(activity.userId);

      // Keep last 100 activities
      const updatedActivities = [activity, ...recentActivities.slice(0, 99)];
      await this.redisService.set(
        activityKey,
        JSON.stringify(updatedActivities),
        this.CACHE_TTL * 24, // 24 hours for activity data
      );

      // Update user features incrementally
      await this.updateUserFeaturesIncremental(activity);

      this.logger.debug(
        `Tracked activity for user ${activity.userId}: ${activity.action}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to track activity for user ${activity.userId}:`,
        error,
      );
    }
  }

  /**
   * Get comprehensive user feature profile
   */
  async getUserFeatureProfile(
    userId: string,
  ): Promise<UserFeatureProfile | null> {
    try {
      const cacheKey = `${this.FEATURE_CACHE_PREFIX}${userId}`;
      const cached = await this.redisService.get(cacheKey);

      if (cached) {
        return JSON.parse(cached);
      }

      // Generate fresh feature profile
      const profile = await this.generateUserFeatureProfile(userId);

      if (profile) {
        await this.redisService.set(
          cacheKey,
          JSON.stringify(profile),
          this.CACHE_TTL,
        );
      }

      return profile;
    } catch (error) {
      this.logger.error(
        `Failed to get user feature profile for ${userId}:`,
        error,
      );
      return null;
    }
  }

  /**
   * Generate AI-ready feature vector for user
   */
  async getUserFeatureVector(userId: string): Promise<number[] | null> {
    try {
      const profile = await this.getUserFeatureProfile(userId);
      if (!profile) {
        return null;
      }

      // Convert profile to numerical feature vector
      const features: number[] = [
        // Learning pattern features (7 features)
        profile.learningPattern.averageSessionDuration / 3600, // normalized to hours
        profile.learningPattern.learningVelocity,
        profile.learningPattern.difficultyProgression,
        profile.learningPattern.engagementScore,
        profile.learningPattern.preferredTimeSlots.length / 24, // normalized
        profile.learningPattern.weakAreas.length,
        profile.learningPattern.strongAreas.length,

        // Behavior metrics (6 features)
        Math.log(profile.behaviorMetrics.totalSessions + 1) / 10, // log-normalized
        profile.behaviorMetrics.averageScore / 100, // normalized to 0-1
        profile.behaviorMetrics.completionRate,
        profile.behaviorMetrics.retentionRate,
        Math.min(profile.behaviorMetrics.streakDays / 30, 1), // capped at 30 days
        this.getDaysSinceLastActive(profile.behaviorMetrics.lastActiveDate) /
          30,

        // Contextual features (4 features)
        profile.contextualFeatures.socialEngagement,
        profile.contextualFeatures.helpSeekingBehavior,
        this.getTopPreferenceScore(profile.preferences.contentTypes),
        this.getPreferenceDiversity(profile.preferences.topicInterests),
      ];

      return features;
    } catch (error) {
      this.logger.error(
        `Failed to generate feature vector for ${userId}:`,
        error,
      );
      return null;
    }
  }

  /**
   * Get recent user activities
   */
  private async getRecentActivities(userId: string): Promise<UserActivity[]> {
    try {
      const activityKey = `${this.ACTIVITY_CACHE_PREFIX}${userId}`;
      const cached = await this.redisService.get(activityKey);
      return cached ? JSON.parse(cached) : [];
    } catch (error) {
      this.logger.error(
        `Failed to get recent activities for ${userId}:`,
        error,
      );
      return [];
    }
  }

  /**
   * Update user features incrementally based on new activity
   */
  private async updateUserFeaturesIncremental(
    activity: UserActivity,
  ): Promise<void> {
    const profile = await this.getUserFeatureProfile(activity.userId);
    if (!profile) {
      return;
    }

    // Update behavior metrics
    profile.behaviorMetrics.totalSessions += 1;
    profile.behaviorMetrics.lastActiveDate = activity.timestamp;

    if (activity.score !== undefined) {
      const currentAvg = profile.behaviorMetrics.averageScore;
      const sessions = profile.behaviorMetrics.totalSessions;
      profile.behaviorMetrics.averageScore =
        (currentAvg * (sessions - 1) + activity.score) / sessions;
    }

    // Update preferences
    if (activity.contentType) {
      profile.preferences.contentTypes[activity.contentType] =
        (profile.preferences.contentTypes[activity.contentType] || 0) + 1;
    }

    // Update contextual features
    const hour = activity.timestamp.getHours();
    const timeSlot = this.getTimeSlot(hour);
    profile.contextualFeatures.timePatterns[timeSlot] =
      (profile.contextualFeatures.timePatterns[timeSlot] || 0) + 1;

    profile.lastUpdated = new Date();

    // Cache updated profile
    const cacheKey = `${this.FEATURE_CACHE_PREFIX}${activity.userId}`;
    await this.redisService.set(
      cacheKey,
      JSON.stringify(profile),
      this.CACHE_TTL,
    );
  }

  /**
   * Generate complete user feature profile from activities
   */
  private async generateUserFeatureProfile(
    userId: string,
  ): Promise<UserFeatureProfile | null> {
    const activities = await this.getRecentActivities(userId);
    if (activities.length === 0) {
      return null;
    }

    const now = new Date();
    const profile: UserFeatureProfile = {
      userId,
      learningPattern: this.extractLearningPattern(activities),
      behaviorMetrics: this.extractBehaviorMetrics(activities),
      preferences: this.extractPreferences(activities),
      contextualFeatures: this.extractContextualFeatures(activities),
      lastUpdated: now,
    };

    return profile;
  }

  /**
   * Extract learning patterns from user activities
   */
  private extractLearningPattern(
    activities: UserActivity[],
  ): UserLearningPattern {
    const sessions = this.groupActivitiesBySessions(activities);
    const scores = activities
      .filter((a) => a.score !== undefined)
      .map((a) => a.score);

    return {
      preferredTimeSlots: this.getPreferredTimeSlots(activities),
      averageSessionDuration: this.calculateAverageSessionDuration(sessions),
      learningVelocity: this.calculateLearningVelocity(activities),
      difficultyProgression: this.calculateDifficultyProgression(activities),
      contentPreferences: this.getContentPreferences(activities),
      weakAreas: this.identifyWeakAreas(activities),
      strongAreas: this.identifyStrongAreas(activities),
      engagementScore: this.calculateEngagementScore(activities),
    };
  }

  /**
   * Extract behavior metrics
   */
  private extractBehaviorMetrics(activities: UserActivity[]) {
    const completedActivities = activities.filter(
      (a) => a.action === 'complete',
    );
    const scores = activities
      .filter((a) => a.score !== undefined)
      .map((a) => a.score!);

    return {
      totalSessions: this.groupActivitiesBySessions(activities).length,
      averageScore:
        scores.length > 0
          ? scores.reduce((a, b) => (a ?? 0) + (b ?? 0), 0) / scores.length
          : 0,
      completionRate:
        activities.length > 0
          ? completedActivities.length / activities.length
          : 0,
      retentionRate: this.calculateRetentionRate(activities),
      streakDays: this.calculateStreakDays(activities),
      lastActiveDate:
        activities.length > 0 ? activities[0].timestamp : new Date(),
    };
  }

  /**
   * Extract user preferences
   */
  private extractPreferences(activities: UserActivity[]) {
    const contentTypes: Record<string, number> = {};
    const topicInterests: Record<string, number> = {};

    activities.forEach((activity) => {
      if (activity.contentType) {
        contentTypes[activity.contentType] =
          (contentTypes[activity.contentType] || 0) + 1;
      }

      if (activity.metadata?.topic) {
        topicInterests[activity.metadata.topic] =
          (topicInterests[activity.metadata.topic] || 0) + 1;
      }
    });

    return {
      contentTypes,
      difficultyLevel: this.inferDifficultyPreference(activities),
      learningStyle: this.inferLearningStyle(activities),
      topicInterests,
    };
  }

  /**
   * Extract contextual features
   */
  private extractContextualFeatures(activities: UserActivity[]) {
    const timePatterns: Record<string, number> = {};
    const deviceUsage: Record<string, number> = {};

    activities.forEach((activity) => {
      const timeSlot = this.getTimeSlot(activity.timestamp.getHours());
      timePatterns[timeSlot] = (timePatterns[timeSlot] || 0) + 1;

      if (activity.metadata?.device) {
        deviceUsage[activity.metadata.device] =
          (deviceUsage[activity.metadata.device] || 0) + 1;
      }
    });

    return {
      timePatterns,
      deviceUsage,
      socialEngagement: this.calculateSocialEngagement(activities),
      helpSeekingBehavior: this.calculateHelpSeekingBehavior(activities),
    };
  }

  // Helper methods
  private getTimeSlot(hour: number): string {
    if (hour < 6) {
      return 'night';
    }
    if (hour < 12) {
      return 'morning';
    }
    if (hour < 18) {
      return 'afternoon';
    }
    return 'evening';
  }

  private groupActivitiesBySessions(
    activities: UserActivity[],
  ): UserActivity[][] {
    // Group activities by sessions (activities within 30 minutes of each other)
    const sessions: UserActivity[][] = [];
    let currentSession: UserActivity[] = [];

    activities.forEach((activity, index) => {
      if (index === 0) {
        currentSession = [activity];
      } else {
        const timeDiff =
          activities[index - 1].timestamp.getTime() -
          activity.timestamp.getTime();
        if (timeDiff < 30 * 60 * 1000) {
          // 30 minutes
          currentSession.push(activity);
        } else {
          sessions.push(currentSession);
          currentSession = [activity];
        }
      }
    });

    if (currentSession.length > 0) {
      sessions.push(currentSession);
    }

    return sessions;
  }

  private calculateAverageSessionDuration(sessions: UserActivity[][]): number {
    if (sessions.length === 0) {
      return 0;
    }

    const durations = sessions.map((session) => {
      if (session.length < 2) {
        return 0;
      }
      const start = session[session.length - 1].timestamp.getTime();
      const end = session[0].timestamp.getTime();
      return (end - start) / 1000; // in seconds
    });

    return durations.reduce((a, b) => a + b) / durations.length;
  }

  private calculateLearningVelocity(activities: UserActivity[]): number {
    const completedActivities = activities.filter(
      (a) => a.action === 'complete',
    );
    if (completedActivities.length < 2) {
      return 0;
    }

    const timeSpan =
      completedActivities[0].timestamp.getTime() -
      completedActivities[completedActivities.length - 1].timestamp.getTime();
    const days = timeSpan / (1000 * 60 * 60 * 24);

    return days > 0 ? completedActivities.length / days : 0;
  }

  private calculateDifficultyProgression(activities: UserActivity[]): number {
    // Simplified: assume metadata contains difficulty level
    const difficultiesWithTime = activities
      .filter((a) => a.metadata?.difficulty)
      .map((a) => ({
        difficulty: parseFloat(a.metadata!.difficulty as string),
        time: a.timestamp,
      }))
      .sort((a, b) => (b.time?.getTime() ?? 0) - (a.time?.getTime() ?? 0));

    if (difficultiesWithTime.length < 2) {
      return 0;
    }

    const recent = difficultiesWithTime.slice(
      0,
      Math.ceil(difficultiesWithTime.length / 3),
    );
    const older = difficultiesWithTime.slice(
      -Math.ceil(difficultiesWithTime.length / 3),
    );

    const recentAvg =
      recent.reduce((sum, item) => sum + item.difficulty, 0) / recent.length;
    const olderAvg =
      older.reduce((sum, item) => sum + item.difficulty, 0) / older.length;

    return recentAvg - olderAvg; // Positive means progressing to harder content
  }

  private getContentPreferences(
    activities: UserActivity[],
  ): Record<string, number> {
    const preferences: Record<string, number> = {};
    activities.forEach((activity) => {
      if (activity.contentType) {
        preferences[activity.contentType] =
          (preferences[activity.contentType] || 0) + 1;
      }
    });
    return preferences;
  }

  private identifyWeakAreas(activities: UserActivity[]): string[] {
    const topicScores: Record<string, number[]> = {};

    activities.forEach((activity) => {
      if (activity.metadata?.topic && activity.score !== undefined) {
        if (!topicScores[activity.metadata.topic]) {
          topicScores[activity.metadata.topic] = [];
        }
        topicScores[activity.metadata.topic].push(activity.score);
      }
    });

    return Object.entries(topicScores)
      .map(([topic, scores]) => ({
        topic,
        avgScore: scores.reduce((a, b) => a + b) / scores.length,
      }))
      .filter((item) => item.avgScore < 60) // Below 60% average
      .map((item) => item.topic);
  }

  private identifyStrongAreas(activities: UserActivity[]): string[] {
    const topicScores: Record<string, number[]> = {};

    activities.forEach((activity) => {
      if (activity.metadata?.topic && activity.score !== undefined) {
        if (!topicScores[activity.metadata.topic]) {
          topicScores[activity.metadata.topic] = [];
        }
        topicScores[activity.metadata.topic].push(activity.score);
      }
    });

    return Object.entries(topicScores)
      .map(([topic, scores]) => ({
        topic,
        avgScore: scores.reduce((a, b) => a + b) / scores.length,
      }))
      .filter((item) => item.avgScore > 85) // Above 85% average
      .map((item) => item.topic);
  }

  private calculateEngagementScore(activities: UserActivity[]): number {
    const engagementActions = activities.filter((a) =>
      ['like', 'share', 'comment', 'bookmark', 'review'].includes(a.action),
    );

    const totalActions = activities.length;
    return totalActions > 0 ? engagementActions.length / totalActions : 0;
  }

  private getPreferredTimeSlots(activities: UserActivity[]): string[] {
    const timeSlotCounts: Record<string, number> = {};

    activities.forEach((activity) => {
      const timeSlot = this.getTimeSlot(activity.timestamp.getHours());
      timeSlotCounts[timeSlot] = (timeSlotCounts[timeSlot] || 0) + 1;
    });

    const totalActivities = activities.length;
    return Object.entries(timeSlotCounts)
      .filter(([_, count]) => count / totalActivities > 0.2) // More than 20% of activities
      .map(([timeSlot]) => timeSlot);
  }

  private calculateRetentionRate(activities: UserActivity[]): number {
    // Simple retention: user active in last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentActivities = activities.filter(
      (a) => a.timestamp > sevenDaysAgo,
    );
    return recentActivities.length > 0 ? 1 : 0;
  }

  private calculateStreakDays(activities: UserActivity[]): number {
    const uniqueDays = [
      ...new Set(activities.map((a) => a.timestamp.toDateString())),
    ].sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

    let streak = 0;
    const today = new Date().toDateString();

    for (let i = 0; i < uniqueDays.length; i++) {
      const dayDiff =
        (new Date(today).getTime() - new Date(uniqueDays[i]).getTime()) /
        (1000 * 60 * 60 * 24);
      if (dayDiff <= i + 1) {
        streak++;
      } else {
        break;
      }
    }

    return streak;
  }

  private inferDifficultyPreference(activities: UserActivity[]): string {
    const difficulties = activities
      .filter((a) => a.metadata?.difficulty)
      .map((a) => parseFloat(a.metadata!.difficulty as string));

    if (difficulties.length === 0) {
      return 'medium';
    }

    const avgDifficulty =
      difficulties.reduce((a, b) => a + b) / difficulties.length;

    if (avgDifficulty < 0.3) {
      return 'easy';
    }
    if (avgDifficulty > 0.7) {
      return 'hard';
    }
    return 'medium';
  }

  private inferLearningStyle(activities: UserActivity[]): string {
    const actionCounts: Record<string, number> = {};

    activities.forEach((activity) => {
      actionCounts[activity.action] = (actionCounts[activity.action] || 0) + 1;
    });

    // Simple heuristic based on action patterns
    const readActions =
      (actionCounts['read'] || 0) + (actionCounts['view'] || 0);
    const practiceActions =
      (actionCounts['practice'] || 0) + (actionCounts['quiz'] || 0);
    const interactiveActions =
      (actionCounts['interact'] || 0) + (actionCounts['discuss'] || 0);

    if (readActions > practiceActions && readActions > interactiveActions) {
      return 'visual';
    }
    if (practiceActions > interactiveActions) {
      return 'kinesthetic';
    }
    return 'interactive';
  }

  private calculateSocialEngagement(activities: UserActivity[]): number {
    const socialActions = activities.filter((a) =>
      ['share', 'comment', 'discuss', 'collaborate'].includes(a.action),
    );

    return activities.length > 0 ? socialActions.length / activities.length : 0;
  }

  private calculateHelpSeekingBehavior(activities: UserActivity[]): number {
    const helpActions = activities.filter((a) =>
      ['help', 'hint', 'support', 'ask'].includes(a.action),
    );

    return activities.length > 0 ? helpActions.length / activities.length : 0;
  }

  private getDaysSinceLastActive(lastActive: Date): number {
    return (
      (new Date().getTime() - lastActive.getTime()) / (1000 * 60 * 60 * 24)
    );
  }

  private getTopPreferenceScore(preferences: Record<string, number>): number {
    const values = Object.values(preferences);
    if (values.length === 0) {
      return 0;
    }

    const max = Math.max(...values);
    const total = values.reduce((a, b) => a + b);

    return total > 0 ? max / total : 0;
  }

  private getPreferenceDiversity(preferences: Record<string, number>): number {
    const values = Object.values(preferences);
    if (values.length <= 1) {
      return 0;
    }

    const total = values.reduce((a, b) => a + b);
    if (total === 0) {
      return 0;
    }

    const probabilities = values.map((v) => v / total);
    const entropy = -probabilities.reduce(
      (sum, p) => sum + (p > 0 ? p * Math.log2(p) : 0),
      0,
    );

    return entropy / Math.log2(values.length); // Normalized entropy
  }

  /**
   * Batch process feature extraction for multiple users
   */
  async batchUpdateUserFeatures(userIds: string[]): Promise<void> {
    const batchSize = 10;

    for (let i = 0; i < userIds.length; i += batchSize) {
      const batch = userIds.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async (userId) => {
          try {
            await this.getUserFeatureProfile(userId);
            this.logger.debug(`Updated features for user ${userId}`);
          } catch (error) {
            this.logger.error(
              `Failed to update features for user ${userId}:`,
              error,
            );
          }
        }),
      );
    }
  }

  /**
   * Get feature statistics for analytics
   */
  getFeatureStatistics(): Promise<Record<string, any>> {
    // This would typically query your database for user statistics
    // For now, return a placeholder structure
    return Promise.resolve({
      totalUsers: 0,
      averageEngagementScore: 0,
      topContentTypes: {},
      learningStyleDistribution: {},
      difficultyPreferenceDistribution: {},
    });
  }
}
