from ts_runtime import run_typescript


def test_replayed_quiz_outbox_event_does_not_inflate_mastery_attempt_counts():
    run_typescript(
        r"""
const assert = require('node:assert/strict');
const { MasteryGateService } =
  require('./src/modules/education/courses/services/mastery-gate.service.ts');

const completedAt = new Date('2026-11-14T10:00:00.000Z');
const topicAttempts = [
  {
    id: 'attempt-latest',
    percentage: 45,
    isPassed: false,
    completedAt,
  },
  {
    id: 'attempt-passed',
    percentage: 80,
    isPassed: true,
    completedAt: new Date('2026-11-13T10:00:00.000Z'),
  },
];
let progress = {
  id: 'progress-1',
  unitId: 'unit-1',
  courseId: 'course-1',
  quizScores: { attempts: 9, failedAttempts: 7, masteryUnlocked: false },
};
const updates = [];
const service = Object.create(MasteryGateService.prototype);
service.PASSING_THRESHOLD = 70;
service.prisma = {
  topic: {
    findUnique: async () => ({ id: 'topic-1', unitId: 'unit-1', unit: { courseId: 'course-1' } }),
  },
  quizAttempt: { findMany: async () => topicAttempts },
  progress: {
    findFirst: async () => progress,
    update: async ({ data }) => {
      updates.push(data);
      progress = { ...progress, ...data };
      return progress;
    },
  },
};
service.redisService = { del: async () => undefined };
service.eventEmitter = { emit: () => undefined };
service.logger = { error: () => undefined, log: () => undefined, warn: () => undefined };

(async () => {
  await service.onQuizComplete('student-1', 'topic-1', 'attempt-latest');
  await service.onQuizComplete('student-1', 'topic-1', 'attempt-latest');

  assert.equal(updates.length, 2);
  for (const update of updates) {
    assert.equal(update.quizScores.attempts, 2);
    assert.equal(update.quizScores.failedAttempts, 1);
    assert.equal(update.quizScores.masteryUnlocked, true);
    assert.equal(update.quizScores.lastScore, 45);
    assert.equal(update.quizScores.bestScore, 80);
    assert.equal(update.quizScores.lastAttemptAt, completedAt.toISOString());
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
"""
    )
