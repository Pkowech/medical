from ts_runtime import run_typescript


def test_goal_recommendations_exclude_completed_and_ineligible_paths():
    run_typescript(
        r"""
const assert = require('node:assert/strict');
const { LearningGoalsService } =
  require('./src/modules/education/courses/services/learning-goals.service.ts');

const paths = [
  { id: 'eligible-path', status: 'published', targetCareerStages: ['student'] },
  { id: 'ineligible-path', status: 'published', targetCareerStages: ['professional'] },
  { id: 'completed-path', status: 'published', targetCareerStages: ['student'] },
];
const service = new LearningGoalsService(
  {
    user: { findUnique: async () => ({ careerStage: 'student' }) },
    learningPath: { findMany: async () => paths },
    learningPathProgress: {
      findMany: async () => [{ learningPathId: 'completed-path' }],
    },
    examMapping: { findMany: async () => [] },
  },
  {},
  {
    generateStudyRecommendations: async () => [],
    getCollaborativeRecommendations: async () => [
      { item_id: 'eligible-path', score: 0.9, reason: 'Relevant' },
      { item_id: 'ineligible-path', score: 0.8, reason: 'Wrong stage' },
      { item_id: 'completed-path', score: 0.7, reason: 'Already done' },
      { item_id: 'topic-1', score: 0.6, reason: 'Topic relevance' },
    ],
    getTrendingPaths: async () => [
      { path_id: 'ineligible-path', enrollments: 20 },
      { path_id: 'eligible-path', enrollments: 10 },
      { path_id: 'completed-path', enrollments: 5 },
    ],
  },
  {},
);

(async () => {
  const { recommendations } = await service.getRecommendedGoals('user-1');
  const relatedIds = recommendations.map(recommendation => recommendation.relatedId);
  assert.deepEqual(relatedIds, ['eligible-path', 'topic-1', 'eligible-path']);
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
"""
    )
