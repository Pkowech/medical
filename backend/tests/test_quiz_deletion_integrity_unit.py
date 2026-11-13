from ts_runtime import run_typescript


def test_quiz_with_attempts_cannot_be_deleted():
    run_typescript(
        r"""
const assert = require('node:assert/strict');
const { ConflictException } = require('@nestjs/common');
const { QuizService } =
  require('./src/modules/education/assessment/services/quiz.service.ts');

function makeService(attemptCount) {
  const calls = [];
  const service = Object.create(QuizService.prototype);
  service.prisma = {
    quiz: {
      findUnique: async () => ({ id: 'quiz-1', createdBy: 'instructor-1' }),
    },
    $transaction: async callback => callback({
      quizAttempt: {
        count: async args => {
          calls.push(['count', args]);
          return attemptCount;
        },
      },
      quizQuestion: {
        deleteMany: async args => calls.push(['deleteQuestions', args]),
      },
      quiz: {
        delete: async args => calls.push(['deleteQuiz', args]),
      },
    }),
  };
  service.invalidateAssessmentCaches = async () => undefined;
  service.logger = { error: () => undefined, log: () => undefined };
  return { service, calls };
}

(async () => {
  const withAttempts = makeService(1);
  await assert.rejects(
    withAttempts.service.delete('quiz-1', 'instructor-1'),
    error => error instanceof ConflictException,
  );
  assert.deepEqual(withAttempts.calls, [
    ['count', { where: { quizId: 'quiz-1' } }],
  ]);

  const withoutAttempts = makeService(0);
  await withoutAttempts.service.delete('quiz-1', 'instructor-1');
  assert.deepEqual(withoutAttempts.calls.map(([operation]) => operation), [
    'count',
    'deleteQuestions',
    'deleteQuiz',
  ]);
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
"""
    )
