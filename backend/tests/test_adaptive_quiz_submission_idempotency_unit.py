from ts_runtime import run_typescript


def test_adaptive_answer_retries_replay_without_duplicate_effects():
    run_typescript(
        r"""
const assert = require('node:assert/strict');
const { ConflictException } = require('@nestjs/common');
const { AssessmentAnalyticsService } =
  require('./src/modules/ai-analytics/services/assessment-analytics.service.ts');

const question = {
  id: 'question-1',
  type: 'multiple_choice',
  explanation: 'Well done',
  difficultyIndex: 0,
  discrimination: 1,
  guessing: 0.25,
  topicIds: ['topic-1'],
  options: [{ id: 'option-1', isCorrect: true }],
};
const nextQuestion = {
  id: 'question-2',
  explanation: 'Next',
  options: [{ id: 'option-2', isCorrect: false }],
};
const staleSession = {
  sessionId: 'session-1',
  userId: 'student-1',
  questions: [question],
  currentQuestionIndex: 0,
  userAbility: 0,
  confidenceInterval: 2,
  targetPrecision: 0.3,
  responses: [],
  isComplete: false,
  finalScore: 0,
  recommendations: [],
};
const storedResponse = {
  answer: 'option-1',
  isCorrect: true,
  responseTime: 12,
};

function makeService() {
  let durableSession = structuredClone(staleSession);
  let cachedSession = JSON.stringify(durableSession);
  let storedResponse;
  let responseCreates = 0;
  const outboxEvents = new Map();
  const service = Object.create(AssessmentAnalyticsService.prototype);
  service.redisService = {
    set: async (_key, value) => { cachedSession = value; },
    del: async () => undefined,
  };
  service.prisma = {
    $transaction: async callback => callback({
      quizAttempt: {
        findFirst: async () => ({ adaptiveState: durableSession }),
        update: async ({ data }) => {
          durableSession = data.adaptiveState;
        },
      },
      userResponse: {
        findFirst: async () => storedResponse ?? null,
        create: async ({ data }) => {
          responseCreates += 1;
          storedResponse = {
            answer: data.answer,
            isCorrect: data.isCorrect,
            responseTime: data.responseTime,
          };
          return storedResponse;
        },
      },
      applicationOutboxEvent: {
        upsert: async ({ where, create }) => {
          if (!outboxEvents.has(where.dedupeKey)) {
            outboxEvents.set(where.dedupeKey, create);
          }
          return outboxEvents.get(where.dedupeKey);
        },
      },
    }),
    quizAttempt: {
      findFirst: async () => ({ adaptiveState: durableSession }),
    },
  };
  service.loadAdaptiveSession = async () => durableSession;
  service.cacheAdaptiveSession = async value => {
    cachedSession = JSON.stringify(value);
  };
  service.isAdaptiveQuestionVisible = async () => true;
  service.findAdaptiveQuestion = async () => nextQuestion;
  service.analyticsServiceGrpc = {
    getNextAdaptiveQuestion: () => ({}),
  };
  service.callGrpcWithTimeout = async () => ({ questionId: 'question-2' });
  service.performanceMetrics = { recordMetric: async () => undefined };
  service.logger = { error: () => undefined };

  return {
    service,
    responseCreates: () => responseCreates,
    getOutboxEvents: () => [...outboxEvents.values()],
    getDurableSession: () => structuredClone(durableSession),
    getCachedSession: () => JSON.parse(cachedSession),
  };
}

(async () => {
  const context = makeService();
  const dto = {
    userId: 'student-1',
    questionId: 'question-1',
    answerData: 'option-1',
    timeSpentSeconds: 12,
  };
  const firstResult = await context.service.submitAnswer(
    'session-1',
    dto,
    4,
  );
  assert.equal(firstResult.isCorrect, true);
  assert.equal(firstResult.nextQuestion.id, 'question-2');
  assert.equal(context.getDurableSession().currentQuestionIndex, 1);
  assert.equal(context.getDurableSession().responses.length, 1);
  assert.equal(context.getCachedSession().currentQuestionIndex, 1);
  assert.deepEqual(context.getOutboxEvents(), [
    {
      eventType: 'adaptive-answer.submitted',
      aggregateId: 'session-1',
      dedupeKey: 'adaptive-quiz:session-1:question-1:topic-1',
      payload: {
        userId: 'student-1',
        skillId: 'topic-1',
        isCorrect: true,
        eventId: 'adaptive-quiz:session-1:question-1:topic-1',
      },
    },
  ]);
  assert.equal(context.responseCreates(), 1);

  const retryResult = await context.service.submitAnswer(
    'session-1',
    dto,
    4,
  );
  assert.equal(retryResult.isCorrect, true);
  assert.equal(retryResult.nextQuestion.id, 'question-2');
  assert.equal(context.getOutboxEvents().length, 1);
  assert.equal(context.responseCreates(), 1);
  assert.equal(context.getCachedSession().responses.length, 1);

  await assert.rejects(
    context.service.submitAnswer(
      'session-1',
      { ...dto, answerData: 'different-option' },
      4,
    ),
    error => error instanceof ConflictException,
  );
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
"""
    )
