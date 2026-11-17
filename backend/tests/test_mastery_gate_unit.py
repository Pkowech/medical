from ts_runtime import run_typescript


def test_mastery_gate_active_unit_limit_and_safe_deactivation():
    run_typescript(
        r"""
const assert = require('node:assert/strict');
const { Module } = require('node:module');
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === '@prisma/client') {
    return {
      EnrollmentStatus: { active: 'active', completed: 'completed' },
      ProgressStatus: { inProgress: 'inProgress', dropped: 'dropped' },
      Prisma: {
        TransactionIsolationLevel: { Serializable: 'Serializable' },
        PrismaClientKnownRequestError: class PrismaClientKnownRequestError extends Error {},
      },
    };
  }
  return originalLoad.call(this, request, parent, isMain);
};

const { MasteryGateService, MAX_ACTIVE_UNITS } =
  require('./src/modules/education/courses/services/mastery-gate.service.ts');
const transaction = {
  unit: { findUnique: async () => ({ id: 'unit-37', courseId: 'course-1' }) },
  courseEnrollment: { findFirst: async () => ({ id: 'enrollment-1' }) },
  progress: {
    findFirst: async () => null,
    findMany: async () => [],
    update: async () => ({}),
    create: async () => ({}),
  },
};
const prisma = { $transaction: async callback => callback(transaction) };
const service = new MasteryGateService(prisma, {}, {}, {});

(async () => {
  transaction.progress.findMany = async () =>
    Array.from({ length: MAX_ACTIVE_UNITS }, (_, index) => ({ unitId: `unit-${index + 1}` }));
  assert.deepEqual(await service.activateUnit('user-1', 'unit-37'), {
    success: false,
    maxActiveUnits: 36,
    message: 'You already have 36 active units. Remove one before starting another.',
  });

  transaction.progress.findMany = async () => {
    throw new Error('database unavailable');
  };
  await assert.rejects(service.activateUnit('user-1', 'unit-37'), /database unavailable/);

  transaction.progress.findFirst = async () => ({
    id: 'unit-progress-1',
    status: 'inProgress',
    progressPercentage: 45,
    timeSpent: 60,
  });
  transaction.progress.update = async args => {
    assert.deepEqual(args, {
      where: { id: 'unit-progress-1' },
      data: { status: 'dropped' },
    });
    return {};
  };
  transaction.progress.create = async () => {
    throw new Error('must preserve existing progress');
  };
  assert.deepEqual(await service.deactivateUnit('user-1', 'unit-1'), {
    success: true,
    message: 'Unit removed from your active learning list. Progress was kept.',
  });
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
"""
    )


def test_passing_quiz_completes_topic_progress_without_changing_study_time():
    run_typescript(
        r"""
const assert = require('node:assert/strict');
const { MasteryGateService } =
  require('./src/modules/education/courses/services/mastery-gate.service.ts');
const completedAt = new Date('2026-11-17T10:00:00.000Z');
const progress = {
  id: 'topic-progress-1',
  userId: 'user-1',
  topicId: 'topic-1',
  unitId: 'unit-1',
  courseId: 'course-1',
  status: 'inProgress',
  progressPercentage: 35,
  completionPercentage: 35,
  timeSpent: 12,
  isCompleted: false,
  completedAt: null,
  quizScores: {},
};
const updates = [];
const prisma = {
  topic: {
    findUnique: async () => ({
      id: 'topic-1',
      unitId: 'unit-1',
      unit: { id: 'unit-1', courseId: 'course-1' },
    }),
  },
  quizAttempt: {
    findMany: async () => [{
      id: 'attempt-1',
      percentage: 85,
      isPassed: true,
      completedAt,
    }],
  },
  progress: {
    findFirst: async () => progress,
    update: async ({ data }) => {
      updates.push(data);
      Object.assign(progress, data);
      return progress;
    },
    create: async () => { throw new Error('unexpected progress creation'); },
  },
};
const service = new MasteryGateService(
  prisma,
  { del: async () => {} },
  { emit: () => {} },
  { evaluateGates: async () => ({ canProceed: false, pKnown: 0.4 }) },
);
service.unlockNextTopic = async () => ({
  unlocked: true,
  nextTopicId: 'topic-2',
});

(async () => {
  await service.onQuizComplete('user-1', 'topic-1', 'attempt-1', 85);
  assert.equal(progress.progressPercentage, 100);
  assert.equal(progress.completionPercentage, 100);
  assert.equal(progress.status, 'completed');
  assert.equal(progress.isCompleted, true);
  assert.equal(progress.completedAt.toISOString(), completedAt.toISOString());
  assert.equal(progress.timeSpent, 12);
  assert.equal(progress.quizScores.masteryUnlocked, true);
  assert.equal(updates[0].progressPercentage, 100);
  assert.equal(updates[0].status, 'completed');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
"""
    )


def test_failed_quiz_does_not_complete_topic_progress():
    run_typescript(
        r"""
const assert = require('node:assert/strict');
const { MasteryGateService } =
  require('./src/modules/education/courses/services/mastery-gate.service.ts');
const completedAt = new Date('2026-11-17T10:00:00.000Z');
const progress = {
  id: 'topic-progress-1',
  unitId: 'unit-1',
  courseId: 'course-1',
  status: 'inProgress',
  progressPercentage: 35,
  completionPercentage: 35,
  timeSpent: 3,
  isCompleted: false,
  completedAt: null,
  quizScores: {},
};
const service = Object.create(MasteryGateService.prototype);
service.PASSING_THRESHOLD = 70;
service.prisma = {
  topic: {
    findUnique: async () => ({
      id: 'topic-1',
      unitId: 'unit-1',
      unit: { courseId: 'course-1' },
    }),
  },
  quizAttempt: {
    findMany: async () => [{
      id: 'attempt-failed',
      percentage: 40,
      isPassed: false,
      completedAt,
    }],
  },
  progress: {
    findFirst: async () => progress,
    update: async ({ data }) => {
      Object.assign(progress, data);
      return progress;
    },
  },
};
service.redisService = { del: async () => undefined };
service.eventEmitter = { emit: () => undefined };
service.logger = { error: () => undefined, log: () => undefined, warn: () => undefined };

(async () => {
  await service.onQuizComplete('student-1', 'topic-1', 'attempt-failed');
  assert.equal(progress.status, 'inProgress');
  assert.equal(progress.progressPercentage, 35);
  assert.equal(progress.completionPercentage, 35);
  assert.equal(progress.isCompleted, false);
  assert.equal(progress.completedAt, null);
  assert.equal(progress.timeSpent, 3);
  assert.equal(progress.quizScores.masteryUnlocked, false);
  assert.equal(progress.quizScores.failedAttempts, 1);
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
"""
    )
