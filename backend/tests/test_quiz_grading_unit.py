from ts_runtime import run_typescript


def test_topic_grader_uses_canonical_grading_and_partial_credit():
    run_typescript(
        r"""
const assert = require('node:assert/strict');
const { QuizUtils } = require('./src/common/utils/quiz.utils.ts');

const result = QuizUtils.gradeOptionQuiz(
  [
    {
      id: 'single',
      type: 'multiple_choice',
      points: 3,
      options: [
        { id: 'single-correct', isCorrect: true },
        { id: 'single-wrong', isCorrect: false },
      ],
    },
    {
      id: 'multi',
      type: 'multiple_select',
      points: 4,
      options: [
        { id: 'multi-correct-1', isCorrect: true },
        { id: 'multi-correct-2', isCorrect: true },
        { id: 'multi-wrong', isCorrect: false },
      ],
    },
  ],
  [
    { questionId: 'single', selectedAnswers: ['single-correct'] },
    { questionId: 'multi', selectedAnswers: ['multi-correct-1'] },
  ],
);

assert.equal(result.correctAnswers, 1);
assert.equal(result.totalPoints, 7);
assert.equal(result.earnedPoints, 5);
assert.equal(result.responses[1].isCorrect, false);
assert.equal(result.responses[1].earnedPoints, 2);
assert.equal(result.percentage, 71);
"""
    )
