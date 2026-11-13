from ts_runtime import run_typescript


def test_outbox_listeners_reject_failed_and_invalid_events_for_retry():
    run_typescript(
        r"""
const assert = require('node:assert/strict');
const { QuizSubmissionListener } =
  require('./src/modules/education/assessment/services/quiz-submission.listener.ts');

const listener = new QuizSubmissionListener(
  { updateProgress: async () => { throw new Error('progress unavailable'); } },
  {
    generateAnalytics: async () => undefined,
    updateBktForAssessment: async () => { throw new Error('Rust unavailable'); },
  },
  { onQuizComplete: async () => undefined },
  { recordTopicQuizReviews: async () => undefined },
);
listener.logger = { error: () => undefined, warn: () => undefined, log: () => undefined };

const quizEvent = {
  userId: 'student-1',
  quizId: 'quiz-1',
  attemptId: 'attempt-1',
  topicId: null,
  score: 80,
  isPassed: true,
  passingScore: 70,
  bktUpdates: [],
  reviewAnswers: [],
};

(async () => {
  await assert.rejects(listener.handle(quizEvent), /progress unavailable/);
  await assert.rejects(
    listener.handle({ ...quizEvent, attemptId: 7 }),
    /Invalid quiz.submitted event payload/,
  );
  await assert.rejects(
    listener.handleAdaptiveAnswer({
      userId: 'student-1',
      skillId: 'topic-1',
      isCorrect: true,
      eventId: 'adaptive-answer-1',
    }),
    /Rust unavailable/,
  );
  await assert.rejects(
    listener.handleAdaptiveAnswer({ userId: 'student-1' }),
    /Invalid adaptive-answer.submitted event payload/,
  );
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
"""
    )
