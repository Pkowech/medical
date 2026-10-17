from ts_runtime import run_typescript


def test_quiz_offline_practice_sync_validates_and_is_idempotent():
    run_typescript(
        r"""
const assert = require('node:assert/strict');
const { Module } = require('node:module');
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === '@prisma/client') {
    return { UserActivityType: { QUIZ_ATTEMPT: 'QUIZ_ATTEMPT' }, Prisma: {} };
  }
  return originalLoad.call(this, request, parent, isMain);
};

const { BadRequestException, ConflictException } = require('@nestjs/common');
const { QuizService } =
  require('./src/modules/education/assessment/services/quiz.service.ts');
const userId = 'student-1';
const topicId = 'topic-1';
const attemptId = 'attempt-1';
const responses = [
  { questionId: 'question-1', selectedAnswers: ['option-correct'] },
  { questionId: 'question-2', selectedAnswers: ['option-2-correct'] },
];
const questions = [
  {
    id: 'question-1',
    points: 1,
    options: [
      { id: 'option-correct', isCorrect: true },
      { id: 'option-wrong', isCorrect: false },
    ],
  },
  { id: 'question-2', points: 1, options: [{ id: 'option-2-correct', isCorrect: true }] },
];
const prisma = {
  question: { findMany: async () => questions },
  offlinePracticeAttempt: { upsert: async () => ({}) },
};
let masteryCalls = 0;
const masteryGate = { onQuizComplete: async () => { masteryCalls += 1; } };
const service = new QuizService(prisma, {}, {}, {}, masteryGate, {}, {}, {});

(async () => {
  const validatedAt = new Date();
  prisma.offlinePracticeAttempt.upsert = async args => ({
    id: attemptId,
    userId,
    topicId,
    responses: args.create.responses,
    score: args.create.score,
    validatedAt,
  });
  assert.deepEqual(await service.syncOfflinePracticeAttempt(userId, topicId, attemptId, responses), {
    attemptId,
    score: 100,
    validatedAt,
    formative: true,
  });
  assert.equal(masteryCalls, 0);

  let upsertCalls = 0;
  prisma.offlinePracticeAttempt.upsert = async () => {
    upsertCalls += 1;
    return {};
  };
  await assert.rejects(
    service.syncOfflinePracticeAttempt(userId, topicId, attemptId, [responses[0]]),
    error => error instanceof BadRequestException,
  );
  await assert.rejects(
    service.syncOfflinePracticeAttempt(userId, topicId, attemptId, [
      { questionId: 'question-1', selectedAnswers: ['not-an-option'] },
      responses[1],
    ]),
    error => error instanceof BadRequestException,
  );
  assert.equal(upsertCalls, 0);

  prisma.offlinePracticeAttempt.upsert = async () => ({
    id: attemptId,
    userId: 'another-student',
    topicId,
    responses,
    score: 100,
    validatedAt,
  });
  await assert.rejects(
    service.syncOfflinePracticeAttempt(userId, topicId, attemptId, responses),
    error => error instanceof ConflictException,
  );
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
"""
    )
