import { PrismaService } from '#infrastructure/prisma/prisma.service';
import { RedisService } from '#infrastructure/redis/redis.service';
import { AiAnalyticsService } from './ai-analytics.service';
import { LearningPathRecommendationsService } from './learning-path-recommendations.service';

describe('LearningPathRecommendationsService', () => {
  it('uses the user healthcare field to match learning-path categories', async () => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          specialization: null,
          healthcareField: 'nursing',
        }),
      },
      courseCategory: {
        findMany: jest.fn().mockResolvedValue([{ id: 'nursing-category' }]),
      },
      learningPath: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'nursing-path',
            categoryId: 'nursing-category',
            specialization: null,
            estimatedDurationWeeks: 4,
          },
        ]),
      },
    };
    const aiAnalyticsService = {
      getRecommendationsAI: jest.fn().mockResolvedValue([]),
    };
    const redisService = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
    };
    const service = new LearningPathRecommendationsService(
      prisma as unknown as PrismaService,
      aiAnalyticsService as unknown as AiAnalyticsService,
      redisService as unknown as RedisService,
    );

    const recommendations = await service.getRecommendations('user-1');

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      select: { specialization: true, healthcareField: true },
    });
    expect(recommendations[0]).toMatchObject({
      pathId: 'nursing-path',
      score: 0.85,
      reasons: ['Matches your healthcare field: nursing'],
      confidence: 0.9,
    });
  });
});
