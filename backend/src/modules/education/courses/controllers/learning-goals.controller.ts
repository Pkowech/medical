import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '#modules/auth/guards/jwt-auth.guard';
import { LearningGoalsService } from '../services/learning-goals.service';
import {
  CreateLearningGoalDto,
  GoalFiltersDto,
  RecommendedGoalsResponseDto,
  UpdateLearningGoalDto,
} from '../../../../common/dto/learning-goals.dto';
import type { AuthenticatedRequest } from '#common/dto/user.dto';

@ApiTags('Learning Goals')
@Controller('learning-goals')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class LearningGoalsController {
  constructor(private readonly learningGoalsService: LearningGoalsService) {}

  // ==================== CRUD Operations ====================
  @Post()
  @ApiOperation({ summary: 'Create a new learning goal' })
  @ApiResponse({
    status: 201,
    description: 'Learning goal created successfully',
  })
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createDto: CreateLearningGoalDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return await this.learningGoalsService.create(createDto, req.user.id);
  }

  @Get()
  @ApiOperation({ summary: 'Get all learning goals for user' })
  @ApiResponse({
    status: 200,
    description: 'Learning goals retrieved successfully',
  })
  async getAll(
    @Query() filters: GoalFiltersDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return await this.learningGoalsService.findAll(req.user.id, filters);
  }

  @Get('analytics')
  @ApiOperation({ summary: 'Get goals overview statistics' })
  @ApiResponse({
    status: 200,
    description: 'Goals statistics retrieved successfully',
  })
  async getAnalyticsOverview(@Request() req: AuthenticatedRequest) {
    return await this.learningGoalsService.getGoalsOverview(req.user.id);
  }

  @Get('stats/overview')
  @ApiOperation({ summary: 'Get goals overview statistics (alias)' })
  @ApiResponse({
    status: 200,
    description: 'Goals statistics retrieved successfully',
  })
  async getOverviewStats(@Request() req: AuthenticatedRequest) {
    return await this.learningGoalsService.getGoalsOverview(req.user.id);
  }

  @Get('recommendations')
  @ApiOperation({ summary: 'Get AI-recommended learning goals' })
  @ApiResponse({
    status: 200,
    description: 'Recommended goals retrieved successfully',
  })
  async getRecommendations(
    @Query('limit') limit: number = 5,
    @Request() req: AuthenticatedRequest,
  ): Promise<RecommendedGoalsResponseDto> {
    return await this.learningGoalsService.getRecommendedGoals(
      req.user.id,
      limit,
    );
  }

  @Get('streak/:userId')
  @ApiOperation({ summary: 'Get user streak information' })
  @ApiResponse({
    status: 200,
    description: 'Streak information retrieved successfully',
  })
  async getStreak(@Param('userId') userId: string) {
    return await this.learningGoalsService.getUserStreakInfo(userId);
  }

  @Get('active')
  @ApiOperation({ summary: 'Get active/in-progress goals for user' })
  @ApiResponse({
    status: 200,
    description: 'Active goals retrieved successfully',
  })
  async getActiveGoals(@Request() req: AuthenticatedRequest) {
    return await this.learningGoalsService.getActiveGoals(req.user.id);
  }

  @Get('completed')
  @ApiOperation({ summary: 'Get completed goals for user' })
  @ApiResponse({
    status: 200,
    description: 'Completed goals retrieved successfully',
  })
  async getCompletedGoals(@Request() req: AuthenticatedRequest) {
    return await this.learningGoalsService.getCompletedGoals(req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific learning goal' })
  @ApiResponse({
    status: 200,
    description: 'Learning goal retrieved successfully',
  })
  async getById(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return await this.learningGoalsService.findOne(id, req.user.id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a learning goal' })
  @ApiResponse({
    status: 200,
    description: 'Learning goal updated successfully',
  })
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateLearningGoalDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return await this.learningGoalsService.update(
      id,
      updateDto,
      req.user.id,
    );
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a learning goal' })
  @ApiResponse({
    status: 200,
    description: 'Learning goal deleted successfully',
  })
  async delete(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    return await this.learningGoalsService.remove(id, req.user.id);
  }

  // ==================== Goal Lifecycle ====================
  @Post(':id/start')
  @ApiOperation({ summary: 'Start working on a goal' })
  @ApiResponse({
    status: 200,
    description: 'Goal started successfully',
  })
  async startGoal(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    return await this.learningGoalsService.startGoal(id, req.user.id);
  }

  @Post(':id/pause')
  @ApiOperation({ summary: 'Pause a goal' })
  @ApiResponse({
    status: 200,
    description: 'Goal paused successfully',
  })
  async pauseGoal(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    return await this.learningGoalsService.pauseGoal(id, req.user.id);
  }

  @Post(':id/complete')
  @ApiOperation({ summary: 'Mark a goal as complete' })
  @ApiResponse({
    status: 200,
    description: 'Goal completed successfully',
  })
  async completeGoal(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return await this.learningGoalsService.completeGoal(id, req.user.id);
  }

  @Post(':id/abandon')
  @ApiOperation({ summary: 'Abandon a goal' })
  @ApiResponse({
    status: 200,
    description: 'Goal abandoned successfully',
  })
  async abandonGoal(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return await this.learningGoalsService.abandonGoal(id, req.user.id);
  }

  // ==================== Goal Progress ====================
  @Post(':id/progress')
  @ApiOperation({ summary: 'Update goal progress' })
  @ApiResponse({
    status: 200,
    description: 'Goal progress updated successfully',
  })
  async updateProgress(
    @Param('id') id: string,
    @Body() updateDto: any,
    @Request() req: AuthenticatedRequest,
  ) {
    return await this.learningGoalsService.updateGoalProgress(
      id,
      updateDto,
      req.user.id,
    );
  }

  @Get(':id/progress')
  @ApiOperation({ summary: 'Get goal progress details' })
  @ApiResponse({
    status: 200,
    description: 'Goal progress retrieved successfully',
  })
  async getProgress(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return await this.learningGoalsService.getGoalProgress(id, req.user.id);
  }

  // ==================== Analytics ====================
  @Get(':id/analytics')
  @ApiOperation({ summary: 'Get goal analytics and insights' })
  @ApiResponse({
    status: 200,
    description: 'Goal analytics retrieved successfully',
  })
  async getAnalytics(@Param('id') id: string) {
    return await this.learningGoalsService.getGoalAnalytics(id);
  }
}
