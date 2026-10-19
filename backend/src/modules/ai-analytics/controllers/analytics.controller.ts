import {
  Controller,
  Get,
  Param,
  UseGuards,
  Logger,
  ParseUUIDPipe,
  ForbiddenException,
} from '@nestjs/common';
import { User } from '@prisma/client';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '#modules/auth/guards/jwt-auth.guard';
import { RoleGuard } from '#common/guards/roles.guard';
import { Roles } from '#common/decorators/roles.decorator';
import { CurrentUser } from '#common/decorators/current-user.decorator';
import { Role } from '#modules/auth/constants/role.constants';
import { getUserPrimaryRole } from '#common/utils/role.util';
import { getErrorMessage } from '#common/utils/error.utils';
import { UserAnalyticsService } from '../services/user-analytics.service';

@ApiTags('Analytics')
@Controller('analytics')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AnalyticsController {
  private readonly logger = new Logger(AnalyticsController.name);

  constructor(private readonly userAnalyticsService: UserAnalyticsService) {}

  @Get('user/:userId')
  @ApiOperation({ summary: 'Get user analytics summary' })
  @ApiParam({ name: 'userId', description: 'User UUID' })
  @ApiResponse({
    status: 200,
    description: 'User analytics retrieved successfully',
  })
  async getUserAnalytics(
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentUser() currentUser: User,
  ) {
    this.assertCanReadUserAnalytics(currentUser, userId);
    this.logger.log(`Fetching user analytics for ${userId}`);

    try {
      const [stats, analytics] = await Promise.all([
        this.userAnalyticsService.getUserProfileStats(userId),
        this.userAnalyticsService.getDetailedUserAnalytics(userId),
      ]);
      const progressOverTime = analytics.courseProgressTrends.map((trend) => {
        if (!trend.date || Number.isNaN(trend.date.getTime())) {
          throw new Error(
            'Rust analytics returned a progress trend without a valid date',
          );
        }
        return {
          date: trend.date.toISOString(),
          progress: trend.value,
        };
      });

      return {
        userId,
        averageScore: stats.averageScore,
        completionRate: stats.completionRate,
        timeSpent: stats.totalStudyTime * 60,
        lastActive: stats.lastActiveDate ?? undefined,
        metrics: {
          quizzesTaken: stats.assessmentsTaken,
          materialsCovered: stats.completedItems,
          studyTime: stats.totalStudyTime,
          completedItems: stats.completedItems,
          accuracy: stats.averageScore / 100,
          streak: stats.currentStreak,
          points: stats.points,
        },
        totalStudyHours: Math.round((stats.totalStudyTime / 60) * 10) / 10,
        coursesCompleted: stats.coursesCompleted,
        assessmentsTaken: stats.assessmentsTaken,
        currentModules: stats.enrollments
          .flatMap((enrollment) =>
            enrollment.title ? [enrollment.title] : [],
          )
          .slice(0, 3),
        progressOverTime,
        moduleCompletion: stats.enrollments.flatMap((enrollment) =>
          enrollment.title && enrollment.progressPercentage !== null
            ? [{
                moduleName: enrollment.title,
                completion: enrollment.progressPercentage,
              }]
            : [],
        ),
      };
    } catch (error) {
      this.logger.error(`Error in getUserAnalytics: ${getErrorMessage(error)}`);
      throw error;
    }
  }

  @Get('insights/:userId')
  @ApiOperation({ summary: 'Get user study and learning insights' })
  @ApiParam({ name: 'userId', description: 'User UUID' })
  @ApiResponse({
    status: 200,
    description: 'User insights retrieved successfully',
  })
  async getUserInsights(
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentUser() currentUser: User,
  ) {
    this.assertCanReadUserAnalytics(currentUser, userId);
    this.logger.log(`Fetching user insights for ${userId}`);

    try {
      return await this.userAnalyticsService.getUserInsights(userId);
    } catch (error) {
      this.logger.error(`Error in getUserInsights: ${getErrorMessage(error)}`);
      throw error;
    }
  }

  private assertCanReadUserAnalytics(
    currentUser: User,
    requestedUserId: string,
  ): void {
    if (
      currentUser.id !== requestedUserId &&
      getUserPrimaryRole(currentUser) !== Role.admin
    ) {
      throw new ForbiddenException('You can only access your own analytics');
    }
  }

  @Get('progress')
  @ApiOperation({ summary: 'Get general progress data' })
  async getProgress(@CurrentUser() currentUser: User) {
    const [engagement, courseStats] = await Promise.all([
      this.userAnalyticsService.getUserEngagementMetrics(currentUser.id),
      this.userAnalyticsService.getCourseStatistics(currentUser.id),
    ]);

    return {
      dailyStreak: engagement.dailyActiveStreak,
      weeklyStudyMinutes: engagement.weeklyStudyMinutes,
      totalHoursStudied:
        Math.round((engagement.totalStudyTimeMinutes / 60) * 10) / 10,
      activeStudyDaysThisWeek: engagement.activeStudyDaysThisWeek,
      courseCompletionRate:
        Math.round(courseStats.averageCourseProgress * 10) / 10,
    };
  }

  @Get('metrics')
  @UseGuards(RoleGuard)
  @Roles(Role.admin)
  @ApiOperation({ summary: 'Get overall analytics metrics' })
  async getMetrics() {
    const analytics = await this.userAnalyticsService.getSystemAnalytics();
    return {
      totalUsers: analytics.totalUsers,
      totalCourses: analytics.publishedCourses,
      activeToday: analytics.activeToday,
      averageRating: Math.round(analytics.averageCourseRating * 10) / 10,
    };
  }
}
