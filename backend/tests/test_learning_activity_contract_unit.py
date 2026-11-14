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
  idempotencyKey: 'enrollment-test',
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


def test_xapi_retry_reconciles_progress_after_statement_was_saved():
    run_typescript(
        r"""
const assert = require('node:assert/strict');
const { XapiService } =
  require('./src/modules/education/courses/services/xapi.service.ts');
const service = Object.create(XapiService.prototype);
const materialId = '123e4567-e89b-12d3-a456-426614174000';
const occurredAt = new Date('2026-03-01T10:00:00.000Z');
const statement = {
  id: 'statement-1',
  timestamp: occurredAt.toISOString(),
  verb: { id: 'https://adlnet.gov/expapi/verbs/completed' },
  object: { id: `https://example.test/material/${materialId}` },
};
let storedStatement;
let createCount = 0;
const progressWrites = [];
service.metrics = {
  totalStatementsProcessed: 0,
  duplicatesDetected: 0,
  canonicalHashesComputed: 0,
  failedProcessing: 0,
};
service.metricsService = {
  recordXapiProcessed: () => {},
  recordXapiDuplicate: () => {},
  updateXapiDuplicateRate: () => {},
  recordXapiProcessingFailure: () => {},
};
service.events = { emit: () => {} };
service.logger = { debug: () => {}, warn: () => {}, log: () => {} };
service.prisma = {
  xapiStatement: {
    findUnique: async () => storedStatement,
    create: async ({ data }) => {
      createCount++;
      storedStatement = {
        id: 'saved-statement',
        userId: 'user-1',
        materialId,
        statementId: data.statementId,
        raw: data.raw,
        occurredAt,
      };
      return storedStatement;
    },
  },
  material: {
    findUnique: async () => ({
      id: materialId,
      topicId: 'topic-1',
      unitId: 'unit-1',
    }),
  },
  unit: {
    findUnique: async () => ({ id: 'unit-1', courseId: 'course-1' }),
  },
};
service.progressService = {
  updateUnitMaterialTopicProgress: async (_userId, update) => {
    progressWrites.push(update);
    if (progressWrites.length === 1) {
      throw new Error('temporary progress persistence failure');
    }
  },
};

(async () => {
  await assert.rejects(service.saveStatement(statement, 'user-1'));
  const saved = await service.saveStatement(statement, 'user-1');
  assert.equal(saved.id, 'saved-statement');
  assert.equal(createCount, 1);
  assert.equal(progressWrites.length, 2);
  assert.equal(
    progressWrites[0].idempotencyKey,
    progressWrites[1].idempotencyKey,
  );
  assert.equal(progressWrites[0].clientTimestamp, occurredAt.getTime());
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
"""
    )


def test_learning_path_progress_is_idempotent_and_outbox_backed():
    run_typescript(
        r"""
const assert = require('node:assert/strict');
const { LearningPathProgressService } =
  require('./src/modules/education/courses/services/learning-path-progress.service.ts');
const service = Object.create(LearningPathProgressService.prototype);
const originalProgress = {
  id: 'path-progress-1',
  userId: 'user-1',
  learningPathId: 'path-1',
  status: 'inProgress',
  overallProgressPercentage: 0,
  completedAt: null,
  lastAccessedAt: new Date('2026-03-01T10:00:00.000Z'),
  totalTimeSpentMinutes: 0,
  streakDays: 0,
  lastActivityDate: new Date('2026-03-01T10:00:00.000Z'),
  moduleProgress: [{
    moduleId: 'module-1',
    phaseId: 'phase-1',
    status: 'notStarted',
    progressPercentage: 0,
    timeSpentMinutes: 0,
    attempts: 0,
  }],
  phaseProgress: [{
    phaseId: 'phase-1',
    status: 'notStarted',
    progressPercentage: 0,
    modulesCompleted: [],
    modules: [],
    completed: false,
  }],
  milestonesAchieved: [],
  analytics: {},
  learningPath: {
    phases: [{
      id: 'phase-1',
      modules: [{ id: 'module-1', order: 1 }],
    }],
  },
};
let storedProgress = originalProgress;
let storedActivity;
let updateCount = 0;
const outboxEvents = [];
service.createProgressStructure = () => ({
  moduleProgress: [{
    moduleId: 'module-1',
    phaseId: 'phase-1',
    status: 'notStarted',
    progressPercentage: 0,
    timeSpentMinutes: 0,
    attempts: 0,
  }],
  phaseProgress: [{
    phaseId: 'phase-1',
    status: 'notStarted',
    progressPercentage: 0,
    modulesCompleted: [],
    modules: [],
    completed: false,
  }],
});
service.updatePhaseProgress = async () => {};
service.calculateOverallProgress = () => 50;
service.updateStreak = () => {};
service.checkMilestoneAchievements = async () => [];
service.addStudySession = () => {};
service.prisma = {
  learningPathProgress: {
    findFirst: async () => structuredClone(storedProgress),
  },
  $transaction: async callback => callback({
    userActivity: {
      createMany: async ({ data }) => {
        if (storedActivity) return { count: 0 };
        storedActivity = data[0];
        return { count: 1 };
      },
      findUnique: async () => storedActivity
        ? { details: storedActivity.details }
        : null,
    },
    learningPathProgress: {
      update: async ({ data }) => {
        updateCount++;
        storedProgress = { ...storedProgress, ...data };
        return storedProgress;
      },
      findUniqueOrThrow: async () => storedProgress,
    },
    applicationOutboxEvent: {
      upsert: async ({ create }) => {
        outboxEvents.push(create);
      },
    },
  }),
};
const emitted = [];
service.eventEmitter = { emit: (...args) => emitted.push(args) };

(async () => {
  const update = {
    moduleId: 'module-1',
    progressPercentage: 50,
    timeSpentMinutes: 10,
    idempotencyKey: 'request-1',
    clientTimestamp: 1772368800000,
  };
  await service.updateProgress('user-1', 'path-1', update);
  await service.updateProgress('user-1', 'path-1', update);
  assert.equal(updateCount, 1);
  assert.equal(storedProgress.totalTimeSpentMinutes, 10);
  assert.equal(storedActivity.sourceKey,
    'learning-path-progress:user-1:path-1:request-1');
  assert.equal(outboxEvents.length, 1);
  assert.equal(outboxEvents[0].eventType, 'learning-path.progress.updated');
  assert.deepEqual(emitted, []);
  await assert.rejects(
    service.updateProgress('user-1', 'path-1', {
      ...update,
      timeSpentMinutes: 11,
    }),
    /idempotency key was already used for a different/i,
  );
  assert.equal(updateCount, 1);
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
"""
    )


def test_flashcard_review_retry_does_not_repeat_sm2_or_activity():
    run_typescript(
        r"""
const assert = require('node:assert/strict');
const { FlashcardsService } =
  require('./src/modules/education/assessment/services/flashcards.service.ts');
const service = Object.create(FlashcardsService.prototype);
let progress = {
  id: 'flashcard-progress-1',
  userId: 'user-1',
  flashcardId: 'flashcard-1',
  easeFactor: 2.5,
  interval: 1,
  repetitions: 1,
  correctStreak: 1,
  nextReview: new Date('2026-03-02T00:00:00.000Z'),
  lastReview: new Date('2026-03-01T00:00:00.000Z'),
};
let storedActivity;
let resultCount = 0;
let reviewCount = 0;
service.prisma = {
  $transaction: async callback => callback({
    userFlashcardProgress: {
      findFirst: async () => ({ ...progress }),
      update: async ({ data }) => {
        progress = { ...progress, ...data };
        return progress;
      },
    },
    userActivity: {
      createMany: async ({ data }) => {
        if (storedActivity) return { count: 0 };
        storedActivity = data[0];
        return { count: 1 };
      },
      findUnique: async () => storedActivity
        ? { details: storedActivity.details }
        : null,
      update: async ({ data }) => {
        storedActivity = { ...storedActivity, ...data };
      },
    },
    flashcardResult: {
      create: async ({ data }) => {
        resultCount++;
        return { id: 'flashcard-result-1', ...data };
      },
    },
  }),
};
service.sm2Algorithm = {
  reviewCard: () => {
    reviewCount++;
    return {
      updated: {
        easeFactor: 2.6,
        interval: 3,
        repetitions: 2,
        correctStreak: 2,
        nextReviewDate: new Date('2026-03-04T00:00:00.000Z'),
      },
    };
  },
};
service.redisService = { del: async () => {} };
service.logger = { log: () => {} };

(async () => {
  await service.updateCard('flashcard-progress-1', 4, 'user-1', 'review-1');
  await service.updateCard('flashcard-progress-1', 4, 'user-1', 'review-1');
  assert.equal(reviewCount, 1);
  assert.equal(resultCount, 1);
  assert.equal(progress.repetitions, 2);
  assert.equal(
    storedActivity.sourceKey,
    'flashcard-review:user-1:review-1',
  );
  await assert.rejects(
    service.updateCard('flashcard-progress-1', 2, 'user-1', 'review-1'),
    /idempotency key was already used for a different/i,
  );
  assert.equal(reviewCount, 1);
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
"""
    )


def test_auto_quiz_completion_notification_has_stable_retry_key():
    run_typescript(
        r"""
const assert = require('node:assert/strict');
const { WeaknessOrchestrationService } =
  require('./src/modules/education/assessment/services/weakness-orchestration.service.ts');
const service = Object.create(WeaknessOrchestrationService.prototype);
const notificationCalls = [];
service.prisma = {
  autoGeneratedQuiz: {
    findUnique: async () => ({ topic: { name: 'Cardiology' } }),
    update: async () => {},
  },
  userSkillState: { findUnique: async () => ({ pKnown: 0.5 }) },
};
service.notificationService = {
  create: async (...args) => notificationCalls.push(args),
};
service.eventEmitter = { emit: () => {} };
service.logger = { log: () => {}, error: () => {} };

(async () => {
  await service.onAutoQuizComplete({
    userId: 'user-1',
    quizId: 'quiz-1',
    score: 4,
    maxScore: 5,
    timestamp: new Date('2026-03-01T10:00:00.000Z'),
  });
  assert.equal(
    notificationCalls[0][6],
    'auto-quiz-mastery-improved:user-1:quiz-1',
  );
  assert.equal(notificationCalls.length, 1);
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
"""
    )
