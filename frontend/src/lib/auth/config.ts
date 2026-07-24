/**
 * Application configuration
 * Centralized configuration management for the frontend application
 */

export const config = {
  // API Configuration
  api: {
    baseUrl: process.env.NEXT_PUBLIC_API_URL || '',
    analyticsUrl: process.env.NEXT_PUBLIC_ANALYTICS_API_URL || '',
    timeout: 10000,
  },

  // Application Settings
  app: {
    name: 'MedTrack Hub',
    version: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    url: process.env.NEXT_PUBLIC_APP_URL || '',
  },

  // Authentication
  auth: {
    tokenKey: 'medtrack_token',
    refreshTokenKey: 'medtrack_refresh_token',
    sessionTimeout: 24 * 60 * 60 * 1000, // 24 hours
  },

  // Features
  features: {
    analytics: process.env.NEXT_PUBLIC_ENABLE_ANALYTICS === 'true',
    offlineMode: process.env.NEXT_PUBLIC_ENABLE_OFFLINE === 'true',
    notifications: process.env.NEXT_PUBLIC_ENABLE_NOTIFICATIONS === 'true',
  },

  // UI Configuration
  ui: {
    theme: {
      defaultMode: 'light' as const,
      storageKey: 'medtrack_theme',
    },
    pagination: {
      defaultPageSize: 10,
      maxPageSize: 100,
    },
  },

  // Storage
  storage: {
    prefix: 'medtrack_',
    version: '1.0',
  },

  // Performance
  performance: {
    enableMetrics: process.env.NODE_ENV === 'production',
    sampleRate: 0.1,
  },
} as const;

export type Config = typeof config;
