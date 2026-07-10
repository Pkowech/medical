import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '#infrastructure/prisma/prisma.service';
import { RedisService } from '#infrastructure/redis/redis.service';
import { AssessmentAnalyticsService } from '#modules/ai-analytics/services/assessment-analytics.service';
import { QuizUtils } from '#common/utils/quiz.utils';
import { QuestionNotFoundException } from '#common/exceptions/not-found.exception';
import { DetailedFeedback, PerformanceAnalyticsDto } from '#common/dto';
import { Question, QuestionCategory } from '@prisma/client';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@Injectable()
@ApiTags('feedback')
export class FeedbackService {
  private readonly logger = new Logger(FeedbackService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly analyticsService: AssessmentAnalyticsService,
  ) {}

  @ApiOperation({
    summary: 'Generate detailed feedback for a question response',
  })
  // Use a runtime-safe type for Swagger decorator (DetailedFeedback is a type-only interface)
  @ApiResponse({
    status: 200,
    description: 'Detailed feedback for the response',
    type: Object,
  })
  async generateDetailedFeedback(
    userId: string,
    questionId: string,
    userAnswer: any,
    responseTime: number,
  ): Promise<DetailedFeedback> {
    const cacheKey = `feedback:${userId}:${questionId}`;
    const cachedFeedback = await this.redisService.get(cacheKey);
    if (cachedFeedback) {
      return JSON.parse(cachedFeedback);
    }

    const question = await this.prisma.question.findUnique({
      where: { id: questionId },
      include: { options: true },
    });

    if (!question) {
      throw new QuestionNotFoundException(questionId);
    }

    const gradingResult = QuizUtils.gradeAnswer(question, userAnswer);
    const explanation = this.generateExplanation(
      question,
      userAnswer,
      gradingResult.isCorrect,
    );
    const conceptsToReview = this.identifyConceptsToReview(
      question,
      gradingResult.isCorrect,
    );
    const relatedResources = await this.analyticsService.getRelatedResources(
      question.id,
    );
    const difficultyAnalysis = await this.analyticsService.analyzeDifficulty(
      userId,
      question,
    );
    const timeAnalysis = this.analyzeResponseTime(responseTime, question);

    const feedback: DetailedFeedback = {
      questionId,
      isCorrect: gradingResult.isCorrect,
      userAnswer,
      correctAnswer: question.options.filter((opt) => opt.isCorrect),
      explanation,
      conceptsToReview,
      relatedResources,
      difficultyAnalysis,
      timeAnalysis,
    };

    await this.redisService.set(
      cacheKey,
      JSON.stringify(feedback),
      1 * 60 * 60,
    );
    return feedback;
  }

  @ApiOperation({ summary: 'Generate performance analytics for a user' })
  // Use runtime-safe type
  @ApiResponse({
    status: 200,
    description: 'Performance analytics',
    type: Object,
  })
  async generatePerformanceAnalytics(
    userId: string,
    quizId?: string,
    _timeframe?: { start: Date; end: Date },
  ): Promise<PerformanceAnalyticsDto> {
    const dto: PerformanceAnalyticsDto =
      await this.analyticsService.generateAnalytics(userId, quizId);
    // Map DTO to interface shape where needed for compatibility
    const result: PerformanceAnalyticsDto = {
      userId: dto.userId,
      overallScore: dto.overallScore ?? 0,
      totalAttempts: dto.totalAttempts ?? 0,
      correctAnswers: dto.correctAnswers ?? 0,
      quizId: dto.quizId,
      averageScore: dto.averageScore ?? dto.overallScore ?? 0,
      recentScores: dto.recentScores || [],
      questionsAttempted: dto.questionsAttempted ?? 0,
      timeTaken: dto.timeTaken ?? 0,
      timeSpent: dto.timeSpent ?? 0,
      // Required fields
      weakAreas: dto.weakAreas || dto.weaknesses || [],
      progressTrend: dto.progressTrend || {},
      averageTimePerQuestion:
        dto.averageTimePerQuestion ?? dto.timePerQuestion ?? 0,
      timePerQuestion: dto.timePerQuestion ?? dto.averageTimePerQuestion ?? 0,
      // Optional fields
      topicScores: dto.topicScores || {},
      difficultyBreakdown: dto.difficultyBreakdown || {},
      categoryBreakdown: dto.categoryBreakdown || {},
      learningTrends: dto.learningTrends || [],
      strengths: dto.strengths || [],
      weaknesses: dto.weaknesses || [],
      nextSteps: (dto as any).nextSteps,
      recommendations: (dto as any).recommendations,
    };
    return result;
  }

  @ApiOperation({ summary: 'Find all performance analytics for a user' })
  // Use runtime-safe type
  @ApiResponse({
    status: 200,
    description: 'All performance analytics',
    type: Object,
  })
  async findAll(
    userId: string,
    quizId?: string,
  ): Promise<PerformanceAnalyticsDto> {
    return this.generatePerformanceAnalytics(userId, quizId);
  }

  private generateExplanation(
    question: Question,
    _userAnswer: any,
    isCorrect: boolean,
  ): string {
    let explanation = question.explanation || '';
    if (!isCorrect) {
      explanation += '\n\nCommon mistakes include: ';
      switch (question.category) {
        case QuestionCategory.anatomy:
          explanation += 'confusing similar anatomical structures.';
          break;
        case QuestionCategory.pathology:
          explanation += 'misunderstanding pathological processes.';
          break;
        case QuestionCategory.pharmacology:
          explanation += 'mixing up drug mechanisms.';
          break;
        default:
          explanation += 'not fully understanding the concepts.';
      }
    }
    return explanation;
  }

  private identifyConceptsToReview(
    question: Question,
    isCorrect: boolean,
  ): string[] {
    const concepts: string[] = [];
    if (!isCorrect) {
      if (question.tags) {
        concepts.push(...question.tags);
      }
      switch (question.category) {
        case QuestionCategory.anatomy:
          concepts.push('anatomical structures', 'body systems');
          break;
        case QuestionCategory.pathology:
          concepts.push('pathological processes', 'disease mechanisms');
          break;
        case QuestionCategory.pharmacology:
          concepts.push('drug mechanisms', 'pharmacokinetics');
          break;
      }
    }
    return [...new Set(concepts)];
  }

  private analyzeResponseTime(responseTime: number, question: Question): any {
    const estimatedTime = QuizUtils.estimateQuestionTime(question);
    const efficiency =
      responseTime < estimatedTime * 0.7
        ? 'fast'
        : responseTime > estimatedTime * 1.5
          ? 'slow'
          : 'optimal';

    let suggestion = '';
    switch (efficiency) {
      case 'fast':
        suggestion = 'Good speed! Ensure you read questions carefully.';
        break;
      case 'slow':
        suggestion = 'Take time to understand, but try to be more decisive.';
        break;
      case 'optimal':
        suggestion = 'Good pacing on this question.';
        break;
    }

    return {
      timeTaken: responseTime,
      expectedTime: estimatedTime,
      efficiency,
      suggestion,
    };
  }
}
