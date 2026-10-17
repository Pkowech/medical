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
      Prisma: { TransactionIsolationLevel: { Serializable: 'Serializable' } },
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
