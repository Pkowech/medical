from ts_runtime import run_typescript


def test_material_topic_progress_writes_one_canonical_revisioned_record():
    run_typescript(
        r"""
const assert = require('node:assert/strict');
const { ProgressService } =
  require('./src/modules/education/courses/services/progress.service.ts');

const rows = [];
const creates = [];
const updates = [];
const activityKeys = new Set();
const tx = {
  userActivity: {
    createMany: async ({ data }) => {
      const key = data[0].sourceKey;
      if (activityKeys.has(key)) return { count: 0 };
      activityKeys.add(key);
      return { count: 1 };
    },
    findUnique: async () => null,
  },
  topic: { findUnique: async () => ({ id: 'topic-1' }) },
  material: { findUnique: async () => ({ id: 'material-1' }) },
  unit: { findUnique: async () => ({ id: 'unit-1' }) },
  progress: {
    findFirst: async ({ where }) =>
      rows.find(row =>
        Object.entries(where).every(([key, value]) => row[key] === value),
      ) ?? null,
    create: async ({ data }) => {
      creates.push(data);
      const row = { id: 'progress-1', ...data };
      rows.push(row);
      return row;
    },
    update: async ({ where, data }) => {
      updates.push({ where, data });
      const row = rows.find(candidate => candidate.id === where.id);
      Object.assign(row, data);
      return row;
    },
  },
};

const service = Object.create(ProgressService.prototype);
service.prisma = {
  material: {
    findUnique: async () => ({
      id: 'material-1',
      userId: 'student-1',
      courseId: null,
      unitId: 'unit-1',
      topicId: 'topic-1',
      metadata: {},
      unit: { courseId: null },
    }),
  },
  topic: {
    findUnique: async () => ({
      unitId: 'unit-1',
      unit: { courseId: null },
    }),
  },
  $transaction: async callback => callback(tx),
};
service.clearCache = async () => {};
service.aiAnalyticsService = { trackEvent: async () => {} };
service.logger = { log: () => {}, warn: () => {}, error: () => {} };

(async () => {
  await service.updateUnitMaterialTopicProgress('student-1', {
    unitId: 'unit-1',
    topicId: 'topic-1',
    materialId: 'material-1',
    status: 'inProgress',
    progressPercentage: 30,
    timeSpent: 2,
    clientTimestamp: Date.now(),
    expectedRevision: 0,
    idempotencyKey: 'material-progress-1',
  });
  assert.equal(creates.length, 1);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].unitId, 'unit-1');
  assert.equal(rows[0].topicId, 'topic-1');
  assert.equal(rows[0].materialId, 'material-1');
  assert.equal(rows[0].progressPercentage, 30);
  assert.equal(rows[0].revision, 1);

  await service.updateUnitMaterialTopicProgress('student-1', {
    unitId: 'unit-1',
    topicId: 'topic-1',
    materialId: 'material-1',
    status: 'inProgress',
    progressPercentage: 60,
    timeSpent: 1,
    clientTimestamp: Date.now(),
    expectedRevision: 1,
    idempotencyKey: 'material-progress-2',
  });
  assert.equal(creates.length, 1);
  assert.equal(rows.length, 1);
  assert.equal(updates.length, 1);
  assert.equal(rows[0].progressPercentage, 60);
  assert.equal(rows[0].revision, 2);
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
"""
    )
