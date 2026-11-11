from ts_runtime import run_typescript


def test_unit_question_discovery_checks_publication_before_cache():
    run_typescript(
        r"""
const assert = require('node:assert/strict');
const { NotFoundException } = require('@nestjs/common');
const { QuizService } =
  require('./src/modules/education/assessment/services/quiz.service.ts');

function makeService(unit, quizVersions = [], quiz = null) {
  let cacheReads = 0;
  let cacheKey;
  const service = Object.create(QuizService.prototype);
  service.prisma = {
    unit: { findUnique: async () => unit },
    quiz: {
      findMany: async () => quizVersions,
      findFirst: async () => quiz,
    },
    question: { findMany: async () => [] },
  };
  service.redisService = {
    get: async key => {
      cacheReads += 1;
      cacheKey = key;
      return null;
    },
    set: async () => undefined,
    del: async () => undefined,
  };
  service.logger = { debug: () => undefined, warn: () => undefined };
  return {
    service,
    cacheReads: () => cacheReads,
    cacheKey: () => cacheKey,
  };
}

(async () => {
  const publishedQuiz = {
    id: 'quiz-1',
    isPublished: true,
    updatedAt: new Date('2025-01-01T00:00:00Z'),
  };
  const publicQuestion = {
    id: 'question-1',
    createdAt: new Date('2025-01-01T00:00:00Z'),
    options: [{ id: 'option-1', text: 'Option', order: 0 }],
  };
  const published = makeService(
    { isPublished: true, course: { status: 'published' } },
    [publishedQuiz],
    { questions: [{ question: publicQuestion }] },
  );
  const questions = await published.service.getQuestionsByUnit('unit-1');
  assert.equal(questions.length, 1);
  assert.equal(questions[0].id, 'question-1');

  for (const unit of [
    { isPublished: false, course: { status: 'published' } },
    { isPublished: true, course: { status: 'draft' } },
    null,
  ]) {
    const inaccessible = makeService(unit, [publishedQuiz]);
    await assert.rejects(
      inaccessible.service.getQuestionsByUnit('unit-1'),
      error => error instanceof NotFoundException,
    );
    assert.equal(inaccessible.cacheReads(), 0);
  }

  const unpublishedQuiz = makeService(
    { isPublished: true, course: { status: 'published' } },
    [{ ...publishedQuiz, isPublished: false }],
    { questions: [{ question: publicQuestion }] },
  );
  assert.deepEqual(
    await unpublishedQuiz.service.getQuestionsByUnit('unit-1'),
    [],
  );
  assert.equal(unpublishedQuiz.cacheReads(), 1);
  assert.match(unpublishedQuiz.cacheKey(), /:draft:/);
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
"""
    )


def test_topic_question_discovery_filters_quiz_publication_and_checks_parent():
    run_typescript(
        r"""
const assert = require('node:assert/strict');
const { NotFoundException } = require('@nestjs/common');
const { QuizService } =
  require('./src/modules/education/assessment/services/quiz.service.ts');

function makeService(topic, quizVersions = [], standaloneQuestions = []) {
  let cacheKey;
  let questionWhere;
  const service = Object.create(QuizService.prototype);
  service.prisma = {
    topic: { findUnique: async () => topic },
    quiz: { findMany: async () => quizVersions },
    question: {
      findMany: async args => {
        questionWhere = args.where;
        return standaloneQuestions;
      },
    },
  };
  service.redisService = {
    get: async key => {
      cacheKey = key;
      return null;
    },
    set: async () => undefined,
    del: async () => undefined,
  };
  service.logger = { debug: () => undefined, warn: () => undefined };
  return {
    service,
    cacheKey: () => cacheKey,
    questionWhere: () => questionWhere,
  };
}

(async () => {
  const topic = {
    id: 'topic-1',
    unitId: 'unit-1',
    unit: {
      id: 'unit-1',
      isPublished: true,
      course: { status: 'published' },
    },
  };
  const draftQuiz = {
    id: 'quiz-1',
    isPublished: false,
    updatedAt: new Date('2025-01-02T00:00:00Z'),
  };
  const inaccessible = makeService(
    { ...topic, unit: { ...topic.unit, isPublished: false } },
    [draftQuiz],
  );
  await assert.rejects(
    inaccessible.service.getQuestionsByTopic('topic-1'),
    error => error instanceof NotFoundException,
  );
  assert.equal(inaccessible.cacheKey(), undefined);

  const standaloneQuestion = {
    id: 'standalone-1',
    createdAt: new Date('2025-01-01T00:00:00Z'),
    options: [{ id: 'option-1', text: 'Option', order: 0 }],
  };
  const publicTopic = makeService(topic, [draftQuiz], [standaloneQuestion]);
  const questions = await publicTopic.service.getQuestionsByTopic('topic-1');
  assert.deepEqual(questions.map(question => question.id), ['standalone-1']);
  assert.match(publicTopic.cacheKey(), /:draft:/);
  assert.deepEqual(publicTopic.questionWhere().quizQuestions, { none: {} });

  const noQuestions = makeService(topic, [draftQuiz], []);
  assert.deepEqual(await noQuestions.service.getQuestionsByTopic('topic-1'), []);
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
"""
    )


def test_assessment_id_discovery_checks_parent_publication():
    run_typescript(
        r"""
const assert = require('node:assert/strict');
const { NotFoundException } = require('@nestjs/common');
const { QuizService } =
  require('./src/modules/education/assessment/services/quiz.service.ts');

const service = Object.create(QuizService.prototype);
service.prisma = {
  quiz: {
    findFirst: async () => ({
      id: 'quiz-1',
      unitId: 'unit-1',
      topicId: null,
      unit: { isPublished: false, course: { status: 'published' } },
      topic: null,
      questions: [],
    }),
  },
};

(async () => {
  await assert.rejects(
    service.getQuestionsByAssessmentId('quiz-1', 'student-1'),
    error => error instanceof NotFoundException,
  );
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
"""
    )


def test_published_quiz_list_filters_unpublished_parents():
    run_typescript(
        r"""
const assert = require('node:assert/strict');
const { QuizService } =
  require('./src/modules/education/assessment/services/quiz.service.ts');

let query;
const service = Object.create(QuizService.prototype);
service.prisma = {
  quiz: {
    findMany: async args => { query = args.where; return []; },
    count: async () => 0,
  },
};
service.redisService = {
  get: async () => null,
  set: async () => undefined,
};
service.logger = { log: () => undefined, warn: () => undefined };

(async () => {
  await service.findMany({ page: 1, limit: 10 }, { isPublished: true });
  assert.equal(query.isPublished, true);
  assert.equal(query.AND.length, 2);
  assert.ok(query.AND[0].OR.some(condition => condition.unit));
  assert.ok(query.AND[1].OR.some(condition => condition.topic));
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
"""
    )


def test_quiz_unpublish_invalidates_discovery_and_list_caches():
    run_typescript(
        r"""
const assert = require('node:assert/strict');
const { QuizService } =
  require('./src/modules/education/assessment/services/quiz.service.ts');

const existingQuiz = {
  id: 'quiz-1',
  unitId: 'unit-1',
  topicId: 'topic-1',
  createdBy: 'instructor-1',
};
const deletedKeys = [];
const deletedPatterns = [];
let membershipUpdated = false;
const service = Object.create(QuizService.prototype);
service.prisma = {
  quiz: { findUnique: async () => existingQuiz },
  $transaction: async callback => callback({
    quizQuestion: {
      deleteMany: async () => { membershipUpdated = true; },
      createMany: async () => { membershipUpdated = true; },
    },
    quiz: {
      update: async () => ({
        ...existingQuiz,
        isPublished: false,
        updatedAt: new Date('2025-01-02T00:00:00Z'),
      }),
    },
  }),
};
service.redisService = {
  del: async key => { deletedKeys.push(key); },
  delPattern: async pattern => { deletedPatterns.push(pattern); },
};
service.searchSync = { syncEntity: async () => undefined };
service.logger = { error: () => undefined, log: () => undefined };

(async () => {
  const oldKey = service.getUnitQuestionsCacheKey('unit-1', [{
    id: 'quiz-1',
    isPublished: true,
    updatedAt: new Date('2025-01-01T00:00:00Z'),
  }]);
  const newKey = service.getUnitQuestionsCacheKey('unit-1', [{
    id: 'quiz-1',
    isPublished: false,
    updatedAt: new Date('2025-01-02T00:00:00Z'),
  }]);
  assert.notEqual(oldKey, newKey);
  await service.update(
    'quiz-1',
    { isPublished: false, questions: ['question-2'] },
    'instructor-1',
  );
  assert.equal(membershipUpdated, true);
  assert.ok(deletedPatterns.includes('quizzes:*'));
  assert.ok(deletedPatterns.includes('unit:*:questions:v3:*'));
  assert.ok(deletedPatterns.includes('topic:*:questions:v3:*'));
  assert.ok(deletedKeys.includes('quiz:quiz-1'));
  assert.ok(deletedKeys.includes('unit_quiz:unit-1'));
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
"""
    )


def test_hiding_question_invalidates_question_discovery_caches():
    run_typescript(
        r"""
const assert = require('node:assert/strict');
const { InstructorOverrideService } =
  require('./src/modules/education/courses/services/instructor-override.service.ts');

const patterns = [];
const service = Object.create(InstructorOverrideService.prototype);
service.prisma = {
  question: {
    findUnique: async () => ({ unitId: 'unit-1', topicIds: ['topic-1'] }),
    update: async () => undefined,
  },
  instructorOverride: { create: async () => undefined },
};
service.redisService = {
  del: async () => undefined,
  delPattern: async pattern => { patterns.push(pattern); },
};
service.notifyAffectedStudents = async () => undefined;
service.logger = { log: () => undefined };

(async () => {
  await service.applyOverride({
    instructorId: 'instructor-1',
    questionId: 'question-1',
    action: 'hide',
  });
  assert.ok(patterns.includes('unit:*:questions:v3:*'));
  assert.ok(patterns.includes('topic:*:questions:v3:*'));
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
"""
    )


def test_course_cache_invalidation_matches_recommendation_v2_key():
    run_typescript(
        r"""
const assert = require('node:assert/strict');
const { Module } = require('node:module');
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === '../../../auth/services/users.service') {
    return { UsersService: class UsersService {} };
  }
  if (request === '../../../ai-analytics/services/ai-analytics.service') {
    return { AiAnalyticsService: class AiAnalyticsService {} };
  }
  if (request === '#common/utils/fts.utils') {
    return { FtsUtils: {} };
  }
  return originalLoad.call(this, request, parent, isMain);
};
const { CoursesService } =
  require('./src/modules/education/courses/services/courses.service.ts');

const patterns = [];
const service = Object.create(CoursesService.prototype);
service.CACHE_PREFIX = 'course';
service.redisService = {
  del: async () => undefined,
  delPattern: async pattern => { patterns.push(pattern); },
};
service.logger = { debug: () => undefined, error: () => undefined };

(async () => {
  await service.clearCache({ id: 'course-1', code: 'MED-101' });
  assert.ok(patterns.includes('course:recommended-v2:*'));
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
"""
    )


def test_adaptive_question_lookup_requires_published_parent_content():
    run_typescript(
        r"""
const assert = require('node:assert/strict');
const { AssessmentAnalyticsService } =
  require('./src/modules/ai-analytics/services/assessment-analytics.service.ts');

let query;
const service = Object.create(AssessmentAnalyticsService.prototype);
service.prisma = {
  question: {
    findFirst: async args => {
      query = args.where;
      return null;
    },
  },
};

(async () => {
  await service.findAdaptiveQuestion('question-1', {
    questions: [],
    courseId: 'course-1',
    unitId: 'unit-1',
  });
  assert.equal(query.unitId, 'unit-1');
  assert.deepEqual(query.AND[0].OR[2].unit.is, {
    isPublished: true,
    course: { is: { status: 'published' } },
  });
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
"""
    )


def test_adaptive_session_handles_missing_question_and_response_data():
    run_typescript(
        r"""
const assert = require('node:assert/strict');
const { AssessmentAnalyticsService } =
  require('./src/modules/ai-analytics/services/assessment-analytics.service.ts');

const service = Object.create(AssessmentAnalyticsService.prototype);
service.prisma = {
  question: {
    findFirst: async () => null,
  },
};

(async () => {
  const where = service.getAdaptiveQuestionWhere('question-1', {
    courseId: 'course-1',
  });
  assert.equal(where.id.equals, 'question-1');
  assert.deepEqual(where.id.notIn, []);

  assert.equal(
    service.shouldContinueQuiz({
      responses: undefined,
      confidenceInterval: 0.2,
      targetPrecision: 0.3,
    }),
    true,
  );

  assert.equal(
    await service.isAdaptiveQuestionVisible('question-1', {
      questions: undefined,
      courseId: 'course-1',
    }),
    false,
  );
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
"""
    )
