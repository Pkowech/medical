from ts_runtime import run_typescript


def test_learning_path_recommendations_keep_rust_order_and_filter_unpublished():
    run_typescript(
        r"""
const assert = require('node:assert/strict');
const { LearningPathRecommendationsService } =
  require('./src/modules/ai-analytics/services/learning-path-recommendations.service.ts');

let requestedLimit;
let query;
const prisma = {
  user: {
    findUnique: async () => ({ careerStage: 'student' }),
  },
  learningPath: {
    findMany: async (args) => {
      query = args;
      return [
        { id: 'path-third', estimatedDurationWeeks: 8, targetCareerStages: ['student'] },
        { id: 'path-first', estimatedDurationWeeks: 4, targetCareerStages: ['student'] },
      ];
    },
  },
};
const learningAnalytics = {
  getPathRecommendations: async (_userId, limit) => {
    requestedLimit = limit;
    return [
      { pathId: 'path-first', score: 0.95, reasons: ['best fit'], confidence: 0.95 },
      { pathId: 'unpublished-path', score: 0.9, reasons: ['hidden'], confidence: 0.9 },
      { pathId: 'path-third', score: 0.7, reasons: ['third'], confidence: 0.7 },
    ];
  },
};
const service = new LearningPathRecommendationsService(
  prisma,
  learningAnalytics,
  {},
  {},
);

(async () => {
  const recommendations = await service.getRecommendations('user-1', 3);
  assert.equal(requestedLimit, 15);
  assert.deepEqual(query.where, {
    id: { in: ['path-first', 'unpublished-path', 'path-third'] },
    status: 'published',
    targetCareerStages: { has: 'student' },
  });
  assert.deepEqual(
    recommendations.map(({ pathId, score }) => ({ pathId, score })),
    [
      { pathId: 'path-first', score: 0.95 },
      { pathId: 'path-third', score: 0.7 },
    ],
  );
  assert.deepEqual(recommendations[0].reasons, ['best fit']);
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
"""
    )


def test_stage_filtering_fills_requested_limit_from_ranked_candidates():
    run_typescript(
        r"""
const assert = require('node:assert/strict');
const { LearningPathRecommendationsService } =
  require('./src/modules/ai-analytics/services/learning-path-recommendations.service.ts');

let requestedLimit;
let queriedIds;
const service = new LearningPathRecommendationsService(
  {
    user: { findUnique: async () => ({ careerStage: 'student' }) },
    learningPath: {
      findMany: async args => {
        queriedIds = args.where.id.in;
        return [
          { id: 'eligible-second', targetCareerStages: ['student'] },
          { id: 'eligible-first', targetCareerStages: ['student'] },
        ];
      },
    },
  },
  {
    getPathRecommendations: async (_userId, limit) => {
      requestedLimit = limit;
      return [
        { pathId: 'professional-only', score: 1, reasons: [], confidence: 1 },
        { pathId: 'eligible-first', score: 0.9, reasons: [], confidence: 0.9 },
        { pathId: 'other-stage', score: 0.8, reasons: [], confidence: 0.8 },
        { pathId: 'eligible-second', score: 0.7, reasons: [], confidence: 0.7 },
      ];
    },
  },
  {},
  {},
);

(async () => {
  const recommendations = await service.getRecommendations('user-1', 2);
  assert.equal(requestedLimit, 10);
  assert.deepEqual(queriedIds, [
    'professional-only',
    'eligible-first',
    'other-stage',
    'eligible-second',
  ]);
  assert.deepEqual(
    recommendations.map(recommendation => recommendation.pathId),
    ['eligible-first', 'eligible-second'],
  );
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
"""
    )


def test_trending_paths_filter_by_user_stage_and_preserve_rust_order():
    run_typescript(
        r"""
const assert = require('node:assert/strict');
const { LearningPathRecommendationsService } =
  require('./src/modules/ai-analytics/services/learning-path-recommendations.service.ts');

const service = new LearningPathRecommendationsService(
  {
    user: { findUnique: async () => ({ careerStage: 'student' }) },
    learningPath: {
      findMany: async args => {
        assert.deepEqual(args.where.targetCareerStages, { has: 'student' });
        return [
          { id: 'second', targetCareerStages: ['student'] },
          { id: 'first', targetCareerStages: ['student'] },
        ];
      },
    },
  },
  {},
  { getTrendingPaths: async () => [
    { path_id: 'first' },
    { path_id: 'second' },
  ] },
  {},
);

(async () => {
  const paths = await service.getTrendingPaths(2, 'user-1');
  assert.deepEqual(paths.map(path => path.id), ['first', 'second']);
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
"""
    )


def test_learning_path_service_filters_trending_by_stored_career_stage():
    run_typescript(
        r"""
const assert = require('node:assert/strict');
const { LearningPathsService } =
  require('./src/modules/education/courses/services/learning-paths.service.ts');

const service = new LearningPathsService(
  {
    user: { findUnique: async () => ({ careerStage: 'student' }) },
    learningPath: {
      findMany: async args => {
        assert.deepEqual(args.where.targetCareerStages, { has: 'student' });
        return [
          { id: 'second', targetCareerStages: ['student'] },
          { id: 'first', targetCareerStages: ['student'] },
        ];
      },
    },
  },
  {},
  { getTrendingPaths: async () => [
    { path_id: 'first' },
    { path_id: 'second' },
  ] },
  {},
  {
    evaluate: (path, user) => ({
      eligible: path.targetCareerStages.includes(user.careerStage),
    }),
  },
);

(async () => {
  const paths = await service.getTrendingPaths(2, 'user-1');
  assert.deepEqual(paths.map(path => path.id), ['first', 'second']);
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
"""
    )


def test_unified_recommendation_request_is_contextual_and_cached():
    run_typescript(
        r"""
const assert = require('node:assert/strict');
const { firstValueFrom, of } = require('rxjs');
const { LearningAnalyticsService } =
  require('./src/modules/ai-analytics/services/learning-analytics.service.ts');

const service = Object.create(LearningAnalyticsService.prototype);
let grpcCalls = 0;
let request;
let cachedValue;
service.redisService = {
  get: async () => cachedValue ?? null,
  set: async (_key, value) => { cachedValue = value; },
};
service.requestDeduplicationService = {
  executeWithDedup: async (_key, work) => work(),
};
service.performanceMetrics = { recordMetric: async () => undefined };
service.analyticsServiceGrpc = {
  getUnifiedRecommendations: (value) => {
    grpcCalls++;
    request = value;
    return of({
      items: [
        {
          id: 'material-1',
          title: 'Review cardiac physiology',
          description: '',
          type: 'study_material',
          score: 0.9,
          reason: 'Weak area',
          priority: 'high',
          estimatedDurationMinutes: 60,
          resourceId: 'material-1',
        },
        {
          id: 'material-2',
          title: 'Review ECG basics',
          description: '',
          type: 'study_material',
          score: 0.7,
          reason: 'Weak area',
          priority: 'medium',
          estimatedDurationMinutes: 30,
          resourceId: 'material-2',
        },
        {
          id: 'material-3',
          title: 'Extra recommendation',
          description: '',
          type: 'study_material',
          score: 0.5,
          reason: 'Weak area',
          priority: 'low',
          estimatedDurationMinutes: 15,
          resourceId: 'material-3',
        },
      ],
    });
  },
};
service.callGrpc = (observable) => firstValueFrom(observable);

(async () => {
  const first = await service.getUnifiedRecommendations('user-1', 'study_material', {
    limit: 2,
    knowledgeGaps: ['cardiology'],
    excludeIds: ['material-3'],
  });
  const second = await service.getUnifiedRecommendations('user-1', 'study_material', {
    limit: 2,
    knowledgeGaps: ['cardiology'],
    excludeIds: ['material-3'],
  });

  assert.deepEqual(request, {
    userId: 'user-1',
    context: 'study_material',
    limit: 2,
    knowledgeGaps: ['cardiology'],
    excludeIds: ['material-3'],
  });
  assert.equal(first.length, 2);
  assert.deepEqual(second, first);
  assert.equal(grpcCalls, 1);
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
"""
    )


def test_material_recommendations_persist_only_material_resource_ids():
    run_typescript(
        r"""
const assert = require('node:assert/strict');
const { AiAnalyticsService } =
  require('./src/modules/ai-analytics/services/ai-analytics.service.ts');

const service = Object.create(AiAnalyticsService.prototype);
let requestContext;
let persistedSuggestions;
service.tracingService = {
  createTraceContext: () => ({}),
  startSpan: async () => ({}),
  addTag: () => undefined,
  endSpan: async () => undefined,
};
service.redisService = {
  get: async () => null,
  set: async () => undefined,
};
service.learningAnalyticsService = {
  getUnifiedRecommendations: async (_userId, context) => {
    requestContext = context;
    return [
      {
        id: 'material-1',
        resourceId: 'material-1',
        score: 0.9,
        reason: 'Weak topic',
      },
      {
        id: 'knowledge-gap-1',
        score: 0.6,
        reason: 'No matching resource',
      },
    ];
  },
};
service.requestDeduplicationService = {
  executeWithDedup: async (_key, work) => work(),
};
service.performanceMetrics = { recordMetric: async () => undefined };
service.prisma = {
  $transaction: async (work) =>
    work({
      learningSuggestion: {
        deleteMany: async () => undefined,
        createMany: async ({ data }) => { persistedSuggestions = data; },
      },
    }),
};
service.cacheTtl = 3600;

(async () => {
  const recommendations = await service.getRecommendationsAI('user-1', 10);

  assert.equal(requestContext, 'study_material');
  assert.deepEqual(recommendations, [
    { materialId: 'material-1', score: 0.9, reason: 'Weak topic' },
  ]);
  assert.deepEqual(persistedSuggestions, [
    {
      userId: 'user-1',
      materialId: 'material-1',
      score: 0.9,
      reason: 'Weak topic',
    },
  ]);
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
"""
    )
