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
  learningPath: {
    findMany: async (args) => {
      query = args;
      return [
        { id: 'path-third', estimatedDurationWeeks: 8 },
        { id: 'path-first', estimatedDurationWeeks: 4 },
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
  assert.equal(requestedLimit, 3);
  assert.deepEqual(query.where, {
    id: { in: ['path-first', 'unpublished-path', 'path-third'] },
    status: 'published',
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
