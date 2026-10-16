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
import { PrismaService } from '#infrastructure/prisma/prisma.service';
import { getErrorMessage } from '#common/utils/error.utils';
import { UserAnalyticsService } from '../services/user-analytics.service';

@ApiTags('Analytics')
@Controller('analytics')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AnalyticsController {
  private readonly logger = new Logger(AnalyticsController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly userAnalyticsService: UserAnalyticsService,
  ) {}

  @Get('user/:userId')
  @ApiOperation({ summary: 'Get user analytics summary' })
  @ApiParam({ name: 'userId', description: 'User UUID' })
  @ApiResponse({ status: 200, description: 'User analytics retrieved successfully' })
  async getUserAnalytics(
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentUser() currentUser: User,
  ) {
    this.assertCanReadUserAnalytics(currentUser, userId);
    this.logger.log(`Fetching user analytics for ${userId}`);

    try {
      const [
        user,
        enrollments,
        quizAttempts,
        progressRecords,
        streakInfo,
      ] = await Promise.all([
        this.prisma.user.findUnique({
          where: { id: userId },
          select: { id: true, lastLogin: true, streakDays: true, points: true },
        }),
        this.prisma.courseEnrollment.findMany({
          where: { userId },
          select: {
            status: true,
            progressPercentage: true,
            course: { select: { title: true } },
          },
        }),
        this.prisma.quizAttempt.findMany({
          where: { userId, completedAt: { not: null } },
          select: { percentage: true, completedAt: true },
        }),
        this.prisma.progress.findMany({
          where: { userId },
          select: {
            timeSpent: true,
            isCompleted: true,
            progressPercentage: true,
            updatedAt: true,
          },
        }),
        this.userAnalyticsService.getUserEngagementMetrics(userId).catch(() => null),
      ]);

      const totalTimeSpentSeconds = progressRecords.reduce(
        (acc, curr) => acc + (curr.timeSpent || 0) * 60,
        0,
      );
      const totalStudyMinutes = Math.round(totalTimeSpentSeconds / 60);
      const totalStudyHours = Math.round((totalStudyMinutes / 60) * 10) / 10;

      const completedCourses = enrollments.filter(
        (e) => e.status === 'completed',
      ).length;
      const totalEnrollments = enrollments.length;
      const completionRate =
        totalEnrollments > 0
          ? Math.round((completedCourses / totalEnrollments) * 100) / 100
          : 0;

      const avgScore =
        quizAttempts.length > 0
          ? Math.round(
              quizAttempts.reduce((acc, attempt) => acc + (attempt.percentage || 0), 0) /
                quizAttempts.length,
            )
          : 0;

      const completedItems = progressRecords.filter((p) => p.isCompleted).length;
      const progressByDate = new Map<string, { total: number; count: number }>();
      for (const record of progressRecords) {
        const date = record.updatedAt.toISOString().slice(0, 10);
        const dailyProgress = progressByDate.get(date) ?? { total: 0, count: 0 };
        dailyProgress.total += record.progressPercentage;
        dailyProgress.count += 1;
        progressByDate.set(date, dailyProgress);
      }

      return {
        userId,
        averageScore: avgScore,
        completionRate,
        timeSpent: totalTimeSpentSeconds,
        lastActive: user?.lastLogin?.toISOString(),
        metrics: {
          quizzesTaken: quizAttempts.length,
          materialsCovered: completedItems,
          studyTime: totalStudyMinutes,
          completedItems,
          accuracy: avgScore / 100,
          streak: streakInfo?.dailyActiveStreak ?? user?.streakDays ?? 0,
          points: user?.points ?? 0,
        },
        totalStudyHours,
        coursesCompleted: completedCourses,
        assessmentsTaken: quizAttempts.length,
        currentModules: enrollments.slice(0, 3).map((e) => e.course.title),
        progressOverTime: [...progressByDate.entries()]
          .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
          .map(([date, dailyProgress]) => ({
            date,
            progress: dailyProgress.total / dailyProgress.count,
          })),
        moduleCompletion: enrollments.map((e) => ({
          moduleName: e.course.title,
          completion: e.progressPercentage ?? (e.status === 'completed' ? 100 : 0),
        })),
      };
    } catch (error) {
      this.logger.error(`Error in getUserAnalytics: ${getErrorMessage(error)}`);
      throw error;
    }
  }

  @Get('insights/:userId')
  @ApiOperation({ summary: 'Get user study and learning insights' })
  @ApiParam({ name: 'userId', description: 'User UUID' })
  @ApiResponse({ status: 200, description: 'User insights retrieved successfully' })
  async getUserInsights(
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentUser() currentUser: User,
  ) {
    this.assertCanReadUserAnalytics(currentUser, userId);
    this.logger.log(`Fetching user insights for ${userId}`);

    try {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const [user, sessions, attempts, goalCount, completedGoalCount, nextGoal] =
        await Promise.all([
          this.prisma.user.findUnique({
            where: { id: userId },
            select: { streakDays: true },
          }),
          this.prisma.studySession.findMany({
            where: {
              userId,
              isValid: true,
              endTime: { not: null },
              startTime: { gte: thirtyDaysAgo },
            },
            select: { startTime: true, duration: true },
            orderBy: { startTime: 'desc' },
            take: 500,
          }),
          this.prisma.quizAttempt.findMany({
            where: { userId, completedAt: { not: null } },
            select: {
              score: true,
              percentage: true,
              quiz: {
                select: {
                  title: true,
                  topic: { select: { name: true } },
                },
              },
            },
            orderBy: { completedAt: 'desc' },
            take: 100,
          }),
          this.prisma.learningGoal.count({ where: { userId } }),
          this.prisma.learningGoal.count({
            where: { userId, completedAt: { not: null } },
          }),
          this.prisma.learningGoal.findFirst({
            where: {
              userId,
              completedAt: null,
              targetDate: { gte: now },
            },
            select: { targetDate: true },
            orderBy: { targetDate: 'asc' },
          }),
        ]);

      const sessionsByHour = new Map<string, number>();
      const studyDays = new Set<string>();
      let totalStudyMinutes = 0;
      let weeklyStudyMinutes = 0;
      let recentWeekSessions = 0;
      for (const session of sessions) {
        const minutes = Math.max(0, session.duration ?? 0);
        totalStudyMinutes += minutes;
        const dateKey = session.startTime.toISOString().slice(0, 10);
        studyDays.add(dateKey);
        if (session.startTime >= sevenDaysAgo) {
          weeklyStudyMinutes += minutes;
          recentWeekSessions += 1;
        }
        const hour = session.startTime.getUTCHours();
        const period =
          hour < 12 ? 'Morning (UTC)' : hour < 17 ? 'Afternoon (UTC)' : 'Evening (UTC)';
        sessionsByHour.set(period, (sessionsByHour.get(period) ?? 0) + 1);
      }

      const averageDuration =
        sessions.length > 0 ? totalStudyMinutes / sessions.length : 0;
      const averageScore = (recentAttempts: typeof attempts) =>
        recentAttempts.length > 0
          ? recentAttempts.reduce(
              (total, attempt) =>
                total + (attempt.percentage > 0 ? attempt.percentage : attempt.score),
              0,
            ) / recentAttempts.length
          : 0;
      const recentScore = averageScore(attempts.slice(0, 5));
      const priorScore = averageScore(attempts.slice(5, 10));
      const topicScores = new Map<string, { total: number; count: number }>();
      for (const attempt of attempts) {
        const topic = attempt.quiz.topic?.name ?? attempt.quiz.title;
        const score = attempt.percentage > 0 ? attempt.percentage : attempt.score;
        const result = topicScores.get(topic) ?? { total: 0, count: 0 };
        result.total += score;
        result.count += 1;
        topicScores.set(topic, result);
      }
      const rankedTopics = [...topicScores.entries()]
        .map(([topic, result]) => ({
          topic,
          score: result.total / result.count,
        }))
        .sort((left, right) => left.score - right.score);
      const improvementAreas = rankedTopics
        .filter((item) => item.score < 70)
        .slice(0, 3)
        .map((item) => item.topic);
      const strengths = rankedTopics
        .filter((item) => item.score >= 80)
        .sort((left, right) => right.score - left.score)
        .slice(0, 3)
        .map((item) => item.topic);
      const optimalPeriod = [...sessionsByHour.entries()].sort(
        (left, right) => right[1] - left[1],
      )[0]?.[0];
      const activeDays = studyDays.size;
      const engagementScore = Math.round((activeDays / 30) * 100);

      return {
        userId,
        learningPattern:
          activeDays >= 8
            ? 'consistent'
            : sessions.length > 0
              ? 'intermittent'
              : 'no_recorded_study',
        optimalStudyTime: optimalPeriod
          ? `${optimalPeriod}; average session ${Math.round(averageDuration)} minutes`
          : 'Not enough completed study sessions to estimate',
        recommendedBreakFrequency: null,
        motivationFactors:
          (user?.streakDays ?? 0) > 0
            ? [`Maintain your current ${user?.streakDays}-day study streak`]
            : [],
        riskFactors:
          sessions.length > 0 && recentWeekSessions === 0
            ? ['No completed study sessions recorded in the past 7 days']
            : [],
        engagementScore,
        learningVelocity:
          attempts.length > 0 ? Math.round(recentScore) : null,
        scoreTrend:
          attempts.length >= 6 ? Math.round(recentScore - priorScore) : null,
        goalAchievementRate:
          goalCount > 0
            ? Math.round((completedGoalCount / goalCount) * 100)
            : null,
        strongestCategories: strengths,
        improvementAreas,
        recommendedNextSteps: improvementAreas.map((topic) => {
          const score = rankedTopics.find((item) => item.topic === topic)?.score ?? 0;
          return `Review ${topic}; your recent quiz average is ${Math.round(score)}%.`;
        }),
        strengths,
        areasForImprovement: improvementAreas,
        estimatedCompletionDate: nextGoal?.targetDate?.toISOString() ?? null,
        sampleSizes: {
          completedSessions: sessions.length,
          completedAssessments: attempts.length,
          activeStudyDaysLast30: activeDays,
        },
      };
    } catch (error) {
      this.logger.error(`Error in getUserInsights: ${getErrorMessage(error)}`);
      throw error;
    }
  }

  private assertCanReadUserAnalytics(currentUser: User, requestedUserId: string): void {
    if (currentUser.id !== requestedUserId && getUserPrimaryRole(currentUser) !== Role.admin) {
      throw new ForbiddenException('You can only access your own analytics');
    }
  }

  @Get('progress')
  @ApiOperation({ summary: 'Get general progress data' })
  async getProgress(@CurrentUser() currentUser: User) {
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 6);
    weekStart.setHours(0, 0, 0, 0);
    const [user, allStudyTime, weeklyStudyTime, enrollments, weeklySessions] =
      await Promise.all([
        this.prisma.user.findUnique({
          where: { id: currentUser.id },
          select: { streakDays: true },
        }),
        this.prisma.studySession.aggregate({
          where: { userId: currentUser.id, isValid: true, endTime: { not: null } },
          _sum: { duration: true },
        }),
        this.prisma.studySession.aggregate({
          where: {
            userId: currentUser.id,
            isValid: true,
            endTime: { not: null },
            startTime: { gte: weekStart },
          },
          _sum: { duration: true },
        }),
        this.prisma.courseEnrollment.aggregate({
          where: { userId: currentUser.id },
          _avg: { progressPercentage: true },
        }),
        this.prisma.studySession.findMany({
          where: {
            userId: currentUser.id,
            isValid: true,
            endTime: { not: null },
            startTime: { gte: weekStart },
          },
          select: { startTime: true },
        }),
      ]);
    const activeStudyDaysThisWeek = new Set(
      weeklySessions.map((session) => session.startTime.toISOString().slice(0, 10)),
    ).size;

    return {
      dailyStreak: user?.streakDays ?? 0,
      weeklyStudyMinutes: weeklyStudyTime._sum.duration ?? 0,
      totalHoursStudied: Math.round(((allStudyTime._sum.duration ?? 0) / 60) * 10) / 10,
      activeStudyDaysThisWeek,
      courseCompletionRate:
        Math.round((enrollments._avg.progressPercentage ?? 0) * 10) / 10,
    };
  }

  @Get('metrics')
  @UseGuards(RoleGuard)
  @Roles(Role.admin)
  @ApiOperation({ summary: 'Get overall analytics metrics' })
  async getMetrics() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [totalUsers, totalCourses, activeToday, courseRating] =
      await Promise.all([
        this.prisma.user.count(),
        this.prisma.course.count({ where: { status: 'published' } }),
        this.prisma.user.count({ where: { lastLogin: { gte: today } } }),
        this.prisma.course.aggregate({
          where: { status: 'published', rating: { gt: 0 } },
          _avg: { rating: true },
        }),
      ]);
    return {
      totalUsers,
      totalCourses,
      activeToday,
      averageRating: Math.round((courseRating._avg.rating ?? 0) * 10) / 10,
    };
  }
}
