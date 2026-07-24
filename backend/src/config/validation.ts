/**
 * Environment variable validation schema
 * Validates and transforms environment variables at startup
 */

import * as Joi from 'joi';

export const validationSchema = Joi.object({
  // Application
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test', 'staging')
    .default('development'),
  PORT: Joi.number().port().default(3002),
  APP_NAME: Joi.string().default('MedTrack Hub'),
  APP_VERSION: Joi.string().default('1.0.0'),

  // Database
  // Support both Neon/managed Postgres URLs and traditional host-based config.
  POSTGRES_HOST: Joi.string().optional(),
  POSTGRES_PORT: Joi.number().port().default(5432),
  POSTGRES_USER: Joi.string().optional(),
  POSTGRES_PASSWORD: Joi.string().optional(),
  POSTGRES_DB: Joi.string().optional(),
  DATABASE_URL: Joi.string().uri().optional(),
  TYPEORM_SYNC: Joi.boolean().default(false),
  TYPEORM_LOGGING: Joi.boolean().default(false),
  DATABASE_SSL: Joi.boolean().default(false),
  DATABASE_MAX_CONNECTIONS: Joi.number().min(1).max(100).default(10),
  DATABASE_ACQUIRE_TIMEOUT: Joi.number().min(1000).default(60000),
  DATABASE_TIMEOUT: Joi.number().min(1000).default(60000),

  // Redis
  // Support either a direct Redis URL (e.g. Upstash / managed Redis) or
  // a host-based configuration for Docker/local development.
  REDIS_URL: Joi.string().uri().optional(),
  REDIS_HOST: Joi.string().default('redis'),
  REDIS_PORT: Joi.number().port().default(6379),
  REDIS_PASSWORD: Joi.string().optional(),
  REDIS_DB: Joi.number().min(0).max(15).default(0),
  REDIS_KEY_PREFIX: Joi.string().default('medtrack:'),
  REDIS_TTL: Joi.number().min(60).default(3600),

  // JWT (Required)
  JWT_SECRET: Joi.string().min(32).required(),
  JWT_EXPIRES_IN: Joi.string().default('24h'),
  JWT_REFRESH_SECRET: Joi.string().min(32).required(),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),
  JWT_ISSUER: Joi.string().default('medtrack-hub'),
  JWT_AUDIENCE: Joi.string().default('medtrack-users'),

  // CORS
  CORS_ORIGIN: Joi.string().default(''),
  CORS_CREDENTIALS: Joi.boolean().default(true),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: Joi.number().min(1000).default(900000), // 15 minutes
  RATE_LIMIT_MAX: Joi.number().min(1).default(100),
  RATE_LIMIT_SKIP_SUCCESS: Joi.boolean().default(false),
  RATE_LIMIT_SKIP_FAILED: Joi.boolean().default(false),

  // File Upload
  UPLOAD_MAX_FILE_SIZE: Joi.number().min(1024).default(10485760), // 10MB
  UPLOAD_ALLOWED_MIME_TYPES: Joi.string().default(
    'image/jpeg,image/png,image/gif,image/webp,application/pdf,text/plain',
  ),
  UPLOAD_DESTINATION: Joi.string().default('./uploads'),

  // Email
  EMAIL_HOST: Joi.string().hostname().optional(),
  EMAIL_PORT: Joi.number().port().default(587),
  EMAIL_SECURE: Joi.boolean().default(false),
  EMAIL_USER: Joi.string().email().optional(),
  EMAIL_PASSWORD: Joi.string().optional(),
  EMAIL_FROM: Joi.string().email().default('noreply@medtrack-hub.com'),

  // AWS
  AWS_REGION: Joi.string().default('us-east-1'),
  AWS_ACCESS_KEY_ID: Joi.string().optional(),
  AWS_SECRET_ACCESS_KEY: Joi.string().optional(),
  AWS_S3_BUCKET: Joi.string().optional(),
  AWS_S3_REGION: Joi.string().optional(),

  // Cloudinary
  CLOUDINARY_CLOUD_NAME: Joi.string().optional(),
  CLOUDINARY_API_KEY: Joi.string().optional(),
  CLOUDINARY_API_SECRET: Joi.string().optional(),
  CLOUDINARY_URL: Joi.string().uri().optional(),
  CLOUDINARY_FOLDER: Joi.string().default('medtrack'),
  FILE_STORAGE_PROVIDER: Joi.string().valid('cloudinary', 's3', 'local').default('cloudinary'),
  LOCAL_STORAGE_PATH: Joi.string().default('./uploads'),
  ENABLE_REDIS: Joi.boolean().default(false),
  RUN_INGESTION: Joi.boolean().default(false),
  INGESTION_ROOT_PATH: Joi.string().default('./data/ingestion'),
  HOSTNAME: Joi.string().default('0.0.0.0'),
  ALLOWED_ORIGINS: Joi.string().default(''),

  // Analytics Service
  ANALYTICS_SERVICE_URL: Joi.string().uri().default(''),
  ANALYTICS_GRPC_URL: Joi.string().default('localhost:50051'),
  ENABLE_GRPC: Joi.boolean().default(true),
  GOTENBERG_URL: Joi.string().uri().default(''),
  RUST_ANALYTICS_URL: Joi.string().uri().default('http://rust-analytics:8000'),
  RUST_ANALYTICS_API_KEY: Joi.string().optional(),
  RUST_HTTP_TIMEOUT_MS: Joi.number().min(1000).default(5000),
  RUST_HTTP_RETRIES: Joi.number().min(0).max(10).default(2),
  RUST_GRPC_TIMEOUT_MS: Joi.number().min(1000).default(5000),
  RUST_GRPC_RETRIES: Joi.number().min(0).max(10).default(2),
  ANALYTICS_TIMEOUT: Joi.number().min(1000).default(5000),
  ANALYTICS_RETRIES: Joi.number().min(0).max(10).default(3),

  // Security
  BCRYPT_ROUNDS: Joi.number().min(8).max(15).default(12),
  SESSION_SECRET: Joi.string().min(32).optional(),
  CSRF_SECRET: Joi.string().min(32).optional(),
  ENCRYPTION_KEY: Joi.string().length(32).optional(),

  // Logging
  LOG_LEVEL: Joi.string()
    .valid('error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly')
    .default('info'),
  LOG_FORMAT: Joi.string()
    .valid('combined', 'common', 'dev', 'short', 'tiny')
    .default('combined'),
  LOG_FILE: Joi.string().default('./logs/app.log'),
  LOG_MAX_SIZE: Joi.string().default('20m'),
  LOG_MAX_FILES: Joi.number().min(1).default(5),

  // Health Check
  HEALTH_CHECK_TIMEOUT: Joi.number().min(1000).default(5000),
  HEALTH_CHECK_RETRIES: Joi.number().min(0).max(10).default(3),

  // Feature Flags
  ENABLE_ANALYTICS: Joi.boolean().default(true),
  ENABLE_NOTIFICATIONS: Joi.boolean().default(true),
  ENABLE_FILE_UPLOAD: Joi.boolean().default(true),
  ENABLE_EMAIL_VERIFICATION: Joi.boolean().default(true),
  ENABLE_TWO_FACTOR_AUTH: Joi.boolean().default(false),

  // Swagger
  SWAGGER_TITLE: Joi.string().default('MedTrack Hub API'),
  SWAGGER_DESCRIPTION: Joi.string().default(
    'API documentation for MedTrack Hub',
  ),
  SWAGGER_VERSION: Joi.string().default('1.0.0'),
  SWAGGER_PATH: Joi.string().default('docs'),
  SWAGGER_ENABLED: Joi.boolean().default(true),
});

/**
 * Validates environment variables and provides helpful error messages
 */
export function validateConfig(config: Record<string, unknown>) {
  const { error, value } = validationSchema.validate(config, {
    allowUnknown: true,
    abortEarly: false,
  });

  if (error) {
    const errorMessages = error.details.map((detail: any) => {
      const key = detail.path.join('.');
      const message = detail.message;
      return `${key}: ${message}`;
    });

    throw new Error(
      `Configuration validation failed:\n${errorMessages.join('\n')}\n\n` +
        'Please check your environment variables and ensure all required values are set.',
    );
  }

  if (!value.DATABASE_URL) {
    const hasPgConfig = Boolean(
      value.POSTGRES_HOST && value.POSTGRES_USER && value.POSTGRES_DB,
    );
    if (!hasPgConfig) {
      throw new Error(
        'Database configuration is incomplete. Provide DATABASE_URL or POSTGRES_HOST/POSTGRES_USER/POSTGRES_DB.',
      );
    }
  }

  return value;
}
