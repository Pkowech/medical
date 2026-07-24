import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Delete,
  Query,
  UseGuards,
  Request,
  HttpStatus,
  HttpCode,
  Header,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '#modules/auth/guards/jwt-auth.guard';
import { LearningService } from '../services/learning.service';
import { LearningPathsService } from '../services/learning-paths.service';
import { LearningPathProgressService } from '../services/learning-path-progress.service';
import { LearningGoalsService } from '../services/learning-goals.service';
import { LearningPathRecommendationsService } from '#modules/ai-analytics/services/learning-path-recommendations.service';
import { LearningAnalyticsService } from '#modules/ai-analytics/services/learning-analytics.service';
import {
  CreateLearningPathDto,
  UpdateLearningPathDto,
  LearningPathFiltersDto,
} from '../../../../common/dto/learning-paths.dto';
import {
  CreateLearningGoalDto,
  GoalFiltersDto,
} from '../../../../common/dto/learning-goals.dto';
import { ProgressUpdateDto } from '../../../../common/dto/progress.dto';
import {
  ProgressStatus,
  ProgressEntryType,
  LearningPathCategory,
} from '@prisma/client';
import { RoleGuard } from '#common/guards/roles.guard';
import { Roles } from '#common/decorators/roles.decorator';
import { Role } from '#modules/auth/constants/role.constants';
@ApiTags('Learning')
@Controller('learning')
@UseGuards(JwtAuthGuard, RoleGuard)
@ApiBearerAuth()
export class LearningController {
  constructor(
    private readonly learningService: LearningService,
    private readonly learningPathsService: LearningPathsService,
    private readonly learningPathProgressService: LearningPathProgressService,
    private readonly learningGoalsService: LearningGoalsService,
    private readonly learningAnalyticsService: LearningAnalyticsService,
    private readonly recommendationsService: LearningPathRecommendationsService,
  ) {}

  // ==================== LEARNING CORE ENDPOINTS ====================

  @Post('courses/:courseId/enroll')
  @ApiOperation({ summary: 'Enroll in a course' })
  @ApiResponse({ status: 201, description: 'Successfully enrolled in course' })
  async enrollInCourse(
    @Param('courseId') courseId: string,
    @Request() req: any,
  ) {
    return this.learningService.enrollInCourse(req.user.id, courseId);
  }

  @Post('paths/:pathId/enroll')
  @ApiOperation({ summary: 'Enroll in a learning path' })
  @ApiResponse({
    status: 201,
    description: 'Successfully enrolled in learning path',
  })
  async enrollInLearningPath(
    @Param('pathId') pathId: string,
    @Request() req: any,
  ) {
    return this.learningService.enrollInLearningPath(req.user.id, pathId);
  }

  @Post('progress')
  @ApiOperation({ summary: 'Update learning progress' })
  @ApiResponse({ status: 200, description: 'Progress updated successfully' })
  async updateProgress(
    @Body()
    data: {
      courseId?: string;
      learningPathId?: string;
      progress: number;
      timeSpent: number;
      metadata?: Record<string, any>;
    },
    @Request() req: any,
  ) {
    const { courseId, learningPathId, progress, timeSpent, metadata } = data;
    return this.learningService.updateProgress(req.user.id, {
      userId: req.user.id,
      courseId,
      learningPathId,
      progressData: {
        progressPercentage: progress,
        timeSpentMinutes: timeSpent,
        completed: progress === 100,
        timestamp: new Date(),
      },
      progress,
      timeSpent,
      completed: progress === 100,
      completedAt: progress === 100 ? new Date() : undefined,
      status:
        progress === 100 ? ProgressStatus.completed : ProgressStatus.inProgress,
      metadata,
    });
  }

  @Get('status/:userId')
  @ApiOperation({ summary: 'Get user learning status' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'Learning status retrieved' })
  async getUserLearningStatus(@Param('userId') userId: string) {
    return this.learningService.getUserLearningStatus(userId);
  }

  @Get('recommendations/:userId')
  @ApiOperation({ summary: 'Get recommended next steps' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'Recommendations retrieved' })
  async getRecommendations(@Param('userId') userId: string) {
    return this.learningService.getRecommendedNextSteps(userId);
  }

  // ==================== ANALYTICS ENDPOINTS ====================

  @Get('insights')
  @ApiOperation({
    summary: 'Get user learning analytics with study patterns (gRPC-based)',
  })
  @ApiResponse({ status: 200, description: 'Analytics retrieved successfully' })
  async getLearningAnalytics(@Request() req: any) {
    return this.learningService.getLearningAnalytics(req.user.id);
  }

  @Get('predictions')
  @ApiOperation({
    summary:
      'Get success rate predictions based on learning history (gRPC-based)',
  })
  @ApiQuery({
    name: 'features',
    required: false,
    type: String,
    description: 'Comma-separated feature values',
  })
  @ApiResponse({ status: 200, description: 'Predictions retrieved' })
  async getPredictions(
    @Request() req: any,
    @Query('features') features?: string,
  ) {
    const featureArray = features
      ? features
          .split(',')
          .map((f) => parseFloat(f))
          .filter((f) => !isNaN(f))
      : undefined;
    return this.learningService.getPredictions(req.user.id, featureArray);
  }

  @Get('focus-recommendations')
  @ApiOperation({
    summary:
      'Get study focus recommendations and due review items (gRPC-based)',
  })
  @ApiResponse({ status: 200, description: 'Focus recommendations retrieved' })
  async getStudyFocusRecommendations(@Request() req: any) {
    return this.learningService.getStudyFocusRecommendations(req.user.id);
  }

  // ==================== LEARNING PATHS ENDPOINTS ====================
  // REMOVED: Consolidated into LearningPathsController under /v1/learning-paths/


  // ==================== LEARNING GOALS ENDPOINTS ====================

  @Post('goals')
  @ApiOperation({ summary: 'Create learning goal' })
  @ApiResponse({ status: 201, description: 'Goal created' })
  async createGoal(
    @Body() createDto: CreateLearningGoalDto,
    @Request() req: any,
  ) {
    return this.learningGoalsService.create(createDto, req.user.id);
  }

  @Get('goals')
  @Header('Cache-Control', 'private, max-age=60')
  @ApiOperation({ summary: 'Get all learning goals' })
  @ApiResponse({ status: 200, description: 'Goals retrieved' })
  async getAllGoals(@Request() req: any, @Query() filters: GoalFiltersDto) {
    return this.learningGoalsService.findAll(req.user.id, filters);
  }

  @Get('goals/recommendations')
  @ApiOperation({ summary: 'Get recommended learning goals (gRPC-based)' })
  @ApiResponse({ status: 200, description: 'Recommendations retrieved' })
  async getGoalRecommendations(@Request() req: any) {
    return this.learningGoalsService.getRecommendedGoals(req.user.id);
  }

  @Get('goals/summary')
  @Roles(Role.student, Role.admin)
  @Header('Cache-Control', 'private, max-age=120')
  @ApiOperation({ summary: 'Get learning goals analytics' })
  @ApiResponse({ status: 200, description: 'Analytics retrieved' })
  async getGoalsAnalytics(@Request() req: any) {
    return this.learningGoalsService.getAnalytics(req.user.id);
  }

  @Post('goals/smart-suggestions')
  @ApiOperation({ summary: 'Get SMART criteria suggestions' })
  @ApiResponse({ status: 200, description: 'Suggestions generated' })
  getSmartSuggestions(@Body() goalData: Partial<CreateLearningGoalDto>) {
    return this.learningGoalsService.generateSmartSuggestions(goalData);
  }

  @Get('goals/:id')
  @Header('Cache-Control', 'private, max-age=60')
  @ApiOperation({ summary: 'Get learning goal by ID' })
  @ApiParam({ name: 'id', description: 'Goal ID' })
  @ApiResponse({ status: 200, description: 'Goal retrieved' })
  async getGoal(@Param('id') id: string, @Request() req: any) {
    return this.learningGoalsService.findOne(id, req.user.id);
  }

  @Patch('goals/:id')
  @ApiOperation({ summary: 'Update learning goal' })
  @ApiParam({ name: 'id', description: 'Goal ID' })
  @ApiResponse({ status: 200, description: 'Goal updated' })
  async updateGoal(
    @Param('id') id: string,
    @Body() updateDto: Partial<CreateLearningGoalDto>,
    @Request() req: any,
  ) {
    return this.learningGoalsService.update(id, updateDto, req.user.id);
  }

  @Delete('goals/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete learning goal' })
  @ApiParam({ name: 'id', description: 'Goal ID' })
  @ApiResponse({ status: 204, description: 'Goal deleted' })
  async deleteGoal(@Param('id') id: string, @Request() req: any) {
    await this.learningGoalsService.remove(id, req.user.id);
  }

  @Post('goals/:id/progress')
  @ApiOperation({ summary: 'Add progress entry to goal' })
  @ApiParam({ name: 'id', description: 'Goal ID' })
  @ApiResponse({ status: 201, description: 'Progress entry added' })
  async addGoalProgress(
    @Param('id') id: string,
    @Body()
    progressData: {
      progressValue: number;
      notes?: string;
      entryType?: ProgressEntryType;
      metadata?: Record<string, any>;
      context?: Record<string, any>;
    },
    @Request() req: any,
  ) {
    return this.learningGoalsService.addProgressEntry(id, req.user.id, {
      entryType: progressData.entryType || ProgressEntryType.manual,
      progressValue: progressData.progressValue,
      notes: progressData.notes,
      metadata: progressData.metadata,
      context: progressData.context,
    });
  }

  @Get('goals/:id/progress')
  @Header('Cache-Control', 'private, max-age=30')
  @ApiOperation({ summary: 'Get goal progress history' })
  @ApiParam({ name: 'id', description: 'Goal ID' })
  @ApiResponse({ status: 200, description: 'Progress history retrieved' })
  async getGoalProgress(@Param('id') id: string, @Request() req: any) {
    return this.learningGoalsService.getGoalProgress(id, req.user.id);
  }
}
