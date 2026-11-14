from ts_runtime import run_typescript


def test_learning_progress_route_requires_content_and_retry_contract():
    run_typescript(
        r"""
const assert = require('node:assert/strict');
const { LearningController } =
  require('./src/modules/education/courses/controllers/learning.controller.ts');

const controller = Object.create(LearningController.prototype);
let forwarded;
controller.learningService = {
  updateProgress: async (userId, data) => {
    forwarded = { userId, data };
    return { success: true };
  },
};
const request = { user: { id: 'user-1' } };
const courseOnlyUpdate = {
  courseId: 'course-1',
  progress: 10,
  timeSpent: 0,
};
const contentUpdate = {
  ...courseOnlyUpdate,
  topicId: 'topic-1',
};

(async () => {
  await assert.rejects(
    controller.updateProgress(
      courseOnlyUpdate,
      request,
      '1760000000000',
      'retry-1',
      '0',
    ),
    /Course progress is derived/,
  );
  await assert.rejects(
    controller.updateProgress(contentUpdate, request, '1760000000000'),
    /X-Idempotency-Key is required/,
  );
  await controller.updateProgress(
    contentUpdate,
    request,
    '1760000000000',
    'retry-1',
    '0',
  );
  assert.equal(forwarded.userId, 'user-1');
  assert.equal(forwarded.data.topicId, 'topic-1');
  assert.equal(forwarded.data.idempotencyKey, 'retry-1');
  assert.equal(forwarded.data.expectedRevision, 0);
  assert.equal(forwarded.data.clientTimestamp, 1760000000000);
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
"""
    )


def test_learning_progress_requires_active_enrollment_and_matching_topic():
    run_typescript(
        r"""
const assert = require('node:assert/strict');
const { ProgressService } =
  require('./src/modules/education/courses/services/progress.service.ts');

function createService(enrollment, topic) {
  const service = Object.create(ProgressService.prototype);
  service.prisma = {
    courseEnrollment: { findUnique: async () => enrollment },
    topic: { findUnique: async () => topic },
  };
  service.logger = { error: () => {}, warn: () => {}, log: () => {} };
  return service;
}

const update = {
  courseId: 'course-1',
  topicId: 'topic-1',
  status: 'inProgress',
  progressPercentage: 10,
  clientTimestamp: 1760000000000,
};

(async () => {
  await assert.rejects(
    createService({ status: 'dropped' }).updateUnitMaterialTopicProgress(
      'user-1',
      update,
    ),
    /active course enrollment is required/,
  );
  await assert.rejects(
    createService(
      { status: 'active' },
      { unitId: 'unit-1', unit: { courseId: 'another-course' } },
    ).updateUnitMaterialTopicProgress('user-1', update),
    /associations do not match the selected topic/,
  );
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
"""
    )
