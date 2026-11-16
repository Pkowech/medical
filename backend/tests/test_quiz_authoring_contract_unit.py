from ts_runtime import run_typescript


def test_quiz_creation_and_edit_routes_require_author_roles():
    run_typescript(
        r"""
require('reflect-metadata');
const assert = require('node:assert/strict');
const { QuizController } =
  require('./src/modules/education/assessment/controllers/quiz.controller.ts');
const { RoleGuard } = require('./src/common/guards/roles.guard.ts');
const { Role } = require('./src/modules/auth/constants/role.constants.ts');

for (const methodName of ['createQuiz', 'updateQuiz']) {
  const handler = QuizController.prototype[methodName];
  assert.deepEqual(Reflect.getMetadata('roles', handler), [Role.instructor, Role.admin]);
  assert.ok(Reflect.getMetadata('__guards__', handler).includes(RoleGuard));
}

const calls = [];
const controller = Object.create(QuizController.prototype);
controller.quizService = {
  create: async (...args) => { calls.push(['create', ...args]); },
  update: async (...args) => { calls.push(['update', ...args]); },
};

(async () => {
  const request = { user: { id: 'instructor-1' } };
  await controller.createQuiz(request, { title: 'Quiz', questions: ['q-1'] });
  await controller.updateQuiz(request, 'quiz-1', { questions: ['q-2'] });
  assert.deepEqual(calls, [
    ['create', { title: 'Quiz', questions: ['q-1'] }, 'instructor-1'],
    ['update', 'quiz-1', { questions: ['q-2'] }, 'instructor-1'],
  ]);
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
"""
    )


def test_quiz_update_remains_immutable_after_an_attempt_exists():
    run_typescript(
        r"""
const assert = require('node:assert/strict');
const { ConflictException } = require('@nestjs/common');
const { QuizService } =
  require('./src/modules/education/assessment/services/quiz.service.ts');

let updateCalls = 0;
const service = Object.create(QuizService.prototype);
service.prisma = {
  quiz: {
    findUnique: async () => ({
      id: 'quiz-1',
      createdBy: 'instructor-1',
      isPublished: true,
      questionCount: 1,
      unitId: 'unit-1',
      topicId: null,
    }),
  },
  $transaction: async callback => callback({
    $queryRaw: async () => [],
    quizAttempt: { count: async () => 1 },
    quiz: { update: async () => { updateCalls += 1; } },
  }),
};
service.logger = { error: () => undefined };

(async () => {
  await assert.rejects(
    service.update('quiz-1', { title: 'Edited title' }, 'instructor-1'),
    error => error instanceof ConflictException,
  );
  assert.equal(updateCalls, 0);
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
"""
    )


def test_publishing_rejects_question_types_without_a_learner_ui():
    run_typescript(
        r"""
const assert = require('node:assert/strict');
const { BadRequestException } = require('@nestjs/common');
const { QuizService } =
  require('./src/modules/education/assessment/services/quiz.service.ts');

const service = Object.create(QuizService.prototype);
service.prisma = {
  $transaction: async callback => callback({
    $queryRaw: async () => [],
    quiz: {
      findUnique: async () => ({
        id: 'quiz-1',
        createdBy: 'instructor-1',
        publishedAt: null,
        unitId: 'unit-1',
        topicId: null,
      }),
    },
    quizQuestion: {
      count: async () => 1,
      findMany: async () => [{ question: { type: 'essay' } }],
    },
  }),
};

(async () => {
  await assert.rejects(
    service.publishQuiz('quiz-1', 'instructor-1'),
    error => error instanceof BadRequestException,
  );
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
"""
    )
