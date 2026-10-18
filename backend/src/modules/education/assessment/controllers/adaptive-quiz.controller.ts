import {
  Body,
  Controller,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { IsNumber, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { Question, Option } from '@prisma/client';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '#modules/auth/guards/jwt-auth.guard';
import { AssessmentRecommendationService } from '../services/assessment-recommendation.service';
import { AdaptiveQuizService } from '../services/adaptive-quiz.service';
import { SubmitAnswerDto } from '#common/dto/assessment.dto';
import { AdaptiveQuizSession } from '#common/dto';

class StartAdaptiveQuizRequest {
  @IsUUID()
  @IsOptional()
  courseId?: string;

  @IsUUID()
  @IsOptional()
  unitId?: string;
}

class SubmitAdaptiveAnswerRequest {
  @IsUUID()
  sessionId!: string;

  @IsUUID()
  questionId!: string;

  @IsString()
  answer!: string;

  @IsNumber()
  @Min(0)
  responseTime!: number;

  @IsNumber()
  @Min(1)
  @Max(5)
  confidence!: number;
}

type QuestionWithOptions = Question & { options?: Option[] };

@ApiTags('Adaptive Quiz')
@ApiBearerAuth()
@Controller('assessments/adaptive-quiz')
@UseGuards(JwtAuthGuard)
export class AdaptiveQuizController {
  constructor(
    private readonly adaptiveQuizService: AdaptiveQuizService,
    private readonly recommendationService: AssessmentRecommendationService,
  ) {}

  @Post('start')
  @ApiOperation({ summary: 'Start an adaptive quiz session' })
  async start(
    @Request() request: { user: { id: string } },
    @Body() body: StartAdaptiveQuizRequest,
  ) {
    const session = await this.adaptiveQuizService.startAdaptiveQuiz(
      request.user.id,
      body.courseId,
      body.unitId,
    );
    return this.toPublicSession(session);
  }

  @Post('answer')
  @ApiOperation({ summary: 'Submit an adaptive quiz answer' })
  async answer(
    @Request() request: { user: { id: string } },
    @Body() body: SubmitAdaptiveAnswerRequest,
  ) {
    const dto: SubmitAnswerDto = {
      assessmentId: body.sessionId,
      userId: request.user.id,
      questionId: body.questionId,
      selectedOptionIds: [body.answer],
      answerData: body.answer,
      timeSpentSeconds: body.responseTime,
    };
    const result = await this.adaptiveQuizService.submitAnswer(
      body.sessionId,
      dto,
      body.confidence,
    );

    if (result.isComplete) {
      await this.adaptiveQuizService.finalizeSession(result.session);
      const recommendations = await this.recommendationService.recommendForAnswers(
        request.user.id,
        {
          topicId: undefined,
          unitId: result.session.unitId,
          courseId: result.session.courseId,
        },
        result.session.responses,
      );
      result.session.recommendations = recommendations.recommendations.map(
        (recommendation) => `${recommendation.title}: ${recommendation.reason}`,
      );
    }

    return {
      ...result,
      nextQuestion: result.nextQuestion
        ? this.toPublicQuestion(result.nextQuestion)
        : undefined,
      session: this.toPublicSession(result.session),
    };
  }

  private toPublicSession(session: AdaptiveQuizSession) {
    return {
      ...session,
      questions: session.questions.map((question) =>
        this.toPublicQuestion(question),
      ),
    };
  }

  private toPublicQuestion(question: Question) {
    const questionWithOptions = question as QuestionWithOptions;
    return {
      id: question.id,
      question_text: question.text,
      type: question.type,
      difficulty: question.difficulty,
      category: question.category,
      points: question.points,
      options: (questionWithOptions.options ?? []).map((option) => ({
        id: option.id,
        option_text: option.text,
      })),
    };
  }
}
