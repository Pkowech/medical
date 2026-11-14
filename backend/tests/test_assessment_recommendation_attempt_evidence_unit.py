from ts_runtime import run_typescript


def test_prerequisite_evidence_counts_completed_attempts_not_responses():
    run_typescript(
        r"""
const assert = require('node:assert/strict');
const {
  AssessmentRecommendationService,
} = require('./src/modules/education/assessment/services/assessment-recommendation.service.ts');

const currentAttemptId = 'current-attempt';
const prerequisiteResponses = [
  false,
  false,
  false,
].map(isCorrect => ({
  attemptId: 'one-prior-attempt',
  isCorrect,
  question: { unitId: 'prerequisite-unit', topicIds: [] },
}));
const queryCalls = [];
const service = Object.create(AssessmentRecommendationService.prototype);
service.prisma = {
  question: {
    findMany: async () => [{
      id: 'target-question',
      topicIds: ['target-topic'],
      unitId: 'target-unit',
    }],
  },
  topic: {
    findMany: async () => [{
      id: 'target-topic',
      name: 'Target topic',
      unitId: 'target-unit',
      unit: {
        id: 'target-unit',
        name: 'Target unit',
        title: null,
        courseId: 'target-course',
        course: { id: 'target-course', name: 'Target course', title: null },
      },
    }],
  },
  unitRelation: {
    findMany: async () => [{
      targetUnitId: 'target-unit',
      sourceUnit: {
        id: 'prerequisite-unit',
        name: 'Prerequisite unit',
        title: null,
        courseId: 'prerequisite-course',
        topics: [{ id: 'prerequisite-topic', name: 'Prerequisite topic' }],
      },
    }],
  },
  course: { findMany: async () => [] },
  userResponse: {
    findMany: async query => {
      queryCalls.push(query);
      return query.where.question.OR ? prerequisiteResponses : [];
    },
  },
  material: { findMany: async () => [] },
};

(async () => {
  const result = await service.recommendForAnswers(
    'user-1',
    { topicId: 'target-topic', unitId: 'target-unit', courseId: 'target-course' },
    [{ questionId: 'target-question', isCorrect: false }],
    currentAttemptId,
  );

  assert.equal(result.topics.length, 1);
  assert.equal(result.topics[0].diagnosis, 'insufficient_evidence');
  assert.deepEqual(result.topics[0].prerequisiteEvidence[0], {
    unitId: 'prerequisite-unit',
    unitName: 'Prerequisite unit',
    sampleSize: 1,
    accuracy: 0,
  });
  assert.deepEqual(
    result.topics[0].sequence.map(step => step.title),
    ['Check prerequisite knowledge', 'Review the target topic', 'Reassess progress'],
  );
  assert.equal(result.topics[0].sequence[2].resources[0].href, '/quiz/unit/target-unit');
  assert.equal(queryCalls.length, 2);
  for (const query of queryCalls) {
    assert.equal(query.where.attemptId.not, currentAttemptId);
    assert.equal(query.where.attempt.is.completedAt.not, null);
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
"""
    )


def test_repeated_prerequisite_failures_across_attempts_are_diagnosed():
    run_typescript(
        r"""
const assert = require('node:assert/strict');
const {
  AssessmentRecommendationService,
} = require('./src/modules/education/assessment/services/assessment-recommendation.service.ts');

const priorAttempts = ['attempt-1', 'attempt-2', 'attempt-3'];
const service = Object.create(AssessmentRecommendationService.prototype);
service.prisma = {
  question: {
    findMany: async () => [{
      id: 'target-question',
      topicIds: ['target-topic'],
      unitId: 'target-unit',
    }],
  },
  topic: {
    findMany: async () => [{
      id: 'target-topic',
      name: 'Target topic',
      unitId: 'target-unit',
      unit: {
        id: 'target-unit',
        name: 'Target unit',
        title: null,
        courseId: 'target-course',
        course: { id: 'target-course', name: 'Target course', title: null },
      },
    }],
  },
  unitRelation: {
    findMany: async () => [{
      targetUnitId: 'target-unit',
      sourceUnit: {
        id: 'prerequisite-unit',
        name: 'Prerequisite unit',
        title: null,
        courseId: 'prerequisite-course',
        topics: [{ id: 'prerequisite-topic', name: 'Prerequisite topic' }],
      },
    }],
  },
  course: { findMany: async () => [] },
  userResponse: {
    findMany: async query =>
      query.where.question.OR
        ? priorAttempts.map(attemptId => ({
            attemptId,
            isCorrect: false,
            question: {
              unitId: 'prerequisite-unit',
              topicIds: [],
            },
          }))
        : [],
  },
  material: { findMany: async () => [] },
};

(async () => {
  const result = await service.recommendForAnswers(
    'user-1',
    { topicId: 'target-topic', unitId: 'target-unit', courseId: 'target-course' },
    [{ questionId: 'target-question', isCorrect: false }],
    'current-attempt',
  );

  assert.equal(result.topics[0].diagnosis, 'prerequisite_gap');
  assert.equal(result.topics[0].confidence, 'medium');
  assert.equal(result.topics[0].prerequisiteEvidence[0].sampleSize, 3);
  assert.deepEqual(
    result.topics[0].sequence.map(step => step.title),
    ['Strengthen prerequisite foundations', 'Return to the target topic', 'Reassess progress'],
  );
  assert.ok(
    result.topics[0].sequence[0].resources.some(
      resource => resource.id === 'prerequisite-topic',
    ),
  );
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
"""
    )
