import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { AssessmentProgressService } from '../services/assessment-progress.service';
import { JwtAuthGuard } from '#modules/auth/guards/jwt-auth.guard';
import { User } from '#common/decorators/user.decorator';
import { PerformanceAnalyticsDto, AssessmentHistoryDto } from '#common/dto';
import { AssessmentAnalyticsService } from '../../../ai-analytics/services/assessment-analytics.service';
import {
  AssessmentProgressDto,
  UserPerformanceProfileDto,
  AssessmentRecommendationDto,
} from '#common/dto/assessment.dto';
import { UserAnalyticsService } from '../../../ai-analytics/services/user-analytics.service';
import { LearningAnalyticsService } from '../../../ai-analytics/services/learning-analytics.service';

@ApiTags('Assessment Progress & Analytics')
@Controller('assessment-progress')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AssessmentProgressController {
  constructor(
    private readonly assessmentProgressService: AssessmentProgressService,
    private readonly analyticsService: AssessmentAnalyticsService,
    private readonly userAnalyticsService: UserAnalyticsService,
    private readonly learningAnalyticsService: LearningAnalyticsService,
  ) {}

  @Post(':assessmentId')
  @ApiOperation({ summary: 'Update user progress for an assessment' })
  @ApiParam({ name: 'assessmentId', description: 'Assessment ID' })
  @ApiResponse({
    status: 200,
    description: 'Progress updated successfully',
    type: () => AssessmentProgressDto,
  })
  async updateProgress(
    @Param('assessmentId', ParseUUIDPipe) assessmentId: string,
    @Request() req: any,
    @Body() progressData: Partial<AssessmentProgressDto>,
  ) {
    return this.assessmentProgressService.updateProgress(
      req.user.id,
      assessmentId,
      progressData,
    );
  }

  @Get(':assessmentId')
  @ApiOperation({ summary: 'Get user progress for a specific assessment' })
  @ApiParam({ name: 'assessmentId', description: 'Assessment ID' })
  @ApiResponse({
    status: 200,
    description: 'Progress retrieved successfully',
  })
  async getProgress(
    @Param('assessmentId', ParseUUIDPipe) assessmentId: string,
    @Request() req: any,
  ) {
    return this.assessmentProgressService.getProgress(
      req.user.id,
      assessmentId,
    );
  }

  @Get('user/:userId')
  @ApiOperation({ summary: 'Get all assessment progress for a user' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiResponse({
    status: 200,
    description: 'User assessment progress retrieved successfully',
  })
  async getUserProgress(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.assessmentProgressService.getAllProgress(userId);
  }

  @Get('performance/:userId')
  @ApiOperation({ summary: 'Get user performance analytics' })
  @ApiResponse({ status: 200, type: () => PerformanceAnalyticsDto })
  async getUserPerformance(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query('assessmentId') assessmentId?: string,
  ): Promise<PerformanceAnalyticsDto> {
    return await this.analyticsService.generateAnalytics(userId, assessmentId);
  }

  @Get('profile/:userId')
  @ApiOperation({ summary: 'Get detailed user performance profile' })
  @ApiResponse({ status: 200, type: () => UserPerformanceProfileDto })
  async getUserProfile(
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<UserPerformanceProfileDto> {
    const profile =
      await this.analyticsService.getUserPerformanceProfile(userId);
    return profile as UserPerformanceProfileDto;
  }

  @Get('recommendations')
  @ApiOperation({
    summary: 'Get personalized recommendations for the authenticated user',
  })
  @ApiResponse({ status: 200, type: () => AssessmentRecommendationDto })
  async getUserRecommendations(
    @User('id') userId: string,
  ): Promise<AssessmentRecommendationDto> {
    return await this.analyticsService.getFullRecommendations(userId);
  }

  @Get('summary')
  @ApiOperation({
    summary: 'Get performance analytics for the authenticated user',
  })
  @ApiResponse({ status: 200 })
  async getUserAnalytics(
    @User('id') userId: string,
  ): Promise<PerformanceAnalyticsDto> {
    return await this.analyticsService.getPerformanceAnalyticsForAssessment(
      userId,
    );
  }

  @Get('study-materials')
  @ApiOperation({
    summary: 'Get study recommendations based on knowledge gaps',
  })
  @ApiQuery({ name: 'gaps', required: false })
  async getStudyMaterials(
    @User('id') userId: string,
    @Query('gaps') gaps?: string,
  ) {
    let knowledgeGaps: string[] = [];
    if (gaps) {
      knowledgeGaps = gaps
        .split(',')
        .map((g) => g.trim())
        .filter((g) => g.length > 0);
    } else {
      const analytics =
        await this.analyticsService.getPerformanceAnalyticsForAssessment(
          userId,
        );
      knowledgeGaps = analytics.weaknesses;
    }
    return await this.analyticsService.generateStudyRecommendations(
      userId,
      knowledgeGaps,
    );
  }

  @Get('next-steps')
  @ApiOperation({ summary: 'Get personalized next steps roadmap' })
  async getNextSteps(@User('id') userId: string): Promise<string[]> {
    return await this.analyticsService.generateNextSteps(userId);
  }

  @Get('admin/recommendations/:userId')
  @ApiOperation({
    summary: 'Get recommendations for a specific user (Admin only)',
  })
  @ApiParam({ name: 'userId', description: 'Target User ID' })
  @ApiResponse({ status: 200, type: () => AssessmentRecommendationDto })
  async getSpecificUserRecommendations(
    @Param('userId', ParseUUIDPipe) targetUserId: string,
    @Query('assessmentId') assessmentId?: string,
  ): Promise<AssessmentRecommendationDto> {
    return await this.analyticsService.getFullRecommendations(
      targetUserId,
      assessmentId,
    );
  }

  /**
   * Get comprehensive user analytics
   */
  @Get('summary/user/:userId')
  @ApiOperation({ summary: 'Get user analytics' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiResponse({
    status: 200,
    description: 'Returns user analytics data',
  })
  async getUserAnalyticsById(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.userAnalyticsService.getUserAnalytics(userId);
  }

  /**
   * Get user insights
   */
  @Get('insights/:userId')
  @ApiOperation({ summary: 'Get user insights' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiResponse({
    status: 200,
    description: 'Returns user insights data',
  })
  async getUserInsights(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.learningAnalyticsService.getUserInsights(userId);
  }

  /**
   * Get performance analytics for a specific assessment
   */
  @Get('summary/assessment/:assessmentId')
  @ApiOperation({ summary: 'Get assessment analytics' })
  @ApiParam({ name: 'assessmentId', description: 'Assessment ID' })
  @ApiResponse({
    status: 200,
    description: 'Returns assessment analytics data',
  })
  async getAssessmentAnalytics(
    @Param('assessmentId', ParseUUIDPipe) assessmentId: string,
  ) {
    return this.analyticsService.getConsolidatedAssessmentAnalytics(
      assessmentId,
    );
  }

  @Get('history/:userId')
  @ApiOperation({ summary: 'Get user quiz attempt history' })
  @ApiResponse({ status: 200, type: () => [AssessmentHistoryDto] })
  async getAssessmentHistory(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ): Promise<AssessmentHistoryDto[]> {
    return (await this.analyticsService.getQuizAttemptHistory(userId, {
      limit,
      offset,
    })) as AssessmentHistoryDto[];
  }

  @Get(':assessmentId/resources')
  @ApiOperation({ summary: 'Get related resources for an assessment' })
  @ApiResponse({ status: 200, type: [Object] })
  async getRelatedResources(
    @Param('assessmentId', ParseUUIDPipe) assessmentId: string,
  ): Promise<any[]> {
    return await this.analyticsService.getRelatedResources(assessmentId);
  }
}
