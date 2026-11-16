from ts_runtime import run_typescript


def test_question_bank_filters_transform_and_reject_invalid_values():
    run_typescript(
        r"""
const assert = require('node:assert/strict');
const { plainToInstance } = require('class-transformer');
const { validateSync } = require('class-validator');
const { QuestionBankFilterDto } =
  require('./src/common/dto/question-bank.dto.ts');

const filters = plainToInstance(QuestionBankFilterDto, {
  search: '  cardio  ',
  tags: 'heart, cardiac',
  page: '2',
  limit: '40',
  isActive: 'false',
  sortOrder: 'asc',
});
assert.equal(filters.search, 'cardio');
assert.deepEqual(filters.tags, ['heart', 'cardiac']);
assert.equal(filters.page, 2);
assert.equal(filters.limit, 40);
assert.equal(filters.isActive, false);
assert.equal(filters.sortOrder, 'ASC');
assert.deepEqual(validateSync(filters), []);

const invalidFilters = plainToInstance(QuestionBankFilterDto, {
  isActive: 'sometimes',
  sortBy: 'notAQuestionField',
});
assert.ok(validateSync(invalidFilters).some(error => error.property === 'isActive'));
assert.ok(validateSync(invalidFilters).some(error => error.property === 'sortBy'));

const omittedArrays = plainToInstance(QuestionBankFilterDto, {});
assert.deepEqual(validateSync(omittedArrays), []);
"""
    )


def test_quiz_attempt_answer_dto_accepts_single_and_multiple_option_ids():
    run_typescript(
        r"""
const assert = require('node:assert/strict');
const { plainToInstance } = require('class-transformer');
const { validateSync } = require('class-validator');
const { SaveQuizAttemptAnswerDto } =
  require('./src/common/dto/assessment.dto.ts');

for (const selectedOption of ['option-1', ['option-1', 'option-2']]) {
  const answer = plainToInstance(SaveQuizAttemptAnswerDto, {
    questionId: 'question-1',
    selectedOption,
  });
  assert.deepEqual(validateSync(answer), []);
}

const invalidAnswer = plainToInstance(SaveQuizAttemptAnswerDto, {
  questionId: 'question-1',
  selectedOption: ['option-1', 42],
});
assert.ok(validateSync(invalidAnswer).some(error => error.property === 'selectedOption'));
"""
    )


def test_weakness_quiz_fallback_excludes_already_selected_questions():
    run_typescript(
        r"""
const assert = require('node:assert/strict');
const { QuizGenerationService } =
  require('./src/modules/education/assessment/services/quiz-generation.service.ts');

const service = Object.create(QuizGenerationService.prototype);
const questionQueries = [];
service.prisma = {
  userResponse: {
    findMany: async () => [{ questionId: 'recent-question' }],
  },
  question: {
    findMany: async ({ where, take }) => {
      questionQueries.push(where);
      if (questionQueries.length === 1) {
        return [
          { id: 'selected-1', unitId: 'unit-1' },
          { id: 'selected-2', unitId: 'unit-1' },
        ];
      }
      const excludedIds = where.id.notIn;
      return [
        { id: 'selected-1', unitId: 'unit-1' },
        { id: 'selected-2', unitId: 'unit-1' },
        { id: 'fallback-1', unitId: 'unit-1' },
      ]
        .filter(question => !excludedIds.includes(question.id))
        .slice(0, take);
    },
  },
};

(async () => {
  const questions = await service.selectTargetedQuestions(
    'topic-1',
    3,
    'user-1',
  );
  assert.deepEqual(questions.map(question => question.id), [
    'selected-1',
    'selected-2',
    'fallback-1',
  ]);
  assert.deepEqual(questionQueries[1].id.notIn, ['selected-1', 'selected-2']);
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
"""
    )


def test_question_bank_search_matches_partial_tags_case_insensitively():
    run_typescript(
        r"""
const assert = require('node:assert/strict');
const { QuestionBankService } =
  require('./src/modules/education/assessment/services/question-bank.service.ts');

const service = Object.create(QuestionBankService.prototype);
let tagSearchParameters;
let questionWhere;
service.prisma = {
  $queryRaw: async (query, searchTerm) => {
    tagSearchParameters = { query, searchTerm };
    return [{ id: 'tagged-question' }];
  },
  question: {
    findMany: async ({ where }) => {
      questionWhere = where;
      return [];
    },
    count: async ({ where }) => {
      assert.equal(where, questionWhere);
      return 1;
    },
  },
};
service.redisService = {
  get: async () => null,
  set: async () => undefined,
};
service.config = { questionCacheTTL: 60 };

(async () => {
  const result = await service.findQuestions({ search: '  Cardio  ' });
  assert.equal(tagSearchParameters.searchTerm, 'Cardio');
  assert.ok(
    tagSearchParameters.query.join('').includes('unnest(q.tags)'),
  );
  assert.deepEqual(questionWhere.OR[1], { id: { in: ['tagged-question'] } });
  assert.equal(result.pagination.total, 1);
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
"""
    )


def test_creating_same_question_twice_does_not_return_stale_cached_question():
    run_typescript(
        r"""
const assert = require('node:assert/strict');
const { QuestionBankService } =
  require('./src/modules/education/assessment/services/question-bank.service.ts');

const service = Object.create(QuestionBankService.prototype);
let createdCount = 0;
const invalidatedPatterns = [];
service.prisma = {
  $transaction: async callback => callback({
    question: {
      create: async () => ({ id: `question-${++createdCount}` }),
      findUnique: async ({ where }) => ({ id: where.id }),
    },
    option: { createMany: async () => undefined },
  }),
};
service.redisService = {
  get: async () => {
    throw new Error('Question creation must not read a stale create cache');
  },
  delPattern: async pattern => {
    invalidatedPatterns.push(pattern);
  },
  del: async () => undefined,
};

const input = {
  questionText: 'A sufficiently long question for validation?',
  type: 'multiple_choice',
  difficulty: 'medium',
  category: 'general',
  options: [
    { text: 'Correct', isCorrect: true },
    { text: 'Incorrect', isCorrect: false },
  ],
};

(async () => {
  const first = await service.createQuestion(input, 'author-1');
  const second = await service.createQuestion(input, 'author-1');
  assert.equal(first.id, 'question-1');
  assert.equal(second.id, 'question-2');
  assert.equal(createdCount, 2);
  assert.ok(invalidatedPatterns.includes('adaptive_quiz_questions:*'));
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
"""
    )
