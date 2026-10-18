import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Query,
  Request,
  HttpCode,
  HttpStatus,
  ForbiddenException,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiOperation, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { QuizService } from '../services/quiz.service';
import { WeaknessOrchestrationService } from '../services/weakness-orchestration.service';
import { JwtAuthGuard } from '#modules/auth/guards/jwt-auth.guard';
import { RoleGuard } from '#common/guards/roles.guard';
import { Roles } from '#common/decorators/roles.decorator';
import { Role } from '#modules/auth/constants/role.constants';
import { User } from '#common/decorators/user.decorator';
import { SubmitQuizDto, SubmitQuizAnswerDto } from '#common/dto/assessment.dto';
import {
  ImportQuizDto,
  QuestionBankFilters,
} from '#common/dto/question-bank.dto';

@ApiTags('Quiz')
@ApiBearerAuth()
@Controller('quizzes')
@UseGuards(JwtAuthGuard)
export class QuizController {
  constructor(
    private readonly quizService: QuizService,
    private readonly orchestrationService: WeaknessOrchestrationService,
  ) {}

  @Get('unit/:unitId')
  @ApiOperation({ summary: 'Get questions for a unit-based quiz' })
  async getQuestionsByUnit(@Param('unitId') unitId: string) {
    return this.quizService.getQuestionsByUnit(unitId);
  }

  @Get('topic/:topicId')
  @ApiOperation({ summary: 'Get questions for a topic-based quiz' })
  async getQuestionsByTopic(@Param('topicId') topicId: string) {
    return this.quizService.getQuestionsByTopic(topicId);
  }

  @Get('topic/:topicId/progress')
  @ApiOperation({ summary: "Get the authenticated user's topic quiz progress" })
  async getTopicQuizProgress(
    @Request() req: any,
    @Param('topicId') topicId: string,
  ) {
    return this.quizService.getTopicQuizProgress(req.user.id, topicId);
  }

  @Get('assessment/:assessmentId')
  @ApiOperation({ summary: 'Get questions for a learning-path assessment' })
  async getQuestionsByAssessment(
    @Request() req: any,
    @Param('assessmentId') assessmentId: string,
  ) {
    return this.quizService.getQuestionsByAssessmentId(
      assessmentId,
      req.user.id,
    );
  }

  @Get('bank')
  @UseGuards(RoleGuard)
  @Roles(Role.instructor, Role.admin)
  @ApiOperation({ summary: 'Browse the question bank' })
  async getQuestionBank(@Query() filters: QuestionBankFilters) {
    return this.quizService.getQuestionBank(filters);
  }

  @Post('import')
  @UseGuards(RoleGuard)
  @Roles(Role.instructor, Role.admin)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  @ApiOperation({
    summary: 'Import a quiz and its questions into the question bank',
  })
  async importQuiz(@Request() req: any, @Body() body: ImportQuizDto) {
    return this.quizService.importQuiz(body, req.user.id);
  }

  @Post(':quizId/publish')
  @UseGuards(RoleGuard)
  @Roles(Role.instructor, Role.admin)
  @ApiOperation({ summary: 'Publish a draft quiz' })
  async publishQuiz(@Request() req: any, @Param('quizId') quizId: string) {
    return this.quizService.publishQuiz(quizId, req.user.id);
  }

  @Post('topic/:topicId/submit')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Submit a topic quiz' })
  async submitTopicQuiz(
    @Request() req: any,
    @Param('topicId') topicId: string,
    @Body() body: any,
  ) {
    const userId = req.user.id;
    return this.quizService.submitTopicQuiz(
      userId,
      topicId,
      body.responses || [],
    );
  }

  @Post('topic/:topicId/offline-attempts')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sync a formative offline topic-practice attempt' })
  async syncOfflinePracticeAttempt(
    @Request() req: any,
    @Param('topicId') topicId: string,
    @Body()
    body: {
      attemptId: string;
      responses: Array<{ questionId: string; selectedAnswers: string[] }>;
    },
  ) {
    return this.quizService.syncOfflinePracticeAttempt(
      req.user.id,
      topicId,
      body.attemptId,
      body.responses,
    );
  }

  @Post('unit/:unitId/generate')
  @ApiOperation({ summary: 'Generate a quiz for a unit' })
  async generateUnitQuiz(@Request() req: any, @Param('unitId') unitId: string) {
    return this.quizService.generateUnitQuiz(unitId, req.user.id);
  }

  @Post('submit')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Submit a quiz answer or full quiz' })
  async submit(
    @Request() req: any,
    @Query('type') type: string,
    @Body() body: SubmitQuizDto | SubmitQuizAnswerDto,
  ) {
    const userId = req.user.id;

    if (type === 'full') {
      const { unitId, answers } = body as SubmitQuizDto;
      return this.quizService.submitQuiz(userId, unitId, answers);
    }

    // Default to single answer submission
    const submitDto = body as SubmitQuizAnswerDto;
    const answer = submitDto.answerData
      ? JSON.stringify(submitDto.answerData)
      : submitDto.selectedOptionIds?.[0] || '';

    return this.quizService.submitAnswer(userId, submitDto.questionId, answer);
  }

  @Get('results/:userId/:unitId')
  @ApiOperation({ summary: 'Get quiz results for a user' })
  async getQuizResults(
    @Param('userId') userId: string,
    @Param('unitId') unitId: string,
    @User('id') authenticatedUserId: string,
  ) {
    this.assertOwnUser(authenticatedUserId, userId);
    return this.quizService.getUserQuizResults(userId, unitId);
  }

  @Get('assessments/auto-generated-quizzes')
  @ApiOperation({ summary: 'Get pending auto-generated quizzes for user' })
  async getAutoGeneratedQuizzes(@Request() req: any) {
    const userId = req.user.id;
    const quizzes =
      await this.orchestrationService.getPendingAutoQuizzes(userId);
    return { data: quizzes };
  }

  @Get('analytics/weakness-chains')
  @ApiOperation({ summary: 'Get weakness chains for user' })
  async getWeaknessChains(@Request() req: any) {
    const userId = req.user.id;
    const chains =
      await this.orchestrationService.getWeaknessChainsForUser(userId);
    return { data: chains };
  }

  @Post('assessments/auto-quiz/complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Record completion of auto-generated quiz' })
  async completeAutoQuiz(
    @Request() req: any,
    @Body() body: { quizId: string; score: number; maxScore: number },
  ) {
    return this.orchestrationService.completeAutoQuiz(
      req.user.id,
      body.quizId,
      body.score,
      body.maxScore,
    );
  }

  private assertOwnUser(
    authenticatedUserId: string,
    requestedUserId: string,
  ): void {
    if (authenticatedUserId !== requestedUserId) {
      throw new ForbiddenException('You can only access your own quiz data');
    }
  }
}
