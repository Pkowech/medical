// src/app.module.ts
import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import redisConfig from './config/redis.config';
import { LoggerModule } from 'nestjs-pino';
import { validationSchema } from './config/validation';
import { randomUUID } from 'crypto';
import { CacheModule } from '@nestjs/cache-manager';
import * as redisStore from 'cache-manager-redis-store';
import { ScheduleModule } from '@nestjs/schedule';

// Infrastructure Imports
import { RedisModule } from './infrastructure/redis/redis.module';
import { PrismaModule } from './infrastructure/prisma/prisma.module';
import { HealthModule } from './infrastructure/health/health.module';
import { MetricsModule } from './infrastructure/metrics/metrics.module';
import { MonitoringModule } from './infrastructure/monitoring/monitoring.module';
// gRPC module provides the analytics client provider (ts-proto generated, no runtime .proto required)
import { GrpcModule } from '#infrastructure/grpc/grpc.module';

// Core Module Imports
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './modules/auth/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { RolesModule } from './modules/auth/roles.module';
import { AdminModule } from './modules/admin/admin.module';

// Learning & Education Modules
import { AssessmentModule } from '#modules/education/assessment/assessment.module';
import { CoursesModule } from '#modules/education/courses/modules/courses.module';
import { ClinicalCasesModule } from '#modules/education/courses/modules/clinical-cases.module';
import { CourseCategoriesModule } from '#modules/education/courses/modules/course-categories.module';
import { MaterialsModule } from '#modules/education/courses/modules/materials.module';
import { UnitsModule } from '#modules/education/courses/modules/units.module';
import { EventsModule } from '#modules/education/events/events.module';

// AI & Analytics Modules
import { AiAnalyticsModule } from '#modules/ai-analytics/ai-analytics.module';
import { AnalyticsQueueModule } from '#modules/queue/analytics-queue.module';

// User Engagement & Communication
import { EngagementCommunicationModule } from '#modules/engagement-communication/engagement-communication.module';

// Integration & Infrastructure
import { IntegrationsModule } from '#infrastructure/integrations/integrations.module';
import { SearchModule } from '#infrastructure/search/search.module';
import { EventEmitterModule } from '@nestjs/event-emitter';

const shouldEnableRedis =
  process.env.ENABLE_REDIS === 'true' || Boolean(process.env.REDIS_URL);

const redisModules = shouldEnableRedis
  ? [
      RedisModule,
      CacheModule.registerAsync({
        imports: [ConfigModule],
        // The redisStore factory requires a config argument. Make the factory
        // async and invoke redisStore(...) with the resolved config so the
        // returned store instance is provided to Nest's cache manager.
        useFactory: async (configService: ConfigService) => {
          const host = configService.get<string>('redis.host');
          const port = configService.get<number>('redis.port');
          const password = configService.get<string>('redis.password');
          const db = configService.get<number>('redis.db');

          const store = await (redisStore as any)({
            host,
            port,
            password,
            db,
          });

          return {
            store,
            ttl: 3600, // 1 hour
          };
        },
        inject: [ConfigService],
        isGlobal: true, // Make cache module global
      }),
    ]
  : [];

@Module({
  imports: [
    // System Configuration
    ThrottlerModule.forRoot([
      { ttl: 60, limit: 1000 },
      { name: 'auth', ttl: 900, limit: 5 },
    ]),
    ScheduleModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../.env'],
      load: [redisConfig],
      validationSchema: validationSchema,
    }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRES_IN', '1d') as any,
        },
      }),
      inject: [ConfigService],
      global: true,
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        genReqId: (req, res) => {
          const existingID = req.id ?? req.headers['x-request-id'];
          if (existingID) {
            return existingID;
          }
          const id = randomUUID();
          res.setHeader('X-Request-Id', id);
          return id;
        },
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty' }
            : undefined,
        level: process.env.NODE_ENV !== 'production' ? 'debug' : 'info',
        customProps: () => ({
          context: 'HTTP',
        }),
        redact: {
          paths: [
            'req.headers.authorization',
            'req.headers.cookie',
            'req.body.password',
            'req.body.token',
            'req.body.accessToken',
            'req.body.refreshToken',
          ],
          censor: '**REDACTED**',
        },
      },
    }),

    // Infrastructure (Global)
    PrismaModule,
    RedisModule,
    SearchModule,
    HealthModule,
    MetricsModule,
    MonitoringModule,
    GrpcModule,
    ...redisModules,

    // Core Modules
    UsersModule,
    AuthModule,
    RolesModule,

    // Learning & Education
    AssessmentModule,
    CoursesModule,
    ClinicalCasesModule,
    CourseCategoriesModule,
    MaterialsModule,
    UnitsModule,
    EventsModule,

    // AI & Analytics
    AiAnalyticsModule,

    // Modules requiring Redis - only enable when ENABLE_REDIS=true
    ...(shouldEnableRedis
      ? [AnalyticsQueueModule, EngagementCommunicationModule]
      : []),
    AdminModule,

    // Integration & Infrastructure
    IntegrationsModule,
    EventEmitterModule.forRoot(),
  ],
  controllers: [AppController],
  providers: [AppService, ConfigService],
})
export class AppModule {}
