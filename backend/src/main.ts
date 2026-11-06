import { json, urlencoded } from 'express';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { NestFactory, Reflector } from '@nestjs/core';
import {
  BadRequestException,
  ClassSerializerInterceptor,
  INestApplication,
  Logger,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Logger as PinoLogger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { API_PREFIX } from './config/api.config';
import { getPublicApiOrigin } from './config/public-api-url';
import { setupSwagger } from '#infrastructure/swagger/swagger.setup';
import { AllExceptionsFilter } from '#common/filters/all-exceptions.filter';
import { TransformInterceptor } from '#common/interceptors/transform.interceptor';

const BODY_LIMIT = '3mb';
const DEFAULT_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const bootstrapLogger = new Logger('Bootstrap');

function configureBodyParsing(app: INestApplication): void {
  app.use(json({ limit: BODY_LIMIT }));
  app.use(urlencoded({ extended: true, limit: BODY_LIMIT }));
}

function configureGlobalApi(app: INestApplication, environment: string): void {
  app.setGlobalPrefix(API_PREFIX, {
    exclude: ['/health', '/metrics', '/api/docs', '/api/docs-json'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      skipMissingProperties: false,
      transformOptions: { enableImplicitConversion: true },
      stopAtFirstError: false,
      enableDebugMessages: environment !== 'production',
      validationError: {
        target: false,
        value: false,
      },
      exceptionFactory: (errors) => {
        const details = errors.map((error) => ({
          field: error.property,
          errors: Object.values(error.constraints ?? {}),
        }));
        const message =
          errors[0]?.constraints && Object.values(errors[0].constraints)[0]
            ? Object.values(errors[0].constraints)[0]
            : 'Validation failed';

        return new BadRequestException({
          statusCode: 400,
          message,
          errors: details,
        });
      },
    }),
  );

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
  app.useGlobalFilters(new AllExceptionsFilter());
}

function configureCors(app: INestApplication, config: ConfigService): void {
  const allowedOrigins = (config.get<string>('ALLOWED_ORIGINS') ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  const isDevelopment = config.get<string>('NODE_ENV') === 'development';

  if (allowedOrigins.length === 0) {
    Logger.warn(
      'ALLOWED_ORIGINS is empty; browser requests are allowed only from local development origins.',
    );
  }

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (error: Error | null, allow?: boolean) => void,
    ) => {
      if (!origin) {
        callback(null, true);
        return;
      }

      const explicitlyAllowed = allowedOrigins.includes(origin);
      let isLocalDevelopmentOrigin = false;
      if (isDevelopment) {
        try {
          const hostname = new URL(origin).hostname;
          isLocalDevelopmentOrigin = [
            'localhost',
            '127.0.0.1',
            '[::1]',
          ].includes(hostname);
        } catch {
          isLocalDevelopmentOrigin = false;
        }
      }

      if (explicitlyAllowed || isLocalDevelopmentOrigin) {
        callback(null, true);
        return;
      }

      callback(new Error('CORS: origin is not allowed'), false);
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
}

function configureSecurity(app: INestApplication, isProduction: boolean): void {
  if (!isProduction) {
    app.use(
      helmet({
        contentSecurityPolicy: false,
        crossOriginEmbedderPolicy: false,
      }),
    );
    return;
  }

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
        maxAge: 31_536_000,
        includeSubDomains: true,
        preload: true,
      },
      ieNoOpen: true,
      noSniff: true,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    }),
  );
}

function configureRateLimiting(
  app: INestApplication,
  isProduction: boolean,
  config: ConfigService,
): void {
  app
    .getHttpAdapter()
    .getInstance()
    .set('trust proxy', config.get<string>('TRUST_PROXY'));

  const loginLimiter = rateLimit({
    windowMs: config.get<number>(
      'RATE_LIMIT_WINDOW_MS',
      DEFAULT_RATE_LIMIT_WINDOW_MS,
    ),
    max: isProduction ? 5 : 50,
    message: 'Too many login attempts, please try again after 15 minutes',
    standardHeaders: true,
    legacyHeaders: false,
  });
  const apiLimiter = rateLimit({
    windowMs: config.get<number>(
      'RATE_LIMIT_WINDOW_MS',
      DEFAULT_RATE_LIMIT_WINDOW_MS,
    ),
    max: config.get<number>('RATE_LIMIT_MAX', isProduction ? 500 : 5000),
    message:
      'Too many requests from this IP, please try again after 15 minutes',
    standardHeaders: true,
    legacyHeaders: false,
  });

  app.use(`/${API_PREFIX}/auth/login`, loginLimiter);
  app.use(`/${API_PREFIX}/auth/register`, loginLimiter);
  app.use(apiLimiter);
}

function logStartupSummary(
  config: ConfigService,
  environment: string,
  port: number,
  hostname: string,
): void {
  const publicBaseUrl = getPublicApiOrigin(config, environment, port);
  const endpoint = (path: string) =>
    publicBaseUrl ? `${publicBaseUrl}${path}` : path;
  const redisConfigured = Boolean(
    config.get<string>('REDIS_URL') ||
    config.get<boolean>('ENABLE_REDIS', false),
  );
  const analyticsConfigured = Boolean(
    config.get<string>('ANALYTICS_GRPC_URL') ||
    config.get<string>('RUST_ANALYTICS_GRPC_URL') ||
    config.get<string>('ANALYTICS_SERVICE_URL') ||
    config.get<string>('RUST_ANALYTICS_URL'),
  );

  bootstrapLogger.log('Backend started successfully');
  bootstrapLogger.log(`Environment: ${environment}`);
  bootstrapLogger.log(`Listening address: ${hostname}:${port}`);
  bootstrapLogger.log(`API: ${endpoint(`/${API_PREFIX}`)}`);
  bootstrapLogger.log(`Health check: ${endpoint('/health')}`);
  bootstrapLogger.log(`API documentation: ${endpoint('/api/docs')}`);
  bootstrapLogger.log(
    `Database: ${config.get<string>('DATABASE_URL') || config.get<string>('POSTGRES_HOST') ? 'configured' : 'not configured'}`,
  );
  bootstrapLogger.log(`Redis: ${redisConfigured ? 'configured' : 'disabled'}`);
  bootstrapLogger.log(
    `Analytics service: ${analyticsConfigured ? 'configured' : 'not configured'}`,
  );
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    bodyParser: false,
  });

  try {
    const logger = app.get(PinoLogger);
    const config = app.get(ConfigService);
    const environment = config.get<string>('NODE_ENV', 'development');
    const isProduction = environment === 'production';
    const port = config.get<number>('PORT', 3002);
    const hostname = config.get<string>('HOSTNAME', '0.0.0.0');

    app.useLogger(logger);
    app.enableShutdownHooks();

    configureBodyParsing(app);
    configureGlobalApi(app, environment);
    configureCors(app, config);
    configureSecurity(app, isProduction);
    configureRateLimiting(app, isProduction, config);
    setupSwagger(app);

    await app.listen(port, hostname);
    logStartupSummary(config, environment, port, hostname);
  } catch (error) {
    try {
      await app.close();
    } catch (closeError) {
      bootstrapLogger.error(
        `Failed to close application after startup failure: ${safeErrorMessage(closeError)}`,
      );
    }
    throw error;
  }
}

function safeErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/([a-z][a-z\d+.-]*:\/\/)[^/@\s]+@/gi, '$1[REDACTED]@');
}

bootstrap().catch((error: unknown) => {
  bootstrapLogger.error(
    `Application failed to start: ${safeErrorMessage(error)}`,
  );
  process.exitCode = 1;
});
