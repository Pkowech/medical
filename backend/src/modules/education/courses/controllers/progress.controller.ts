import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
  ParseUUIDPipe,
  ValidationPipe,
  Headers,
  Query,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { Request as ExpressRequest } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { ProgressStatus } from '@prisma/client';
import { ProgressService } from '../services/progress.service';
import { JwtAuthGuard } from '#modules/auth/guards/jwt-auth.guard';
import { AssessmentAnalyticsService } from '../../../ai-analytics/services/assessment-analytics.service';
import { StudyService } from '../services/study.service';

interface UserRequest extends ExpressRequest {
  user?: { id: string };
}

@ApiTags('Progress')
@Controller('progress')
@UseGuards(JwtAuthGuard)
export class ProgressController {
  constructor(
    private readonly progressService: ProgressService,
    private readonly assessmentAnalyticsService: AssessmentAnalyticsService,
    private readonly studyService: StudyService,
  ) {}

  @Get('dashboard/:userId')
  @ApiOperation({
    summary: 'Get aggregated study dashboard data to reduce HTTP round-trips',
  })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'Aggregated dashboard data' })
  async getDashboardData(@Param('userId') userIdParam: string, @Request() req: UserRequest) {
    if (userIdParam === 'me' && (!req.user?.id)) {
      throw new BadRequestException('User ID not available in request');
    }
    const userId = userIdParam === 'me' ? req.user!.id : userIdParam;
    const achievements = this.progressService.getUserAchievements();
    
    // Fetch all components with individual error handling to ensure resilience
    // If one service (e.g. gRPC analytics) is down, we still want to show the rest
    const [
      overviewResult,
      coursesResult,
      enrolledUnitsResult,
      activitiesResult,
      peerComparisonResult,
      streaksResult,
      deadlinesResult,
      dueReviewsResult,
    ] = await Promise.allSettled([
      this.progressService.getUserOverallProgress(userId),
      this.progressService.getCourseProgress(userId),
      this.progressService.getEnrolledUnitsDashboard(userId),
      this.progressService.getUserActivities(userId),
      this.progressService.getPeerComparison(userId),
      this.progressService.getUserStreaks(userId),
      this.studyService.getDeadlines(userId),
      this.studyService.getDueReviews(userId),
    ]);

    return {
      overview: overviewResult.status === 'fulfilled' ? overviewResult.value : null,
      courses: coursesResult.status === 'fulfilled' ? coursesResult.value : [],
      enrolledUnits: enrolledUnitsResult.status === 'fulfilled' ? enrolledUnitsResult.value : [],
      activities: activitiesResult.status === 'fulfilled' ? activitiesResult.value : [],
      achievements,
      peerComparison: peerComparisonResult.status === 'fulfilled' ? peerComparisonResult.value : null,
      streaks: streaksResult.status === 'fulfilled' ? streaksResult.value : null,
      deadlines: deadlinesResult.status === 'fulfilled' ? deadlinesResult.value : [],
      dueReviews: dueReviewsResult.status === 'fulfilled' ? dueReviewsResult.value : [],
    };
  }





  @Get('overview/:userId')
  @ApiOperation({ summary: 'Get user progress overview across all units' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiResponse({
    status: 200,
    description: 'Progress overview retrieved successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getProgressOverview(@Param('userId', ParseUUIDPipe) userId: string) {
    // Return the full overall progress object (includes stats, streaks, enrollments)
    return this.progressService.getUserOverallProgress(userId);
  }

  @Get('me')
  @ApiOperation({ summary: 'Get progress for the authenticated user' })
  @ApiResponse({
    status: 200,
    description: 'User progress retrieved successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getMyProgress(@Request() req: any) {
    return this.progressService.getUserOverallProgress(req.user.id);
  }

  @Get('courses/:userId')
  @ApiOperation({ summary: 'Get course progress for a specific user' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiResponse({
    status: 200,
    description: 'Course progress retrieved successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getCourseProgress(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.progressService.getCourseProgress(userId);
  }

  @Get('courses/:courseId/detailed')
  @ApiOperation({
    summary: 'Get detailed progress for a specific course (current user)',
  })
  @ApiParam({ name: 'courseId', description: 'Course ID' })
  @ApiResponse({
    status: 200,
    description: 'Detailed course progress retrieved successfully',
  })
  async getDetailedCourseProgress(
    @Request() req: any,
    @Param('courseId', ParseUUIDPipe) courseId: string,
  ) {
    return this.progressService.getUserProgress(req.user.id, courseId);
  }

  @Get('activities')
  @ApiOperation({ summary: 'Get recent user activities' })
  @ApiResponse({
    status: 200,
    description: 'User activities retrieved successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getUserActivities(@Request() req: any) {
    return this.progressService.getUserActivities(req.user.id);
  }

  @Get('achievements')
  @ApiOperation({ summary: 'Get user achievements' })
  @ApiResponse({
    status: 200,
    description: 'User achievements retrieved successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getUserAchievements() {
    return this.progressService.getUserAchievements();
  }

  @Get('peer-comparison/:userId')
  @ApiOperation({ summary: 'Get peer comparison and analytics for user' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiResponse({
    status: 200,
    description: 'Peer comparison data retrieved successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getPeerComparison(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.progressService.getPeerComparison(userId);
  }

  @Post('materials/:materialId/read')
  @ApiOperation({
    summary: 'Mark a material as read for the authenticated user',
  })
  @ApiParam({ name: 'materialId', description: 'Material ID' })
  @ApiResponse({
    status: 201,
    description: 'Material marked as read successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Material not found' })
  @ApiResponse({ status: 409, description: 'Conflict - server has newer data' })
  async markMaterialAsRead(
    @Param('materialId', ParseUUIDPipe) materialId: string,
    @Request() req: any,
    @Headers('X-Client-Timestamp') clientTimestampHeader?: string,
  ) {
    const clientTimestamp = clientTimestampHeader
      ? BigInt(clientTimestampHeader)
      : undefined;
    return this.progressService.markMaterialAsRead(
      req.user.id,
      materialId,
      clientTimestamp,
    );
  }

  /**
   * Get comprehensive learning analytics for a user
   */
  @Get('learning-insights/:userId')
  @ApiOperation({ summary: 'Get user learning analytics' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiResponse({
    status: 200,
    description:
      'Returns detailed learning analytics including quiz scores and unit completions',
  })
  async getUserLearningAnalytics(
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.assessmentAnalyticsService.getUserLearningAnalytics(userId);
  }

  /**
   * Get user streak information
   */
  @Get('streaks/:userId')
  @ApiOperation({ summary: 'Get user current and longest streak' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiResponse({
    status: 200,
    description: 'Returns current streak and longest streak data',
    schema: {
      example: {
        userId: 'uuid',
        currentStreak: 5,
        longestStreak: 14,
        lastActivityDate: '2025-01-05T12:00:00Z',
      },
    },
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getUserStreaks(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.progressService.getUserStreaks(userId);
  }

  @Get('sync')
  @ApiOperation({ summary: 'Get progress data for synchronization' })
  @ApiQuery({ name: 'userId', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'Progress data retrieved' })
  async getSyncProgress(@Query('userId', ParseUUIDPipe) userId: string) {
    return this.progressService.getProgressByUser(userId);
  }

  @Post('sync')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Save progress data from synchronization' })
  @ApiResponse({ status: 200, description: 'Progress saved successfully' })
  async saveSyncProgress(
    @Request() req: any,
    @Body() progress: any,
    @Headers('X-Client-Timestamp') clientTimestampHeader?: string,
  ) {
    const clientTimestamp = clientTimestampHeader
      ? BigInt(clientTimestampHeader)
      : undefined;

    if (progress.unitId || progress.materialId || progress.topicId) {
      return this.progressService.updateUnitMaterialTopicProgress(req.user.id, {
        ...progress,
        status: progress.status || 'completed',
        progressPercentage: progress.progressPercentage || 100,
        timeSpent: progress.timeSpentMinutes || progress.timeSpent || 0,
        clientTimestamp,
      });
    }
    return { success: true, count: 0 };
  }
}
