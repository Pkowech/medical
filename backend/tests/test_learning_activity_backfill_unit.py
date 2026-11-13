from ts_runtime import run_typescript


def test_learning_activity_backfill_preserves_provenance_and_skips_legacy_rows():
    run_typescript(
        r"""
const assert = require('node:assert/strict');
const { UserActivityType } = require('@prisma/client');
const { planLearningActivityBackfill } =
  require('./scripts/backfill-learning-activities.ts');

const quizTime = new Date('2026-11-14T10:00:00.000Z');
const flashcardTime = new Date('2026-11-14T10:00:30.000Z');
const sources = [
  {
    kind: 'quiz',
    record: {
      id: 'quiz-1',
      userId: 'student-1',
      quizId: 'quiz-a',
      quizTitle: 'Quiz A',
      completedAt: quizTime,
      score: 8,
      percentage: 80,
      correctAnswers: 8,
      totalQuestions: 10,
    },
  },
  {
    kind: 'quiz',
    record: {
      id: 'quiz-2',
      userId: 'student-1',
      quizId: 'quiz-b',
      quizTitle: 'Quiz B',
      completedAt: new Date(quizTime.getTime() + 10_000),
      score: 5,
      percentage: 50,
      correctAnswers: 5,
      totalQuestions: 10,
    },
  },
  {
    kind: 'quiz',
    record: {
      id: 'quiz-3',
      userId: 'student-1',
      quizId: 'quiz-c',
      quizTitle: 'Quiz C',
      completedAt: new Date(quizTime.getTime() + 20_000),
      score: 6,
      percentage: 60,
      correctAnswers: 6,
      totalQuestions: 10,
    },
  },
  {
    kind: 'flashcard',
    record: {
      id: 'flashcard-result-1',
      userId: 'student-1',
      flashcardId: 'flashcard-1',
      attemptedAt: flashcardTime,
      passed: true,
    },
  },
];
const existingActivities = [
  {
    userId: 'student-1',
    sourceKey: null,
    type: UserActivityType.QUIZ_ATTEMPT,
    details: { quizAttemptId: 'quiz-2' },
    createdAt: new Date(quizTime.getTime() + 10_000),
  },
  {
    userId: 'student-1',
    sourceKey: null,
    type: UserActivityType.QUIZ_ATTEMPT,
    details: null,
    createdAt: new Date(quizTime.getTime() + 22_000),
  },
];

const plan = planLearningActivityBackfill(sources, existingActivities);
assert.equal(plan.activities.length, 2);
assert.equal(plan.ambiguousSkipped, 1);
assert.deepEqual(
  plan.activities.map(activity => activity.sourceKey),
  ['quiz-attempt:quiz-1', 'flashcard-result:flashcard-result-1'],
);
assert.equal(plan.activities[0].createdAt, quizTime);
assert.equal(
  plan.activities[0].details.occurredAt,
  quizTime.toISOString(),
);
assert.equal(plan.activities[1].createdAt, flashcardTime);
"""
    )
