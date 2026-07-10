import { Controller, Post, Get, Body, Query } from '@nestjs/common';
import { FeedbackService } from '../services/feedback.service';
import { DetailedFeedback } from '#common/dto/assessment.dto';
import { SubmitAnswerDto, PerformanceAnalyticsDto } from '#common/dto';

@Controller('feedback')
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  @Post()
  async createFeedback(
    @Body() dto: SubmitAnswerDto,
  ): Promise<DetailedFeedback> {
    // SubmitAnswerDto may provide selectedOptionIds or answerData; prefer answerData when present
    const userAnswer: any =
      (dto as any).answerData ?? (dto as any).selectedOptionIds ?? null;
    const responseTime: number = (dto as any).timeSpentSeconds ?? 0;

    return this.feedbackService.generateDetailedFeedback(
      dto.userId,
      dto.questionId,
      userAnswer,
      responseTime,
    );
  }

  @Get()
  async findAll(
    @Query('userId') userId: string,
    @Query('quizId') quizId?: string,
  ): Promise<PerformanceAnalyticsDto> {
    return this.feedbackService.findAll(userId, quizId);
  }
}
