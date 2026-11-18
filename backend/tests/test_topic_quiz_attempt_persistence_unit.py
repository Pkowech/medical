from ts_runtime import run_typescript


def test_topic_quiz_attempt_and_answers_are_persisted_server_side():
    run_typescript(
        r"""
const assert = require('node:assert/strict');
const { QuizService } =
  require('./src/modules/education/assessment/services/quiz.service.ts');
const attemptId = '00000000-0000-4000-8000-000000000001';
const topicId = '00000000-0000-4000-8000-000000000002';
const question = {
  id: 'question-1',
  text: 'Question',
  type: 'multiple_choice',
  points: 1,
  topicIds: [topicId],
  options: [{ id: 'option-1', text: 'Option', order: 0 }],
};
const service = Object.create(QuizService.prototype);
service.getVisibleTopic = async () => ({
  id: topicId,
  name: 'Topic',
  unitId: 'unit-1',
  quizQuestionCount: 1,
});
service.getQuestionsByTopic = async (_topicId, limited) =>
  limited ? [question] : [question];
service.ensureTopicPracticeQuiz = async () => ({
  id: 'quiz-1',
  showResults: true,
});
let createdAttempt;
const tx = {
  quizAttempt: {
    findUnique: async () => null,
    create: async ({ data }) => {
      createdAttempt = data;
      return { id: data.id, startedAt: data.startedAt };
    },
  },
};
service.prisma = {
  quizAttempt: { findUnique: async () => null },
  $transaction: async callback => callback(tx),
};

(async () => {
  const started = await service.startTopicQuizAttempt(
    'user-1',
    topicId,
    attemptId,
  );
  assert.equal(createdAttempt.id, attemptId);
  assert.equal(createdAttempt.quizId, 'quiz-1');
  assert.deepEqual(createdAttempt.answers, [
    { questionId: 'question-1', selectedOption: null },
  ]);
  assert.deepEqual(started.questionIds, ['question-1']);
  assert.equal(started.answers[0].selectedOption, null);

  let savedAnswers;
  const attempt = {
    id: attemptId,
    userId: 'user-1',
    startedAt: new Date(),
    completedAt: null,
    answers: [{ questionId: 'question-1', selectedOption: null }],
    quiz: { timeLimit: null },
  };
  service.prisma.$transaction = async callback => callback({
    $queryRaw: async () => [],
    quizAttempt: {
      findUnique: async () => attempt,
      update: async ({ data }) => { savedAnswers = data.answers; },
    },
    option: {
      findFirst: async () => ({ id: 'option-1' }),
    },
  });
  const saved = await service.saveQuizAttemptAnswer(
    'user-1',
    attemptId,
    'question-1',
    'option-1',
  );
  assert.deepEqual(saved, { saved: true });
  assert.deepEqual(savedAnswers, [
    { questionId: 'question-1', selectedOption: 'option-1' },
  ]);
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
"""
    )
