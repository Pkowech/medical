/**
 * Real end-to-end tests (Backend -> Rust)
 */

process.env.ENABLE_REDIS = process.env.ENABLE_REDIS || 'true';
process.env.RUST_ANALYTICS_URL = process.env.RUST_ANALYTICS_URL || 'http://127.0.0.1:8000';

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from 'src/app.module';
import { PrismaService } from '#infrastructure/prisma/prisma.service';
import { HttpService } from '@nestjs/axios';
import { JwtAuthGuard } from '#modules/auth/guards/jwt-auth.guard';

const TEST_USER_ID = process.env.TEST_USER_ID || '550e8400-e29b-41d4-a716-446655440000';

describe('Real E2E: Backend -> Rust', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let httpService: HttpService;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) {
      console.warn('DATABASE_URL is not set. Skipping real E2E tests.');
      return;
    }

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = moduleFixture.get<PrismaService>(PrismaService);
    httpService = moduleFixture.get<HttpService>(HttpService);

    await prisma.user.upsert({
      where: { id: TEST_USER_ID },
      update: { updatedAt: new Date() },
      create: {
        id: TEST_USER_ID,
        email: 'real-e2e@example.com',
        firstName: 'Real',
        lastName: 'E2E User',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    await prisma.studyEvent.createMany({
      data: [
        {
          userId: TEST_USER_ID,
          eventType: 'study_session',
          createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
          metadata: { duration: 30 },
        },
        {
          userId: TEST_USER_ID,
          eventType: 'study_session',
          createdAt: new Date().toISOString(),
          metadata: { duration: 45 },
        },
      ],
      skipDuplicates: true,
    });
  }, 60000);

  afterAll(async () => {
    if (!process.env.DATABASE_URL) return;

    await prisma.studyEvent.deleteMany({ where: { userId: TEST_USER_ID } });
    await prisma.learningSuggestion.deleteMany({ where: { userId: TEST_USER_ID } });
    await prisma.user.deleteMany({ where: { id: TEST_USER_ID } });

    if (app) await app.close();
  });

  it('GET /ai-analytics/users/:userId should call Rust and return analytics', async () => {
    if (!process.env.DATABASE_URL) return;

    const res = await request(app.getHttpServer())
      .get(`/ai-analytics/users/${TEST_USER_ID}`)
      .expect(HttpStatus.OK);

    expect(res.body).toBeDefined();
    expect(typeof res.body).toBe('object');
  }, 30000);

  it('GET /ai-analytics/users/:userId/patterns should call Rust learning_patterns', async () => {
    if (!process.env.DATABASE_URL) return;

    const res = await request(app.getHttpServer())
      .get(`/ai-analytics/users/${TEST_USER_ID}/patterns`)
      .expect(HttpStatus.OK);

    expect(res.body).toBeDefined();
    expect(typeof res.body).toBe('object');
  }, 20000);

  it('GET /ai-analytics/recommendations/:userId should call Rust recommendations', async () => {
    if (!process.env.DATABASE_URL) return;

    const res = await request(app.getHttpServer())
      .get(`/ai-analytics/recommendations/${TEST_USER_ID}`)
      .expect(HttpStatus.OK);

    expect(res.body).toBeDefined();
    expect(Array.isArray(res.body)).toBe(true);
  }, 30000);
});
