from ts_runtime import run_typescript


def test_progress_updates_require_server_revision_and_reset_advances_it():
    run_typescript(
        r"""
const assert = require('node:assert/strict');
const { ProgressStatus } = require('@prisma/client');
const { ProgressService } =
  require('./src/modules/education/courses/services/progress.service.ts');

async function createService() {
  const existing = {
    id: 'progress-1',
    userId: 'user-1',
    topicId: 'topic-1',
    materialId: null,
    unitId: null,
    courseId: null,
    status: ProgressStatus.completed,
    isCompleted: true,
    progressPercentage: 100,
    completionPercentage: 100,
    completedAt: new Date('2026-01-01T00:00:00Z'),
    lastUpdated: BigInt(Date.now()),
    revision: 7,
    timeSpent: 12,
  };
  const calls = { update: [] };
  const activityKeys = new Set();
  const tx = {
    userActivity: {
      createMany: async ({ data }) => {
        const key = data[0].sourceKey;
        if (activityKeys.has(key)) return { count: 0 };
        activityKeys.add(key);
        return { count: 1 };
      },
      create: async () => ({}),
    },
    topic: { findUnique: async () => ({ id: 'topic-1' }) },
    material: { findUnique: async () => null },
    progress: {
      findFirst: async () => existing,
      update: async ({ data }) => {
        calls.update.push(data);
        Object.assign(existing, data);
        return existing;
      },
      create: async ({ data }) => data,
    },
  };
  const service = Object.create(ProgressService.prototype);
  service.prisma = {
    $transaction: async callback => {
      const previousActivityKeys = new Set(activityKeys);
      try {
        return await callback(tx);
      } catch (error) {
        activityKeys.clear();
        previousActivityKeys.forEach(key => activityKeys.add(key));
        throw error;
      }
    },
  };
  service.redisService = { del: async () => {} };
  service.logger = { log: () => {}, warn: () => {}, error: () => {} };
  service.aiAnalyticsService = { trackEvent: async () => {} };
  service.events = { emit: () => {} };
  return { service, calls, existing };
}

(async () => {
  const stale = await createService();
  await assert.rejects(
    stale.service.updateUnitMaterialTopicProgress('user-1', {
      topicId: 'topic-1',
      status: ProgressStatus.notStarted,
      progressPercentage: 0,
      expectedRevision: 6,
      idempotencyKey: 'stale-reset',
    }),
    error => error?.getStatus?.() === 409,
  );
  assert.equal(stale.calls.update.length, 0);

  const reset = await createService();
  await reset.service.updateUnitMaterialTopicProgress('user-1', {
    topicId: 'topic-1',
    status: ProgressStatus.notStarted,
    progressPercentage: 0,
    expectedRevision: 7,
    idempotencyKey: 'newer-reset',
  });
  assert.equal(reset.calls.update.length, 1);
  assert.equal(reset.calls.update[0].status, ProgressStatus.notStarted);
  assert.equal(reset.calls.update[0].progressPercentage, 0);
  assert.equal(reset.calls.update[0].revision, 8);

  await reset.service.updateUnitMaterialTopicProgress('user-1', {
    topicId: 'topic-1',
    status: ProgressStatus.inProgress,
    progressPercentage: 20,
    expectedRevision: 7,
    idempotencyKey: 'stale-offline-study',
  }).then(
    () => { throw new Error('Expected stale offline study to conflict'); },
    error => assert.equal(error?.getStatus?.(), 409),
  );
  await reset.service.updateUnitMaterialTopicProgress('user-1', {
    topicId: 'topic-1',
    status: ProgressStatus.inProgress,
    progressPercentage: 20,
    expectedRevision: 8,
    idempotencyKey: 'post-reset-study',
  });
  assert.equal(
    reset.calls.update[reset.calls.update.length - 1].revision,
    9,
  );

  const concurrentReset = await createService();
  await concurrentReset.service.updateUnitMaterialTopicProgress('user-1', {
    topicId: 'topic-1',
    status: ProgressStatus.notStarted,
    progressPercentage: 0,
    expectedRevision: 7,
    idempotencyKey: 'first-device-reset',
  });
  await assert.rejects(
    concurrentReset.service.updateUnitMaterialTopicProgress('user-1', {
      topicId: 'topic-1',
      status: ProgressStatus.completed,
      progressPercentage: 100,
      expectedRevision: 7,
      idempotencyKey: 'second-device-reset',
    }),
    error => error?.getStatus?.() === 409,
  );
  assert.equal(concurrentReset.calls.update.length, 1);

  const idempotent = await createService();
  await idempotent.service.updateUnitMaterialTopicProgress('user-1', {
    topicId: 'topic-1',
    status: ProgressStatus.completed,
    progressPercentage: 100,
    expectedRevision: 7,
    idempotencyKey: 'same-request',
  });
  await idempotent.service.updateUnitMaterialTopicProgress('user-1', {
    topicId: 'topic-1',
    status: ProgressStatus.completed,
    progressPercentage: 100,
    expectedRevision: 7,
    idempotencyKey: 'same-request',
  });
  assert.equal(idempotent.calls.update.length, 1);
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
"""
    )
