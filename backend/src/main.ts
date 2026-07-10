import { NestFactory, Reflector } from '@nestjs/core';
import {
  ValidationPipe,
  ClassSerializerInterceptor,
  Logger,
  BadRequestException,
  INestApplication,
} from '@nestjs/common';

import { Logger as PinoLogger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { setupSwagger } from '#infrastructure/swagger/swagger.setup';
import { TransformInterceptor } from '#common/interceptors/transform.interceptor';
import { AllExceptionsFilter } from '#common/filters/all-exceptions.filter';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';

// Quick startup diagnostics to help debug environment/connection issues when
// running the backend on the host (outside docker). These logs are safe to
// leave in development and help surface mismatched envs (for example when
// Redis is mapped to a non-standard host port by docker-compose).
if (process.env.NODE_ENV !== 'production') {
  // Print only a few important env vars to avoid leaking secrets in logs.
  // Use Nest's Logger so output can be controlled by log levels and
  // respects centralized logging configuration.
  Logger.debug(
    `[startup] ENV SNAPSHOT: ${JSON.stringify({
      NODE_ENV: process.env.NODE_ENV,
      ENABLE_REDIS: process.env.ENABLE_REDIS,
      REDIS_HOST: process.env.REDIS_HOST,
      REDIS_PORT: process.env.REDIS_PORT,
      REDIS_URL: process.env.REDIS_URL ? '[REDACTED]' : undefined,
      POSTGRES_HOST: process.env.POSTGRES_HOST,
      POSTGRES_PORT: process.env.POSTGRES_PORT,
      PORT: process.env.PORT,
    })}`,
  );
}

async function logRoutes(app: INestApplication) {
  // Defer slightly to allow Nest/Express to finish wiring the router
  await new Promise((resolve) => setTimeout(resolve, 100));

  try {
    // Prefer using the HTTP adapter which is more stable than internal
    // Express event internals. adapter.getInstance() returns the Express
    // app/instance which exposes the router.

    const instance: any = app.getHttpAdapter().getInstance();
    const router =
      instance && (instance._router || instance.router || instance);

    if (!router || !router.stack) {
      Logger.debug('Router not available yet, skipping route logging');
      return;
    }

    Logger.debug('=======================================================');
    Logger.debug('🚦 Registered Routes:');
    router.stack.forEach((layer: any) => {
      // Some layers are not routes (middleware). Route objects contain `route`.
      if (layer.route) {
        const path = layer.route.path || layer.route?.stack?.[0]?.route || '/';
        // Methods are stored as keys on layer.route.methods
        const methods = layer.route.methods
          ? Object.keys(layer.route.methods).filter(
              (m) => layer.route.methods[m],
            )
          : [];
        const methodStr =
          methods.length > 0 ? methods.join(',').toUpperCase() : 'ALL';
        Logger.debug(`   - ${methodStr} ${path}`);
      }
    });
    Logger.debug('=======================================================');
  } catch (err) {
    // Non-fatal: route logging is helpful in dev but shouldn't break startup
    Logger.debug(
      'Failed to enumerate routes for logging',
      err && (err as Error).stack ? (err as Error).stack : String(err),
    );
  }
}

async function bootstrap() {
  Logger.log('Starting bootstrap...');
  const app = await NestFactory.create(AppModule, {
    bufferLogs: process.env.NODE_ENV === 'development',
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  Logger.log('App module created successfully');

  try {
    app.useLogger(app.get(PinoLogger));
  } catch {
    Logger.warn('Pino logger not available, using default logger');
  }

  // Database connection handled by Prisma
  Logger.log('🔄 Database connection established via Prisma');

  // Set global prefix with path-to-regexp compatible format
  // This prevents deprecation warnings about legacy route syntax
  app.setGlobalPrefix('v1', {
    exclude: ['/health', '/metrics', '/api/docs', '/api/docs-json'],
  });

  // Enhanced Validation pipe with better error handling
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      skipMissingProperties: false, // IMPORTANT: Don't skip missing properties
      transformOptions: {
        enableImplicitConversion: true,
      },
      stopAtFirstError: false, // Show all validation errors
      enableDebugMessages: process.env.NODE_ENV !== 'production',
      validationError: {
        target: false,
        value: process.env.NODE_ENV !== 'production',
      },
      // CRITICAL: Custom exception factory to ensure 400 status
      exceptionFactory: (errors) => {
        const messages = errors.map((error) => {
          const constraints = error.constraints || {};
          const constraintMessages = Object.values(constraints);
          return {
            field: error.property,
            value:
              process.env.NODE_ENV !== 'production' ? error.value : undefined,
            errors: constraintMessages,
          };
        });

        // Determine a more specific message if possible, otherwise use a generic one
        const topLevelMessage =
          errors.length > 0 && errors[0].constraints
            ? Object.values(errors[0].constraints)[0]
            : 'Validation failed';

        return new BadRequestException({
          statusCode: 400,
          message: topLevelMessage, // Use a more specific message
          errors: messages,
        });
      },
    }),
  );

  // Global interceptors
  app.useGlobalInterceptors(
    new TransformInterceptor(),
    new ClassSerializerInterceptor(app.get(Reflector), {
      enableImplicitConversion: true,
      strategy: 'exposeAll',
      exposeDefaultValues: true,
      exposeUnsetFields: false,
      excludeExtraneousValues: false,
    }),
  );

  // Global filters
  app.useGlobalFilters(new AllExceptionsFilter());

  // Swagger setup (fail-safe). Swagger can fail during schema generation
  // if there are circular references in DTOs. Wrap it in try/catch so a
  // problematic model won't prevent the app from starting. If Swagger
  // still fails we'll log the error and continue without the docs.
  try {
    setupSwagger(app);
  } catch (err) {
    Logger.warn('Swagger setup failed, continuing without API docs');
    Logger.debug(
      err && (err as Error).stack ? (err as Error).stack : String(err),
    );
  }

  // CORS configuration - more permissive for Docker development
  Logger.log('Setting up CORS configuration...');
  const configService = app.get(ConfigService);
  const allowedOrigins = configService
    .get<string>('ALLOWED_ORIGINS', 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim());

  Logger.log('Enabling CORS...');
  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      // Allow requests with no origin (mobile apps, curl, postman, etc.)
      if (!origin) {
        return callback(null, true);
      }

      // Check if origin is in allowed list or is localhost/127.0.0.1 for dev
      const isAllowed = allowedOrigins.some((allowedOrigin) => {
        if (allowedOrigin === origin) {
          return true;
        }
        if (process.env.NODE_ENV === 'development') {
          return origin.includes('localhost') || origin.includes('127.0.0.1');
        }
        return false;
      });

      if (!isAllowed) {
        return callback(
          new Error('CORS: This origin is not allowed to access the API'),
          false,
        );
      }
      return callback(null, true);
    },
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'Origin',
      'X-Requested-With',
      'X-Client-Timestamp',
    ],
    exposedHeaders: [
      'X-RateLimit-Limit',
      'X-RateLimit-Remaining',
      'X-RateLimit-Reset',
    ],
    credentials: true,
    maxAge: 3600,
  });

  // Security headers - adjusted for development
  Logger.log('Setting up security headers...');
  if (process.env.NODE_ENV === 'production') {
    app.use(
      helmet({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", 'https:'],
            scriptSrc: [
              "'self'",
              "'unsafe-inline'",
              "'unsafe-eval'",
              'https:',
              'blob:',
            ],
            imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
            connectSrc: ["'self'", 'https:', 'wss:', 'http:', 'ws:'],
            fontSrc: ["'self'", 'https:', 'data:'],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'", 'https:'],
            frameSrc: ["'self'", 'https:'],
            formAction: ["'self'"],
            workerSrc: ["'self'", 'blob:', 'https:'],
            baseUri: ["'self'"],
            manifestSrc: ["'self'", 'https:'],
          },
        },
        crossOriginEmbedderPolicy: true,
        crossOriginOpenerPolicy: true,
        crossOriginResourcePolicy: { policy: 'same-site' },
        dnsPrefetchControl: true,
        frameguard: { action: 'deny' },
        hidePoweredBy: true,
        hsts: {
          maxAge: 31536000,
          includeSubDomains: true,
          preload: true,
        },
        ieNoOpen: true,
        noSniff: true,
        referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      }),
    );
  } else {
    // Basic security for development
    app.use(
      helmet({
        contentSecurityPolicy: false,
        crossOriginEmbedderPolicy: false,
      }),
    );
  }

  // Rate limiting - more lenient for development
  Logger.log('Setting up rate limiting...');
  const isProduction = process.env.NODE_ENV === 'production';

  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: isProduction ? 5 : 50, // More attempts in dev
    message: 'Too many login attempts, please try again after 15 minutes',
    standardHeaders: true,
    legacyHeaders: false,
  });

  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: isProduction ? 500 : 5000, // Increased for xAPI/progress tracking
    message:
      'Too many requests from this IP, please try again after 15 minutes',
    standardHeaders: true,
    legacyHeaders: false,
  });

  app.use('/auth/login', loginLimiter);
  app.use('/auth/register', loginLimiter);
  app.use(apiLimiter);

  Logger.log('Getting port configuration...');
  const port = configService.get('PORT', 3002);
  const hostname = configService.get('HOSTNAME', '0.0.0.0');

  Logger.log('Logging routes...');
  if (process.env.NODE_ENV === 'development') {
    await logRoutes(app);
  }

  Logger.log('Attempting to start server...');
  try {
    await app.listen(port, hostname);
    Logger.log('Server listening successfully!');
  } catch (err) {
    Logger.error(
      'Failed to start server:',
      err instanceof Error ? err.message : String(err),
    );
    if (err instanceof Error && err.stack) {
      Logger.error('Stack trace:', err.stack);
    }
    throw err;
  }

  Logger.log('Getting database configuration...');
  const environment = configService.get('NODE_ENV', 'development');
  const dbHost = configService.get('POSTGRES_HOST', 'postgres');
  const redisHost = configService.get('REDIS_HOST', 'redis');

  // Display correct URL based on environment
  const displayHostname =
    hostname === '0.0.0.0'
      ? process.env.NODE_ENV === 'development'
        ? 'localhost'
        : 'your-server-ip'
      : hostname;

  const serverUrl = `http://${displayHostname}:${port}`;
  const apiUrl = `${serverUrl}/v1`;

  Logger.log(`=======================================================`);
  Logger.log(`🚀 MedTrack Hub Backend Server Started Successfully!`);
  Logger.log(`=======================================================`);
  Logger.log(`🌍 Environment: ${environment.toUpperCase()}`);
  Logger.log(`🔗 API URL: http://${hostname}:${port}/v1`);
  Logger.log(`📡 Listening on: ${hostname}:${port}`);
  Logger.log(
    `🗄️  Database: ${dbHost}:${configService.get('POSTGRES_PORT', 5432)}`,
  );
  Logger.log(`🔴 Redis: ${redisHost}:${configService.get('REDIS_PORT', 6379)}`);
  Logger.log(`=======================================================`);
  Logger.log(`📝 API Documentation: ${serverUrl}/api/docs`);
  Logger.log(`❤️  Health Check: ${apiUrl}/health`);
  Logger.log(`🔐 Authentication Endpoints:`);
  Logger.log(`   - POST ${apiUrl}/auth/register`);
  Logger.log(`   - POST ${apiUrl}/auth/login`);
  Logger.log(`   - GET ${apiUrl}/auth/profile`);
  Logger.log(`   - POST ${apiUrl}/auth/refresh`);
  Logger.log(
    `📊 Analytics Service: ${configService.get(
      'ANALYTICS_SERVICE_URL',
      'http://localhost:8080',
    )}`,
  );
  Logger.log(`=======================================================`);

  // Display password requirements if configured
  const passwordConfig = configService.get('app.security.password');
  if (passwordConfig) {
    Logger.log(`🔒 Password Requirements (${environment}):`);
    Logger.log(
      `   - Minimum length: ${
        passwordConfig.minLength || (environment === 'development' ? 4 : 8)
      } characters`,
    );
    Logger.log(`   - Uppercase required: ${passwordConfig.requireUppercase}`);
    Logger.log(`   - Numbers required: ${passwordConfig.requireNumbers}`);
    Logger.log(
      `   - Special chars required: ${passwordConfig.requireSpecialChars}`,
    );
    Logger.log(`=======================================================`);
  }

  Logger.log('Bootstrap function completed successfully!');
}

bootstrap().catch((error) => {
  Logger.error(
    '💥 Application failed to start:',
    error instanceof Error ? error.message : String(error),
  );
  if (error instanceof Error && error.stack) {
    Logger.error('Full error:', error.stack);
  }
  process.exit(1);
});

Logger.log('Bootstrap promise initiated');
