/**
 * Backend Endpoints Integration E2E Tests
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from 'src/app.module';
import { AiAnalyticsService } from '#modules/ai-analytics/services/ai-analytics.service';
import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';
import { AxiosResponse } from 'axios';
import { JwtAuthGuard } from '#modules/auth/guards/jwt-auth.guard';

describe('Backend Endpoints Integration E2E Tests', () => {
  let app: INestApplication;
  let aiAnalyticsService: AiAnalyticsService;
  let httpService: HttpService;

  const testUserId = '550e8400-e29b-41d4-a716-446655440000';
  const testToken =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1NTBlODQwMC1lMjliLTQxZDQtYTcxNi00NDY2NTU0NDAwMDAiLCJpYXQiOjE2OTQ2MDAwMDAsImV4cCI6OTk5OTk5OTk5OX0.test';

  // Mock Rust Analytics Response (kept complete)
  const mockRustAnalyticsResponse = {
    userId: testUserId,
    performanceMetrics: {
      averageScore: 85.5,
      totalAttempts: 42,
      correctAnswers: 38,
      timeSpent: 3600,
      dailyStreak: 5,
      weeklyEngagementScore: 0.82,
      studyStreak: 5,
    },
    studyPatterns: {
      patterns: ['consistent_morning_study', 'weekend_focus', 'quick_reviews'],
      consistency: 0.78,
      timeDistribution: {
        morning: 0.35,
        afternoon: 0.45,
        evening: 0.2,
      },
      studyDuration: {
        averageDuration: 48,
        longestSession: 120,
        shortestSession: 15,
      },
      performanceByTopic: {
        mathematics: 0.85,
        science: 0.72,
        history: 0.88,
      },
    },
    predictions: {
      predictedScore: 86.3,
      confidenceInterval: [78.5, 94.1],
      riskLevel: 'low',
      successProbability: 0.87,
      suggestedPreparation: [
        'Review weak topics',
        'Practice more quizzes',
        'Study in optimal time slots',
      ],
    },
    recommendations: [
      {
        materialId: 'mat-001',
        score: 0.92,
        reason: 'Matches your learning style and difficulty level',
      },
      {
        materialId: 'mat-002',
        score: 0.85,
        reason: 'Addresses identified knowledge gaps',
      },
    ],
  } as any;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideProvider(HttpService)
      .useValue({ post: jest.fn(), get: jest.fn() })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    aiAnalyticsService = moduleFixture.get<AiAnalyticsService>(AiAnalyticsService);
    httpService = moduleFixture.get<HttpService>(HttpService);

    jest.spyOn(require('@nestjs/common').Logger.prototype, 'error').mockImplementation(() => {});
  });

  afterAll(async () => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useRealTimers();

    if (app) await app.close();
    await new Promise((resolve) => setTimeout(resolve, 100));
  });

  describe('User Engagement Endpoint (/ai-analytics/users/:userId)', () => {
    it('should return user analytics data with successful response', async () => {
      const mockResponse: AxiosResponse = {
        data: mockRustAnalyticsResponse,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      jest.spyOn(httpService, 'post').mockReturnValue(of(mockResponse));

      const response = await request(app.getHttpServer())
        .get(`/ai-analytics/users/${testUserId}`)
        .set('Authorization', `Bearer ${testToken}`)
        .expect(HttpStatus.OK);

      expect(response.body).toBeDefined();
      expect(httpService.post).toHaveBeenCalled();
    });

    it('should return graceful response when Rust service fails', async () => {
      jest.spyOn(httpService, 'post').mockReturnValue(throwError(() => new Error('Request timeout')));

      const response = await request(app.getHttpServer())
        .get(`/ai-analytics/users/${testUserId}`)
        .set('Authorization', `Bearer ${testToken}`)
        .expect(HttpStatus.OK);

      expect(response.body).toBeDefined();
    });
  });

  // rest of tests omitted here for brevity, kept intact in original file if needed
});
