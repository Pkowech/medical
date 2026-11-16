from ts_runtime import run_typescript


def test_quiz_attempt_creation_enforces_attempt_limit_atomically():
    run_typescript(
        r"""
const assert = require('node:assert/strict');
const { MaxAttemptsExceededException } =
  require('./src/common/exceptions/quiz.exception.ts');
const { QuizService } =
  require('./src/modules/education/assessment/services/quiz.service.ts');

const quiz = {
  id: 'quiz-1',
  unitId: 'unit-1',
  topicId: null,
  isPublished: true,
  maxAttempts: 1,
  timeLimit: 30,
  shuffleQuestions: false,
  showResults: false,
  passingScore: 70,
  availableFrom: null,
  availableUntil: null,
  expiresAt: null,
  questions: [
    { questionId: 'question-1', order: 1, points: 2, isRequired: true, question: {
      id: 'question-1', text: 'Original prompt', type: 'multiple_choice',
      points: 1, topicIds: [], options: [
        { id: 'option-1', text: 'Correct', isCorrect: true, order: 0 },
      ],
    } },
    { questionId: 'question-2', order: 2, points: 1, isRequired: true, question: {
      id: 'question-2', text: 'Second prompt', type: 'multiple_choice',
      points: 1, topicIds: [], options: [
        { id: 'option-2', text: 'Correct', isCorrect: true, order: 0 },
      ],
    } },
  ],
  unit: { isPublished: true, course: { status: 'published' } },
  topic: null,
};
const attempts = [];
let transactionTail = Promise.resolve();
let lockedQuizRows = 0;
const attemptQuiz = {
  id: quiz.id,
  unitId: quiz.unitId,
  timeLimit: quiz.timeLimit,
  showResults: quiz.showResults,
};
const tx = {
  $queryRaw: async () => {
    lockedQuizRows += 1;
    return [];
  },
  quiz: { findUnique: async () => quiz },
  quizAttempt: {
    findUnique: async ({ where }) =>
      attempts.find(attempt => attempt.id === where.id) ?? null,
    count: async () => attempts.length,
    create: async ({ data }) => {
      const attempt = {
        ...data,
        completedAt: null,
        quiz: attemptQuiz,
      };
      attempts.push(attempt);
      return attempt;
    },
  },
  quizAttemptQuestionSnapshot: {
    create: async ({ data }) => {
      const attempt = attempts.find(item => item.id === data.attemptId);
      attempt.questionSnapshot = {
        snapshot: JSON.parse(JSON.stringify(data.snapshot)),
      };
      return attempt.questionSnapshot;
    },
  },
};
const service = Object.create(QuizService.prototype);
service.prisma = {
  quizAttempt: {
    findUnique: async ({ where }) =>
      attempts.find(attempt => attempt.id === where.id) ?? null,
  },
  quiz: { findFirst: async () => quiz },
  $transaction: async callback => {
    const previous = transactionTail;
    let release;
    transactionTail = new Promise(resolve => { release = resolve; });
    await previous;
    try {
      return await callback(tx);
    } finally {
      release();
    }
  },
};

(async () => {
  const firstId = '123e4567-e89b-42d3-a456-426614174000';
  const secondId = '123e4567-e89b-42d3-a456-426614174001';
  const outcomes = await Promise.allSettled([
    service.startQuizAttempt('student-1', 'unit-1', firstId),
    service.startQuizAttempt('student-1', 'unit-1', secondId),
  ]);
  assert.equal(outcomes.filter(outcome => outcome.status === 'fulfilled').length, 1);
  assert.equal(outcomes.filter(outcome => outcome.status === 'rejected').length, 1);
  const rejection = outcomes.find(outcome => outcome.status === 'rejected');
  assert.ok(rejection.reason instanceof MaxAttemptsExceededException);
  assert.equal(lockedQuizRows, 2);

  const acceptedId = attempts[0].id;
  const originalText = attempts[0].questionSnapshot.snapshot.questions[0].question.text;
  quiz.questions[0].question.text = 'Edited after attempt start';
  const resumed = await service.startQuizAttempt('student-1', 'unit-1', acceptedId);
  assert.deepEqual(resumed.questionIds, ['question-1', 'question-2']);
  assert.equal(resumed.questions[0].text, originalText);
  assert.equal('isCorrect' in resumed.questions[0].options[0], false);
  assert.equal(resumed.showResults, false);
  assert.equal(resumed.timeLimit, 30);
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
"""
    )


def test_attempt_answer_saves_without_returning_correctness_and_rejects_late_answers():
    run_typescript(
        r"""
const assert = require('node:assert/strict');
const { ConflictException } = require('@nestjs/common');
const { QuizService } =
  require('./src/modules/education/assessment/services/quiz.service.ts');

const attempt = {
  id: '123e4567-e89b-42d3-a456-426614174000',
  userId: 'student-1',
  quizId: 'quiz-1',
  startedAt: new Date(),
  completedAt: null,
  answers: [{ questionId: 'question-1', selectedOption: null }],
  quiz: { timeLimit: 30 },
};
const service = Object.create(QuizService.prototype);
service.prisma = {
  $transaction: async callback => callback({
    $queryRaw: async () => [],
    quizAttempt: {
      findUnique: async () => attempt,
      update: async ({ data }) => {
        attempt.answers = data.answers;
        return attempt;
      },
    },
    option: {
      findFirst: async () => ({ id: 'option-1' }),
      findMany: async ({ where }) =>
        where.id.in
          .filter(id => ['option-1', 'option-2'].includes(id))
          .map(id => ({ id })),
    },
  }),
};

(async () => {
  const result = await service.saveQuizAttemptAnswer(
    'student-1',
    attempt.id,
    'question-1',
    'option-1',
  );
  assert.deepEqual(result, { saved: true });
  assert.deepEqual(attempt.answers, [
    { questionId: 'question-1', selectedOption: 'option-1' },
  ]);
  assert.equal('correct' in result, false);
  assert.equal('explanation' in result, false);

  await service.saveQuizAttemptAnswer(
    'student-1',
    attempt.id,
    'question-1',
    ['option-1', 'option-2'],
  );
  assert.deepEqual(attempt.answers, [
    { questionId: 'question-1', selectedOption: ['option-1', 'option-2'] },
  ]);
  await assert.rejects(
    service.saveQuizAttemptAnswer(
      'student-1',
      attempt.id,
      'question-1',
      ['option-1', 'option-1'],
    ),
  );

  attempt.startedAt = new Date(Date.now() - 31 * 60_000);
  await assert.rejects(
    service.saveQuizAttemptAnswer(
      'student-1',
      attempt.id,
      'question-1',
      'option-1',
    ),
    error => error instanceof ConflictException,
  );
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
"""
    )


def test_attempted_quizzes_cannot_be_edited_or_deleted():
    run_typescript(
        r"""
const assert = require('node:assert/strict');
const { ConflictException } = require('@nestjs/common');
const { QuizService } =
  require('./src/modules/education/assessment/services/quiz.service.ts');

const service = Object.create(QuizService.prototype);
service.prisma = {
  quiz: {
    findUnique: async () => ({ id: 'quiz-1', createdBy: 'instructor-1' }),
    delete: async () => {
      throw new Error('Attempted quiz must not be deleted');
    },
  },
  $transaction: async callback => callback({
    $queryRaw: async () => [],
    quizAttempt: { count: async () => 1 },
  }),
};

(async () => {
  await assert.rejects(
    service.update('quiz-1', { title: 'Changed' }, 'instructor-1'),
    error => error instanceof ConflictException,
  );
  await assert.rejects(
    service.delete('quiz-1', 'instructor-1'),
    error => error instanceof ConflictException,
  );
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
"""
    )


def test_answer_key_overrides_are_blocked_for_attempted_quizzes():
    run_typescript(
        r"""
const assert = require('node:assert/strict');
const { ConflictException } = require('@nestjs/common');
const { InstructorOverrideService } =
  require('./src/modules/education/courses/services/instructor-override.service.ts');

const service = Object.create(InstructorOverrideService.prototype);
service.prisma = {
  question: {
    findUnique: async () => ({
      unitId: 'unit-1',
      topicIds: [],
      quizQuestions: [{ quizId: 'quiz-1' }],
    }),
  },
  $transaction: async callback => callback({
    $queryRaw: async () => [],
    quizAttempt: { count: async () => 1 },
    instructorOverride: {
      create: async () => {
        throw new Error('Rejected override should not be recorded');
      },
    },
    question: { update: async () => undefined },
  }),
};

(async () => {
  await assert.rejects(
    service.applyOverride({
      instructorId: 'instructor-1',
      questionId: 'question-1',
      action: 'update_explanation',
      newExplanation: 'Changed',
    }),
    error => error instanceof ConflictException,
  );
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
"""
    )


def test_results_are_withheld_when_quiz_disables_them():
    run_typescript(
        r"""
const assert = require('node:assert/strict');
const { QuizService } =
  require('./src/modules/education/assessment/services/quiz.service.ts');

const service = Object.create(QuizService.prototype);
service.prisma = {
  quizAttempt: {
    findMany: async () => [{
      id: 'attempt-1',
      userId: 'student-1',
      quizId: 'quiz-1',
      score: 100,
      percentage: 100,
      isPassed: true,
      correctAnswers: 3,
      totalQuestions: 3,
      answers: [{ questionId: 'question-1', selectedOption: 'option-1' }],
      feedback: { diagnosis: 'answer-data' },
      startedAt: new Date(),
      completedAt: new Date(),
      timeTaken: 60,
      createdAt: new Date(),
      quiz: { showResults: false },
    }],
  },
};
service.redisService = {
  get: async () => null,
  set: async () => undefined,
};
service.logger = { warn: () => undefined };

(async () => {
  const result = await service.getUserQuizResults('student-1', 'unit-1');
  assert.equal(result.averageScore, null);
  assert.equal(result.attempts[0].resultsAvailable, false);
  assert.equal('score' in result.attempts[0], false);
  assert.equal('answers' in result.attempts[0], false);
  assert.equal('feedback' in result.attempts[0], false);
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
"""
    )


def test_submission_replay_survives_recommendation_generation_failure():
    run_typescript(
        r"""
const assert = require('node:assert/strict');
const { QuizService } =
  require('./src/modules/education/assessment/services/quiz.service.ts');

const attempt = {
  id: '123e4567-e89b-42d3-a456-426614174000',
  userId: 'student-1',
  quizId: 'quiz-1',
  answers: [{ questionId: 'question-1', selectedOption: 'option-1' }],
  responses: [{ questionId: 'question-1', isCorrect: true }],
  questionSnapshot: {
    snapshot: {
      questions: [{
        question: { options: [{ id: 'option-1', isCorrect: true }] },
      }],
    },
  },
  feedback: null,
  completedAt: new Date(),
};
const quiz = {
  id: 'quiz-1',
  topicId: 'topic-1',
  unitId: 'unit-1',
  showResults: true,
  unit: { courseId: 'course-1' },
};
const service = Object.create(QuizService.prototype);
service.recommendationService = {
  recommendForAnswers: async () => {
    throw new Error('recommendation service unavailable');
  },
};
service.logger = { error: () => undefined };
service.prisma = {
  quizAttempt: {
    update: async () => {
      throw new Error('A failed recommendation must not be persisted');
    },
  },
};

(async () => {
  const result = await service.replayQuizSubmission(
    attempt,
    quiz,
    'student-1',
    '[{"questionId":"question-1","selectedOption":"option-1"}]',
  );
  assert.equal(result.id, attempt.id);
  assert.equal(result.resultsAvailable, true);
  assert.equal(result.recommendationsAvailable, false);
  assert.equal('recommendations' in result, false);
  assert.equal(JSON.stringify(result).includes('"isCorrect"'), false);
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
"""
    )


def test_submission_scores_against_the_quiz_question_weight():
    run_typescript(
        r"""
const assert = require('node:assert/strict');
const { QuizService } =
  require('./src/modules/education/assessment/services/quiz.service.ts');

const attemptId = '123e4567-e89b-42d3-a456-426614174000';
const startedAt = new Date(Date.now() - 5_000);
const storedAttempt = {
  id: attemptId,
  userId: 'student-1',
  quizId: 'quiz-1',
  startedAt,
  completedAt: null,
  answers: [{ questionId: 'question-1', selectedOption: 'option-correct' }],
  questionSnapshot: {
    snapshot: {
      version: 1,
      quizId: 'quiz-1',
      passingScore: 70,
      questions: [{
        questionId: 'question-1',
        order: 0,
        points: 5,
        isRequired: true,
        question: {
          id: 'question-1',
          text: 'Original prompt',
          type: 'multiple_choice',
          points: 2,
          topicIds: [],
          options: [{ id: 'option-correct', text: 'Correct', isCorrect: true, order: 0 }],
        },
      }],
    },
  },
  responses: [],
  quiz: {
    id: 'quiz-1',
    unitId: 'unit-1',
    topicId: null,
    showResults: true,
    timeLimit: 10,
    unit: { courseId: 'course-1' },
  },
};
const quiz = {
  id: 'quiz-1',
  title: 'Quiz',
  unitId: 'unit-1',
  topicId: null,
  isPublished: true,
  showResults: true,
  timeLimit: 10,
  maxAttempts: 1,
  passingScore: 99,
  questions: [{
    questionId: 'question-1',
    points: 100,
    question: {
      id: 'question-1',
      type: 'multiple_choice',
      points: 100,
      topicIds: [],
      options: [{ id: 'option-correct', isCorrect: false }],
    },
  }],
  unit: {
    courseId: 'course-1',
    isPublished: true,
    course: { status: 'published' },
  },
  topic: null,
};
let responseRecord;
const txAttempt = { ...storedAttempt };
const service = Object.create(QuizService.prototype);
service.prisma = {
  quizAttempt: {
    findUnique: async () => storedAttempt,
    update: async ({ data }) => {
      Object.assign(txAttempt, data);
      return txAttempt;
    },
  },
  quiz: { findFirst: async () => quiz },
  $transaction: async callback => callback({
    $queryRaw: async () => [],
    quizAttempt: {
      findUnique: async () => txAttempt,
      update: async ({ data }) => {
        Object.assign(txAttempt, data);
        return txAttempt;
      },
    },
    userResponse: {
      create: async ({ data }) => { responseRecord = data; },
    },
    userActivity: { create: async () => undefined },
    autoGeneratedQuiz: { updateMany: async () => ({ count: 0 }) },
    applicationOutboxEvent: { upsert: async () => undefined },
  }),
};
service.redisService = { del: async () => undefined };
service.recommendationService = {
  recommendForAnswers: async () => ({
    topics: [],
    recommendations: [],
  }),
};
service.logger = { log: () => undefined, warn: () => undefined };

(async () => {
  const result = await service.submitQuiz(
    'student-1',
    'unit-1',
    attemptId,
    [{ questionId: 'question-1', selectedOption: 'option-correct' }],
  );
  assert.equal(result.resultsAvailable, true);
  assert.equal(result.maxScore, 5);
  assert.equal(result.isPassed, true);
  assert.equal(responseRecord.score, 5);
  assert.equal(result.timeTaken >= 0, true);
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
"""
    )


def test_assessment_questions_are_not_available_outside_the_window():
    run_typescript(
        r"""
const assert = require('node:assert/strict');
const { NotFoundException } = require('@nestjs/common');
const { QuizService } =
  require('./src/modules/education/assessment/services/quiz.service.ts');

let query;
const service = Object.create(QuizService.prototype);
service.prisma = {
  quiz: {
    findFirst: async args => {
      query = args.where;
      return null;
    },
  },
};

(async () => {
  await assert.rejects(
    service.getQuestionsByAssessmentId('quiz-1', 'student-1'),
    error => error instanceof NotFoundException,
  );
  assert.equal(query.AND.length, 3);
  assert.ok(query.AND.some(condition => condition.OR?.some(
    clause => clause.availableFrom,
  )));
  assert.ok(query.AND.some(condition => condition.OR?.some(
    clause => clause.availableUntil,
  )));
  assert.ok(query.AND.some(condition => condition.OR?.some(
    clause => clause.expiresAt,
  )));
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
"""
    )


def test_active_attempt_can_resume_after_quiz_availability_window_closes():
    run_typescript(
        r"""
const assert = require('node:assert/strict');
const { QuizService } =
  require('./src/modules/education/assessment/services/quiz.service.ts');

const question = { id: 'question-1', options: [] };
const service = Object.create(QuizService.prototype);
service.assertPublishedUnit = async () => undefined;
service.toPublicQuizQuestion = value => value;
service.prisma = {
  quizAttempt: {
    findFirst: async () => ({ quizId: 'quiz-1' }),
  },
  quiz: {
    findFirst: async () => ({ questions: [{ question }] }),
  },
};

(async () => {
  const questions = await service.getQuestionsByUnit('unit-1', 'student-1');
  assert.deepEqual(questions, [question]);
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
"""
    )


def test_assigned_unpublished_quiz_can_start_for_its_assigned_user():
    run_typescript(
        r"""
const assert = require('node:assert/strict');
const { QuizService } =
  require('./src/modules/education/assessment/services/quiz.service.ts');

const quiz = {
  id: 'quiz-1',
  unitId: 'unit-1',
  topicId: null,
  isPublished: false,
  maxAttempts: 1,
  timeLimit: null,
  shuffleQuestions: false,
  showResults: true,
  passingScore: 70,
  availableFrom: null,
  availableUntil: null,
  expiresAt: null,
  questions: [{
    questionId: 'question-1',
    order: 0,
    points: 1,
    isRequired: true,
    question: {
      id: 'question-1',
      text: 'Prompt',
      type: 'multiple_choice',
      points: 1,
      topicIds: [],
      options: [{ id: 'option-1', text: 'Choice', isCorrect: true, order: 0 }],
    },
  }],
  unit: { isPublished: true, course: { status: 'published' } },
  topic: null,
};
const attempts = [];
const service = Object.create(QuizService.prototype);
service.prisma = {
  quizAttempt: {
    findUnique: async () => null,
  },
  quiz: {
    findFirst: async () => quiz,
    findUnique: async () => quiz,
  },
  $transaction: async callback => callback({
    $queryRaw: async () => [],
    quiz: { findUnique: async () => quiz },
    autoGeneratedQuiz: { findFirst: async () => ({ id: 'assignment-1' }) },
    quizAttemptQuestionSnapshot: {
      create: async () => ({ snapshot: {} }),
    },
    quizAttempt: {
      findUnique: async () => null,
      count: async () => 0,
      create: async ({ data }) => {
        const attempt = { ...data, completedAt: null };
        attempts.push(attempt);
        return attempt;
      },
    },
  }),
};

(async () => {
  const result = await service.startQuizAttempt(
    'student-1',
    'quiz-1',
    '123e4567-e89b-42d3-a456-426614174000',
  );
  assert.equal(result.questionIds[0], 'question-1');
  assert.equal(attempts.length, 1);
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
"""
    )


def test_topic_progress_withholds_scores_for_hidden_results():
    run_typescript(
        r"""
const assert = require('node:assert/strict');
const { QuizService } =
  require('./src/modules/education/assessment/services/quiz.service.ts');

const service = Object.create(QuizService.prototype);
service.prisma = {
  topic: { findUnique: async () => ({ id: 'topic-1' }) },
  quizAttempt: {
    findMany: async () => [{
      percentage: 95,
      isPassed: true,
      completedAt: new Date(),
      quiz: { showResults: false },
    }],
  },
};

(async () => {
  const result = await service.getTopicQuizProgress('student-1', 'topic-1');
  assert.equal(result.resultsAvailable, false);
  assert.equal(result.latestScore, null);
  assert.equal('isPassed' in result, false);
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
"""
    )


def test_history_withholds_scores_for_hidden_results():
    run_typescript(
        r"""
const assert = require('node:assert/strict');
const { AssessmentAnalyticsService } =
  require('./src/modules/ai-analytics/services/assessment-analytics.service.ts');

const service = Object.create(AssessmentAnalyticsService.prototype);
service.callGrpc = async () => ({
  attempts: [{
    quizId: 'quiz-1',
    score: 99,
    correctAnswers: 9,
    answers: ['answer-data'],
  }],
});
service.analyticsServiceGrpc = {
  getQuizAttemptHistory: () => ({}),
};
service.prisma = {
  quiz: {
    findMany: async () => [{ id: 'quiz-1', showResults: false }],
  },
};
service.logger = { warn: () => undefined };

(async () => {
  const [attempt] = await service.getQuizAttemptHistory('student-1');
  assert.equal(attempt.resultsAvailable, false);
  assert.equal('score' in attempt, false);
  assert.equal('correctAnswers' in attempt, false);
  assert.equal('answers' in attempt, false);
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
"""
    )


def test_aggregate_analytics_rejects_hidden_results():
    run_typescript(
        r"""
const assert = require('node:assert/strict');
const { ConflictException } = require('@nestjs/common');
const { AssessmentAnalyticsService } =
  require('./src/modules/ai-analytics/services/assessment-analytics.service.ts');

const service = Object.create(AssessmentAnalyticsService.prototype);
service.prisma = {
  quizAttempt: { findFirst: async () => ({ id: 'attempt-1' }) },
};

(async () => {
  await assert.rejects(
    service.generateAnalytics('student-1'),
    error => error instanceof ConflictException,
  );
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
"""
    )


def test_cached_assessment_progress_withholds_hidden_results():
    run_typescript(
        r"""
const assert = require('node:assert/strict');
const { AssessmentProgressService } =
  require('./src/modules/education/assessment/services/assessment-progress.service.ts');

const service = Object.create(AssessmentProgressService.prototype);
service.prisma = {
  quiz: {
    findMany: async () => [{ id: 'quiz-1', showResults: false }],
  },
};
service.redisService = {
  get: async () => JSON.stringify([{
    userId: 'student-1',
    assessmentId: 'quiz-1',
    completionPercentage: 100,
    totalAttempts: 1,
    bestScore: 100,
    isPassed: true,
  }]),
};
service.logger = { log: () => undefined };

(async () => {
  const [progress] = await service.getAllProgress('student-1');
  assert.equal(progress.resultsAvailable, false);
  assert.equal('bestScore' in progress, false);
  assert.equal('isPassed' in progress, false);
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
"""
    )


def test_concurrent_submission_replay_commits_side_effects_once():
    run_typescript(
        r"""
const assert = require('node:assert/strict');
const { QuizService } =
  require('./src/modules/education/assessment/services/quiz.service.ts');

const attemptId = '123e4567-e89b-42d3-a456-426614174000';
const storedAttempt = {
  id: attemptId,
  userId: 'student-1',
  quizId: 'quiz-1',
  startedAt: new Date(),
  completedAt: null,
  answers: [{ questionId: 'question-1', selectedOption: 'option-correct' }],
  feedback: null,
  quiz: {
    id: 'quiz-1',
    unitId: 'unit-1',
    topicId: null,
    showResults: true,
    timeLimit: 10,
    unit: { courseId: 'course-1' },
  },
};
const quiz = {
  id: 'quiz-1',
  title: 'Quiz',
  unitId: 'unit-1',
  topicId: null,
  isPublished: true,
  showResults: true,
  timeLimit: 10,
  maxAttempts: 1,
  passingScore: 70,
  questions: [{
    questionId: 'question-1',
    points: 1,
    question: {
      id: 'question-1',
      type: 'multiple_choice',
      points: 1,
      topicIds: [],
      options: [{ id: 'option-correct', isCorrect: true }],
    },
  }],
  unit: {
    courseId: 'course-1',
    isPublished: true,
    course: { status: 'published' },
  },
  topic: null,
};
const responseRecords = [];
let activityWrites = 0;
let outboxWrites = 0;
let transactionTail = Promise.resolve();
const txAttempt = { ...storedAttempt };
const tx = {
  $queryRaw: async () => [],
  quizAttempt: {
    findUnique: async () => txAttempt,
    update: async ({ data }) => Object.assign(txAttempt, data),
  },
  userResponse: {
    create: async ({ data }) => { responseRecords.push(data); },
  },
  userActivity: {
    create: async () => { activityWrites += 1; },
  },
  autoGeneratedQuiz: { updateMany: async () => ({ count: 0 }) },
  applicationOutboxEvent: { upsert: async () => { outboxWrites += 1; } },
};
const service = Object.create(QuizService.prototype);
service.prisma = {
  quizAttempt: {
    findUnique: async () => ({
      ...txAttempt,
      responses: responseRecords.map(({ questionId, isCorrect }) => ({
        questionId,
        isCorrect,
      })),
      quiz: storedAttempt.quiz,
    }),
    update: async ({ data }) => Object.assign(txAttempt, data),
  },
  quiz: { findFirst: async () => quiz },
  $transaction: async callback => {
    const previous = transactionTail;
    let release;
    transactionTail = new Promise(resolve => { release = resolve; });
    await previous;
    try {
      return await callback(tx);
    } finally {
      release();
    }
  },
};
service.redisService = { del: async () => undefined };
service.recommendationService = {
  recommendForAnswers: async () => ({
    topics: [],
    recommendations: [],
  }),
};
service.logger = { log: () => undefined, warn: () => undefined };

(async () => {
  const [first, replay] = await Promise.all([
    service.submitQuiz('student-1', 'unit-1', attemptId, [
      { questionId: 'question-1', selectedOption: 'option-correct' },
    ]),
    service.submitQuiz('student-1', 'unit-1', attemptId, [
      { questionId: 'question-1', selectedOption: 'option-correct' },
    ]),
  ]);
  assert.equal(first.id, attemptId);
  assert.equal(replay.id, attemptId);
  assert.equal(responseRecords.length, 1);
  assert.equal(activityWrites, 1);
  assert.equal(outboxWrites, 1);
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
"""
    )
