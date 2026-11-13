import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { AssessmentAnalyticsService } from '#modules/ai-analytics/services/assessment-analytics.service';
import { MasteryGateService } from '../../courses/services/mastery-gate.service';
import { AssessmentProgressService } from './assessment-progress.service';
import { FlashcardsService } from './flashcards.service';

type QuizSubmittedEvent = {
  userId: string;
  quizId: string;
  attemptId: string;
  topicId: string | null;
  score: number;
  isPassed: boolean;
  passingScore: number;
  bktUpdates: Array<{ skillId: string; isCorrect: boolean }>;
  reviewAnswers: Array<{ questionId: string; isCorrect: boolean }>;
};

type AdaptiveAnswerSubmittedEvent = {
  userId: string;
  skillId: string;
  isCorrect: boolean;
  eventId: string;
};

function isAdaptiveAnswerSubmittedEvent(
  value: unknown,
): value is AdaptiveAnswerSubmittedEvent {
  if (!value || typeof value !== 'object') return false;
  const event = value as Partial<AdaptiveAnswerSubmittedEvent>;
  return (
    typeof event.userId === 'string' &&
    typeof event.skillId === 'string' &&
    typeof event.isCorrect === 'boolean' &&
    typeof event.eventId === 'string'
  );
}

function isQuizSubmittedEvent(value: unknown): value is QuizSubmittedEvent {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const event = value as Partial<QuizSubmittedEvent>;
  return (
    typeof event.userId === 'string' &&
    typeof event.quizId === 'string' &&
    typeof event.attemptId === 'string' &&
    (event.topicId === null || typeof event.topicId === 'string') &&
    typeof event.score === 'number' &&
    typeof event.isPassed === 'boolean' &&
    typeof event.passingScore === 'number' &&
    Array.isArray(event.bktUpdates) &&
    event.bktUpdates.every(
      update =>
        typeof update?.skillId === 'string' &&
        typeof update?.isCorrect === 'boolean',
    ) &&
    Array.isArray(event.reviewAnswers) &&
    event.reviewAnswers.every(
      answer =>
        typeof answer?.questionId === 'string' &&
        typeof answer?.isCorrect === 'boolean',
    )
  );
}

@Injectable()
export class QuizSubmissionListener {
  private readonly logger = new Logger(QuizSubmissionListener.name);

  constructor(
    private readonly progressService: AssessmentProgressService,
    private readonly analyticsService: AssessmentAnalyticsService,
    private readonly masteryGateService: MasteryGateService,
    private readonly flashcardsService: FlashcardsService,
  ) {}

  @OnEvent('quiz.submitted', { async: true })
  async handle(payload: unknown): Promise<void> {
    if (!isQuizSubmittedEvent(payload)) {
      throw new Error('Invalid quiz.submitted event payload');
    }

    try {
      await this.progressService.updateProgress(payload.userId, payload.quizId);
      await this.analyticsService.generateAnalytics(payload.userId, payload.quizId);

      if (payload.topicId) {
        await this.masteryGateService.onQuizComplete(
          payload.userId,
          payload.topicId,
          payload.attemptId,
          payload.passingScore,
        );
      }

      for (const [index, update] of payload.bktUpdates.entries()) {
        await this.analyticsService.updateBktForAssessment(
          payload.userId,
          update.skillId,
          update.isCorrect,
          `quiz-attempt:${payload.attemptId}:bkt:${index}`,
        );
      }

      if (payload.reviewAnswers.length > 0) {
        await this.flashcardsService.recordTopicQuizReviews(
          payload.userId,
          payload.topicId,
          payload.reviewAnswers,
          payload.attemptId,
        );
      }

      this.logger.log(
        `Post-submission effects completed for attempt ${payload.attemptId}`,
      );
    } catch (error) {
      this.logger.error(
        `Quiz submission follow-up failed for attempt ${payload.attemptId}`,
        error instanceof Error ? error.stack : error,
      );
      throw error;
    }
  }

  @OnEvent('adaptive-answer.submitted', { async: true })
  async handleAdaptiveAnswer(payload: unknown): Promise<void> {
    if (!isAdaptiveAnswerSubmittedEvent(payload)) {
      throw new Error('Invalid adaptive-answer.submitted event payload');
    }

    try {
      await this.analyticsService.updateBktForAssessment(
        payload.userId,
        payload.skillId,
        payload.isCorrect,
        payload.eventId,
      );
    } catch (error) {
      this.logger.error(
        `Adaptive answer update failed for user ${payload.userId}`,
        error instanceof Error ? error.stack : error,
      );
      throw error;
    }
  }
}
