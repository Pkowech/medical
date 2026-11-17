from ts_runtime import run_typescript


def test_topic_progress_sync_cannot_mark_a_topic_complete_without_mastery():
    run_typescript(
        r"""
const assert = require('node:assert/strict');
const { ProgressService } =
  require('./src/modules/education/courses/services/progress.service.ts');
const { ForbiddenException } = require('@nestjs/common');
let writes = 0;
const tx = {
  userActivity: {
    createMany: async () => ({ count: 1 }),
    findUnique: async () => null,
  },
  progress: {
    findFirst: async () => ({
      id: 'topic-progress-1',
      revision: 0,
      isCompleted: false,
      quizScores: { masteryUnlocked: false },
    }),
    create: async () => { writes += 1; },
    update: async () => { writes += 1; },
  },
};
const service = Object.create(ProgressService.prototype);
service.prisma = {
  courseEnrollment: {
    findUnique: async () => ({ status: 'active' }),
  },
  topic: {
    findUnique: async () => ({
      unitId: 'unit-1',
      unit: { courseId: 'course-1' },
    }),
  },
  $transaction: async callback => callback(tx),
};
service.logger = { error: () => undefined, warn: () => undefined, log: () => undefined };

(async () => {
  await assert.rejects(
    service.updateUnitMaterialTopicProgress('student-1', {
      courseId: 'course-1',
      unitId: 'unit-1',
      topicId: 'topic-1',
      status: 'completed',
      progressPercentage: 100,
      idempotencyKey: 'manual-topic-completion',
      expectedRevision: 0,
    }),
    error =>
      error instanceof ForbiddenException &&
      error.message === 'A topic can only be completed by passing its assessment.',
  );
  assert.equal(writes, 0);
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
"""
    )


def test_unit_progress_uses_topic_mastery_and_does_not_auto_complete_empty_units():
    run_typescript(
        r"""
const assert = require('node:assert/strict');
const { ProgressService } =
  require('./src/modules/education/courses/services/progress.service.ts');
const service = Object.create(ProgressService.prototype);
let topics = [
  { id: 'required-1', isMandatory: true },
  { id: 'required-2', isMandatory: true },
  { id: 'optional', isMandatory: false },
];
let progress = [
  { topicId: 'required-1', quizScores: { masteryUnlocked: true } },
  { topicId: 'required-2', quizScores: { masteryUnlocked: false } },
  { topicId: 'optional', quizScores: { masteryUnlocked: true } },
];
service.prisma = {
  unit: { findUnique: async () => ({ topics }) },
  progress: { findMany: async () => progress },
  material: {
    count: async () => 0,
  },
};
service.logger = { error: () => undefined };

(async () => {
  assert.deepEqual(await service.calculateUnitProgress('student-1', 'unit-1'), {
    progressPercentage: 67,
    isCompleted: false,
  });

  topics = [];
  progress = [];
  service.prisma.progress.count = async () => 0;
  assert.deepEqual(await service.calculateUnitProgress('student-1', 'unit-1'), {
    progressPercentage: 0,
    isCompleted: false,
  });
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
"""
    )


def test_failed_completed_assessment_keeps_completion_and_mastery_separate_with_time_data():
    run_typescript(
        r"""
const assert = require('node:assert/strict');
const { AssessmentProgressService } =
  require('./src/modules/education/assessment/services/assessment-progress.service.ts');
const attempts = [
  {
    startedAt: new Date('2026-11-17T10:00:00.000Z'),
    completedAt: new Date('2026-11-17T10:03:00.000Z'),
    timeTaken: 175,
    percentage: 45,
    isPassed: false,
  },
];
let upsertInput;
const events = [];
const service = Object.create(AssessmentProgressService.prototype);
service.prisma = {
  quiz: {
    findUnique: async () => ({
      id: 'assessment-1',
      unitId: 'unit-1',
      topicId: 'topic-1',
      showResults: true,
      unit: { courseId: 'course-1' },
    }),
  },
  quizAttempt: { findMany: async () => attempts },
  assessmentProgress: {
    upsert: async input => {
      upsertInput = input;
      return {
        userId: 'student-1',
        assessmentId: 'assessment-1',
        ...input.update,
      };
    },
  },
};
service.redisService = { set: async () => undefined, del: async () => undefined };
service.eventEmitter = { emit: (...args) => events.push(args) };
service.logger = { log: () => undefined, error: () => undefined };

(async () => {
  const result = await service.updateProgress('student-1', 'assessment-1');
  assert.equal(upsertInput.update.completionPercentage, 100);
  assert.equal(upsertInput.update.isPassed, false);
  assert.equal(upsertInput.update.totalAttempts, 1);
  assert.equal(upsertInput.update.bestScore, 45);
  assert.equal(result.completionPercentage, 100);
  assert.equal(result.isPassed, false);
  assert.equal(events[0][0], 'assessment.completed');
  assert.equal(events[0][1].attemptData.passed, false);
  assert.equal(events[0][1].attemptData.timeSpentMinutes, 3);
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
"""
    )
