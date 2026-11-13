from ts_runtime import run_typescript


def test_readiness_signal_is_projected_into_detailed_course_progress():
    run_typescript(
        r"""
const assert = require('node:assert/strict');
const { ProgressService } =
  require('./src/modules/education/courses/services/progress.service.ts');
const service = Object.create(ProgressService.prototype);
service.redisService = {
  get: async () => null,
  set: async () => undefined,
};
service.prisma = {
  course: { findUnique: async () => ({ id: 'course-1' }) },
  progress: {
    findMany: async () => [{
      id: 'progress-1',
      userId: 'user-1',
      courseId: 'course-1',
      topicId: 'topic-1',
      materialId: null,
      quizScores: { bestScore: 65, failedAttempts: 2 },
      status: 'inProgress',
      isCompleted: false,
      progressPercentage: 0,
      revision: 1,
    }],
  },
  unit: { findMany: async () => [] },
  material: { findMany: async () => [] },
};
service.calculateCourseProgress = async () => ({
  percentage: 0,
  completedUnits: 0,
});
service.logger = { log: () => undefined, warn: () => undefined, error: () => undefined };

(async () => {
  const result = await service.getUserProgress('user-1', 'course-1');
  assert.equal(result.topicProgress[0].readinessSignal, 'BORDERLINE');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
"""
    )


def test_topic_quiz_response_includes_mastery_gate_decision():
    run_typescript(
        r"""
const assert = require('node:assert/strict');
const { QuizService } =
  require('./src/modules/education/assessment/services/quiz.service.ts');
const attemptId = '00000000-0000-4000-8000-000000000001';
const gateDecision = {
  canProceed: false,
  reason: 'Review is recommended.',
  pKnown: 0.42,
  recommendations: ['Review the topic core concepts'],
  supportOptions: [],
};
const service = Object.create(QuizService.prototype);
service.getVisibleTopic = async () => ({
  id: 'topic-1',
  unitId: 'unit-1',
  unit: { course: { id: 'course-1' } },
});
service.getPublicQuestionWhere = () => ({});
service.ensureTopicPracticeQuiz = async () => ({ id: 'quiz-1' });
service.prisma = {
  question: {
    findMany: async () => [{
      id: 'question-1',
      points: 1,
      options: [{ id: 'option-1', isCorrect: true }],
    }],
  },
  $transaction: async callback => callback({
    quizAttempt: {
      findUnique: async () => ({
        id: attemptId,
        userId: 'user-1',
        quizId: 'quiz-1',
        responses: [{ questionId: 'question-1', answer: ['option-1'] }],
      }),
    },
  }),
};
service.recommendationService = {
  recommendForAnswers: async () => ({ topics: [], recommendations: [] }),
};
service.flashcardsService = { recordTopicQuizReviews: async () => 0 };
service.masteryGateService = {
  onQuizComplete: async () => ({
    topicId: 'topic-1',
    masteryUnlocked: true,
    failedAttempts: 0,
    nextTopicUnlocked: true,
    message: 'Quiz passed.',
    gateDecision,
  }),
};

(async () => {
  const result = await service.submitTopicQuiz(
    'user-1',
    'topic-1',
    attemptId,
    [{ questionId: 'question-1', selectedAnswers: ['option-1'] }],
  );
  assert.deepEqual(result.gateDecision, gateDecision);
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
"""
    )


def test_mastery_readiness_thresholds_match_topic_quiz_threshold():
    run_typescript(
        r"""
const assert = require('node:assert/strict');
const { getReadinessSignal, DEFAULT_MASTERY_PASSING_THRESHOLD } =
  require('./src/modules/education/courses/types/mastery.types.ts');

assert.equal(DEFAULT_MASTERY_PASSING_THRESHOLD, 70);
assert.equal(getReadinessSignal(70), 'SAFE');
assert.equal(getReadinessSignal(50), 'BORDERLINE');
assert.equal(getReadinessSignal(49), 'NOT_READY');
"""
    )
