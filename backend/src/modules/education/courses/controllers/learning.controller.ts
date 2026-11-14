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
  Headers,
  BadRequestException,
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
  CreateLearningGoalDto,
  GoalFiltersDto,
} from '../../../../common/dto/learning-goals.dto';
import {
  ProgressStatus,
  ProgressEntryType,
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
      topicId?: string;
      materialId?: string;
      learningPathId?: string;
      phaseId?: string;
      moduleId?: string;
      progress: number;
      timeSpent: number;
      metadata?: Record<string, any>;
    },
    @Request() req: any,
    @Headers('X-Client-Timestamp') clientTimestampHeader?: string,
    @Headers('X-Idempotency-Key') idempotencyKey?: string,
    @Headers('X-Expected-Revision') expectedRevisionHeader?: string,
  ) {
    if (!data.courseId || (!data.topicId && !data.materialId)) {
      throw new BadRequestException(
        'Course progress is derived. Provide an enrolled course and a topic or material to update.',
      );
    }

    if (
      typeof idempotencyKey !== 'string' ||
      idempotencyKey.trim().length === 0 ||
      idempotencyKey.length > 200
    ) {
      throw new BadRequestException(
        'X-Idempotency-Key is required and must be at most 200 characters.',
      );
    }

    const clientTimestamp =
      typeof clientTimestampHeader === 'string' &&
      /^\d+$/.test(clientTimestampHeader)
        ? Number(clientTimestampHeader)
        : NaN;
    if (!Number.isSafeInteger(clientTimestamp)) {
      throw new BadRequestException(
        'X-Client-Timestamp is required and must be epoch milliseconds.',
      );
    }

    const expectedRevision =
      typeof expectedRevisionHeader === 'string' &&
      /^\d+$/.test(expectedRevisionHeader)
        ? Number(expectedRevisionHeader)
        : NaN;
    if (
      !Number.isSafeInteger(expectedRevision) ||
      expectedRevision < 0
    ) {
      throw new BadRequestException(
        'X-Expected-Revision is required and must be a non-negative safe integer.',
      );
    }

    const {
      courseId,
      topicId,
      materialId,
      learningPathId,
      phaseId,
      moduleId,
      progress,
      timeSpent,
      metadata,
    } = data;
    const progressData = {
      percentage: progress,
      progressPercentage: progress,
      timeSpent: timeSpent,
      timeSpentMinutes: timeSpent,
      completed: progress === 100,
      timestamp: new Date(),
    };

    return this.learningService.updateProgress(req.user.id, {
      userId: req.user.id,
      courseId,
      topicId,
      materialId,
      learningPathId,
      phaseId: phaseId ?? (typeof metadata?.phaseId === 'string' ? metadata.phaseId : undefined),
      moduleId: moduleId ?? (typeof metadata?.moduleId === 'string' ? metadata.moduleId : undefined),
      progressData,
      progress,
      timeSpent,
      completed: progress === 100,
      completedAt: progress === 100 ? new Date() : undefined,
      status:
        progress === 100 ? ProgressStatus.completed : ProgressStatus.inProgress,
      metadata,
      clientTimestamp,
      idempotencyKey,
      expectedRevision,
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

  @Get('predictions/bkt')
  @ApiOperation({
    summary: 'Get Bayesian knowledge estimates for skills with recorded evidence',
  })
  @ApiResponse({ status: 200, description: 'Skill mastery estimates retrieved' })
  async getBktPredictions(@Request() req: any) {
    return this.learningService.getBktPredictions(req.user.id);
  }

  @Get('predictions')
  @ApiOperation({
    summary:
      'Estimate performance from recent completed quiz scores',
  })
  @ApiResponse({ status: 200, description: 'Predictions retrieved' })
  async getPredictions(@Request() req: any) {
    return this.learningService.getPredictions(req.user.id);
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
  @ApiOperation({ summary: 'Create learning goal', deprecated: true })
  @ApiResponse({ status: 201, description: 'Goal created' })
  async createGoal(
    @Body() createDto: CreateLearningGoalDto,
    @Request() req: any,
  ) {
    return this.learningGoalsService.create(createDto, req.user.id);
  }

  @Get('goals')
  @Header('Cache-Control', 'private, max-age=60')
  @ApiOperation({ summary: 'Get all learning goals', deprecated: true })
  @ApiResponse({ status: 200, description: 'Goals retrieved' })
  async getAllGoals(@Request() req: any, @Query() filters: GoalFiltersDto) {
    return this.learningGoalsService.findAll(req.user.id, filters);
  }

  @Get('goals/recommendations')
  @ApiOperation({
    summary: 'Get recommended learning goals (gRPC-based)',
    deprecated: true,
  })
  @ApiResponse({ status: 200, description: 'Recommendations retrieved' })
  async getGoalRecommendations(@Request() req: any) {
    return this.learningGoalsService.getRecommendedGoals(req.user.id);
  }

  @Get('goals/summary')
  @Roles(Role.student, Role.admin)
  @Header('Cache-Control', 'private, max-age=120')
  @ApiOperation({ summary: 'Get learning goals analytics', deprecated: true })
  @ApiResponse({ status: 200, description: 'Analytics retrieved' })
  async getGoalsAnalytics(@Request() req: any) {
    return this.learningGoalsService.getAnalytics(req.user.id);
  }

  @Post('goals/smart-suggestions')
  @ApiOperation({ summary: 'Get SMART criteria suggestions', deprecated: true })
  @ApiResponse({ status: 200, description: 'Suggestions generated' })
  getSmartSuggestions(@Body() goalData: Partial<CreateLearningGoalDto>) {
    return this.learningGoalsService.generateSmartSuggestions(goalData);
  }

  @Get('goals/:id')
  @Header('Cache-Control', 'private, max-age=60')
  @ApiOperation({ summary: 'Get learning goal by ID', deprecated: true })
  @ApiParam({ name: 'id', description: 'Goal ID' })
  @ApiResponse({ status: 200, description: 'Goal retrieved' })
  async getGoal(@Param('id') id: string, @Request() req: any) {
    return this.learningGoalsService.findOne(id, req.user.id);
  }

  @Patch('goals/:id')
  @ApiOperation({ summary: 'Update learning goal', deprecated: true })
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
  @ApiOperation({ summary: 'Delete learning goal', deprecated: true })
  @ApiParam({ name: 'id', description: 'Goal ID' })
  @ApiResponse({ status: 204, description: 'Goal deleted' })
  async deleteGoal(@Param('id') id: string, @Request() req: any) {
    await this.learningGoalsService.remove(id, req.user.id);
  }

  @Post('goals/:id/progress')
  @ApiOperation({ summary: 'Add progress entry to goal', deprecated: true })
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
  @ApiOperation({ summary: 'Get goal progress history', deprecated: true })
  @ApiParam({ name: 'id', description: 'Goal ID' })
  @ApiResponse({ status: 200, description: 'Progress history retrieved' })
  async getGoalProgress(@Param('id') id: string, @Request() req: any) {
    return this.learningGoalsService.getGoalProgress(id, req.user.id);
  }
}
