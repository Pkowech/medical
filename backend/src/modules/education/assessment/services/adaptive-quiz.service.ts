import { Injectable, Logger } from '@nestjs/common';
import { AdaptiveQuizAnalyticsService } from '#modules/ai-analytics/services/adaptive-quiz-analytics.service';
import { Question } from '@prisma/client';
import { SubmitAnswerDto, AdaptiveQuizSession } from '#common/dto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

/**
 * AdaptiveQuizService
 *
 * This service acts as a thin domain wrapper around the consolidated
 * AdaptiveQuizAnalyticsService. It provides the primary entry point for
 * adaptive testing in the education module while delegating all IRT logic
 * and session management to the analytics layer.
 */
@Injectable()
@ApiTags('adaptive-quiz')
export class AdaptiveQuizService {
  private readonly logger = new Logger(AdaptiveQuizService.name);

  constructor(
    private readonly adaptiveQuizAnalyticsService: AdaptiveQuizAnalyticsService,
  ) {}

  @ApiOperation({ summary: 'Start an adaptive quiz session' })
  @ApiResponse({
    status: 201,
    description: 'Adaptive quiz session started',
  })
  async startAdaptiveQuiz(
    userId: string,
    courseId?: string,
    unitId?: string,
  ): Promise<AdaptiveQuizSession> {
    this.logger.log(`Starting adaptive quiz for user ${userId}`);
    return this.adaptiveQuizAnalyticsService.startAdaptiveQuiz(
      userId,
      courseId,
      unitId,
    );
  }

  @ApiOperation({ summary: 'Submit an answer for an adaptive quiz question' })
  @ApiResponse({
    status: 200,
    description: 'Answer processed, returns feedback and next question',
  })
  async submitAnswer(
    sessionId: string,
    dto: SubmitAnswerDto,
    confidence: number = 3,
  ): Promise<{
    isCorrect: boolean;
    explanation: string;
    nextQuestion?: Question;
    isComplete: boolean;
    session: AdaptiveQuizSession;
  }> {
    this.logger.log(`Submitting answer for session ${sessionId}`);
    return this.adaptiveQuizAnalyticsService.submitAnswer(
      sessionId,
      dto,
      confidence,
    );
  }

  /**
   * Finalize quiz session and store results
   */
  async finalizeSession(session: AdaptiveQuizSession): Promise<void> {
    this.logger.log(`Finalizing session ${session.sessionId}`);
    return this.adaptiveQuizAnalyticsService.finalizeSession(session);
  }

  /**
   * Get active session by ID
   */
  async getSession(
    userId: string,
    sessionId: string,
  ): Promise<AdaptiveQuizSession | undefined> {
    return this.adaptiveQuizAnalyticsService.getSession(userId, sessionId);
  }
}
