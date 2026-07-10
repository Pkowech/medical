/**
 * DB-seed Integration Tests for AI Analytics
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from 'src/app.module';
import { PrismaService } from '#infrastructure/prisma/prisma.service';
import { HttpService } from '@nestjs/axios';
import { of } from 'rxjs';
import { AxiosResponse } from 'axios';

describe('AI Analytics DB-seed Integration', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let httpService: HttpService;

  const testUserId = '550e8400-e29b-41d4-a716-446655440000';

  const mockRustResponse = {
    userId: testUserId,
    performanceMetrics: { overallScore: 90 },
  };

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) {
      console.warn('DATABASE_URL not set - skipping DB integration tests');
      return;
    }

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = moduleFixture.get<PrismaService>(PrismaService);
    httpService = moduleFixture.get<HttpService>(HttpService);

    await prisma.user.upsert({
      where: { id: testUserId },
      update: {},
      create: {
        id: testUserId,
        email: 'dbseed-test@example.com',
        firstName: 'DB',
        lastName: 'Seed Test',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    await prisma.studyEvent.createMany({
      data: [
        {
          userId: testUserId,
          eventType: 'study_session',
          createdAt: new Date(Date.now() - 86400000).toISOString(),
          metadata: { duration: 60 },
        },
        {
          userId: testUserId,
          eventType: 'study_session',
          createdAt: new Date().toISOString(),
          metadata: { duration: 45 },
        },
      ],
    });
  });

  afterAll(async () => {
    if (!process.env.DATABASE_URL) return;

    await prisma.learningSuggestion.deleteMany({ where: { userId: testUserId } });
    await prisma.studyEvent.deleteMany({ where: { userId: testUserId } });
    await prisma.user.deleteMany({ where: { id: testUserId } });

    if (app) await app.close();
  });

  it('should call Rust performance endpoint with correct userIds payload', async () => {
    if (!process.env.DATABASE_URL) return;

    const postSpy = jest.spyOn(httpService, 'post').mockReturnValue(
      of({
        data: mockRustResponse,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      } as AxiosResponse),
    );

    const res = await request(app.getHttpServer())
      .get(`/ai-analytics/users/${testUserId}`)
      .set('Authorization', `Bearer placeholder-token`)
      .expect(HttpStatus.OK);

    expect(res.body).toBeDefined();

    expect(postSpy).toHaveBeenCalled();
    const calls = postSpy.mock.calls;
    const perfCall = calls.find((c: any[]) =>
      String(c[0]).includes('/performance/metrics'),
    );
    expect(perfCall).toBeDefined();
    const bodyArg = perfCall[1] as any;
    expect(bodyArg).toBeDefined();
    expect(Array.isArray(bodyArg.userIds)).toBeTruthy();
    expect(bodyArg.userIds).toContain(testUserId);

    postSpy.mockRestore();
  });

  it('should call Rust study patterns endpoint with userId', async () => {
    if (!process.env.DATABASE_URL) return;

    const postSpy = jest.spyOn(httpService, 'post').mockReturnValue(
      of({ data: { userId: testUserId, patterns: [] } } as AxiosResponse),
    );

    await request(app.getHttpServer())
      .get(`/ai-analytics/users/${testUserId}/patterns`)
      .set('Authorization', `Bearer placeholder-token`)
      .expect(HttpStatus.OK);

    expect(postSpy).toHaveBeenCalled();
    const call = postSpy.mock.calls[0];
    expect(call[0]).toContain('/engagement/learning_patterns');
    expect(call[1]).toBeDefined();
    expect((call[1] as any).userId).toBe(testUserId);

    postSpy.mockRestore();
  });

  it('should enforce authentication when guard not mocked', async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    const unsecuredApp = moduleFixture.createNestApplication();
    await unsecuredApp.init();

    await request(unsecuredApp.getHttpServer())
      .get(`/ai-analytics/users/${testUserId}`)
      .expect(HttpStatus.UNAUTHORIZED);

    await unsecuredApp.close();
  });
});
