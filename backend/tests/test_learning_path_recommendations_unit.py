from ts_runtime import run_typescript


def test_learning_path_recommendations_match_healthcare_field():
    run_typescript(
        r"""
const assert = require('node:assert/strict');
const { LearningPathRecommendationsService } =
  require('./src/modules/ai-analytics/services/learning-path-recommendations.service.ts');
const prisma = {
  user: {
    findUnique: async () => ({ specialization: null, healthcareField: 'nursing' }),
  },
  courseCategory: { findMany: async () => [{ id: 'nursing-category' }] },
  learningPath: {
    findMany: async () => [{
      id: 'nursing-path',
      categoryId: 'nursing-category',
      specialization: null,
      estimatedDurationWeeks: 4,
    }],
  },
};
const service = new LearningPathRecommendationsService(
  prisma,
  { getRecommendationsAI: async () => [] },
  { get: async () => null, set: async () => undefined },
);

(async () => {
  const recommendations = await service.getRecommendations('user-1');
  assert.deepEqual(recommendations[0], {
    pathId: 'nursing-path',
    score: 0.85,
    reasons: ['Matches your healthcare field: nursing'],
    confidence: 0.9,
    estimatedCompletionTime: 4,
  });
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
"""
    )
