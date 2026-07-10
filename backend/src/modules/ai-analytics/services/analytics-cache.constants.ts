/**
 * Standardized Redis cache keys and TTL configuration for AI Analytics services
 * Ensures consistent naming and expiration across all analytics operations
 */

export const ANALYTICS_CACHE_CONFIG = {
  // Default TTL for all analytics caches (1 hour)
  DEFAULT_TTL: 3600,

  // Learning-related cache keys
  LEARNING: {
    PATTERNS: (userId: string) => `analytics:learning:patterns:${userId}`,
    ENGAGEMENT: (userId: string) => `analytics:learning:engagement:${userId}`,
    ANALYTICS: (userId: string) => `analytics:learning:detailed:${userId}`,
    FEATURE_VECTOR: (userId: string) =>
      `analytics:learning:feature_vector:${userId}`,
    PERFORMANCE_PROFILE: (userId: string) =>
      `analytics:learning:profile:${userId}`,
    PATH_ANALYTICS: (pathId: string) => `analytics:learning:path:${pathId}`,
    GOALS: (userId: string) => `analytics:learning:goals:${userId}`,
    USER_INSIGHTS: (userId: string) => `analytics:learning:insights:${userId}`,
    COURSE_STATS: (userId: string) => `analytics:learning:courses:${userId}`,
    PATH_STATS: (userId: string) => `analytics:learning:path_stats:${userId}`,
  },

  // Assessment-related cache keys
  ASSESSMENT: {
    PREDICTIONS: (userId: string, assessmentId?: string) =>
      `analytics:assessment:prediction:${userId}:${assessmentId || 'default'}`,
    HISTORY: (userId: string) => `analytics:assessment:history:${userId}`,
    PERFORMANCE: (userId: string) =>
      `analytics:assessment:performance:${userId}`,
    BKT: (userId: string) => `analytics:assessment:bkt:${userId}`,
    BURN: (userId: string) => `analytics:assessment:burn:${userId}`,
    ADAPTIVE_QUIZ: (userId: string, courseId?: string, unitId?: string) =>
      `analytics:assessment:adaptive:${userId}:${courseId || 'all'}:${unitId || 'all'}`,
    ADAPTIVE_SESSION: (userId: string, sessionId?: string) =>
      `analytics:assessment:adaptive_session:${userId}:${sessionId || ''}`,
  },

  // Recommendation-related cache keys
  RECOMMENDATIONS: {
    AI: (userId: string) => `analytics:recommendations:ai:${userId}`,
    ASSESSMENT: (userId: string, assessmentId?: string) =>
      `analytics:recommendations:assessment:${userId}:${assessmentId || 'all'}`,
    PERSONALIZED: (userId: string) =>
      `analytics:recommendations:personal:${userId}`,
    COLLABORATIVE: (userId: string, limit?: number) =>
      `analytics:recommendations:collab:${userId}:${limit || 5}`,
    TRENDING_PATHS: (limit?: number) =>
      `analytics:recommendations:trending:${limit || 5}`,
    STUDY: (userId: string) => `analytics:recommendations:study:${userId}`,
    PREDICTION: (userId: string) =>
      `analytics:recommendations:prediction:${userId}`,
    NEXT_STEPS: (userId: string) => `analytics:recommendations:next:${userId}`,
    COURSE: (userId: string) => `analytics:recommendations:course:${userId}`,
    PATH: (userId: string, limit?: number) =>
      `analytics:recommendations:path:${userId}:${limit || 10}`,
    PATH_PATTERN: (userId: string) =>
      `analytics:recommendations:path:${userId}:*`,
    RESOURCES: (assessmentId: string) =>
      `analytics:recommendations:resources:${assessmentId}`,
    STUDY_WITH_GAPS: (userId: string, gaps: string[]) =>
      `analytics:recommendations:study:${userId}:${encodeURIComponent(JSON.stringify(gaps))}`,
  },

  // Content and model related caches
  CONTENT: {
    FEATURES: (contentId: string) => `analytics:content:features:${contentId}`,
  },

  // Unit & course related caches
  UNIT: {
    PROGRESS: (userId: string, unitId: string) =>
      `analytics:unit:progress:${userId}:${unitId}`,
  },

  COURSE: {
    PROGRESS: (userId: string, courseId: string) =>
      `analytics:course:progress:${userId}:${courseId}`,
    ANALYTICS: (courseId: string) => `analytics:course:${courseId}`,
  },

  MODEL: {
    PREDICTIONS: (userId: string, fingerprint?: string) =>
      `analytics:model:predictions:${userId}:${fingerprint || 'default'}`,
  },

  // Deduplication keys (use shorter TTL for request dedup)
  DEDUP: (cacheKey: string) => `dedup:${cacheKey}`,
};

export const ANALYTICS_METRICS_CONFIG = {
  // Standard metrics naming for all analytics operations
  ENDPOINTS: {
    LEARNING: 'learningAnalytics',
    ASSESSMENT: 'assessmentAnalytics',
    RECOMMENDATIONS: 'recommendations',
    PREDICTIONS: 'predictions',
  },

  // Metric field standards
  FIELDS: {
    CACHE_HIT: 'cacheHit',
    RESPONSE_TIME_MS: 'responseTimeMs',
    PROVIDER: 'provider',
    SUCCESS: 'success',
    ENDPOINT: 'endpoint',
    METHOD: 'method',
    USER_ID: 'userId',
  },

  // Provider type: gRPC-first architecture
  PROVIDERS: {
    GRPC: 'grpc',
  },
} as const;
