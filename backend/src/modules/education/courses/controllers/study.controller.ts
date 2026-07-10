// src/modules/study/controllers/study.controller.ts
import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  UseGuards,
  Query,
} from '@nestjs/common';
import { StudyService } from '../services/study.service';
import { JwtAuthGuard } from '#modules/auth/guards/jwt-auth.guard';
import { RoleGuard } from '../../../../common/guards/roles.guard';
import { Roles } from '../../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { User } from '@prisma/client';
import { Role } from '#modules/auth/constants/role.constants';
import { ApiOperation, ApiQuery } from '@nestjs/swagger';

@Controller('study')
@UseGuards(JwtAuthGuard, RoleGuard)
export class StudyController {
  constructor(private readonly studyService: StudyService) {}

  @Get('topics/:category')
  @Roles(Role.student)
  async getTopicsByCategory(@Param('category') category: string) {
    return this.studyService.getTopicsByCategory(category);
  }

  @Get('progress/:topicId')
  @Roles(Role.student)
  async getTopicProgress(
    @CurrentUser() user: User,
    @Param('topicId') topicId: string,
  ) {
    return this.studyService.getTopicProgress(user.id, topicId);
  }

  @Post('session/start')
  @Roles(Role.student)
  async startStudySession(
    @CurrentUser() user: User,
    @Body()
    body: {
      topicId?: string;
      context?: { type: 'course' | 'unit' | 'topic' | 'material'; id: string };
    },
  ) {
    return this.studyService.startStudySession(
      user.id,
      body.context,
      body.topicId,
    );
  }

  @Put('session/:sessionId/end')
  @Roles(Role.student)
  async endStudySession(
    @Param('sessionId') sessionId: string,
    @Body('activities') activities: any[],
  ) {
    return this.studyService.endStudySession(sessionId, activities);
  }

  @Post('session/:sessionId/focus')
  @Roles(Role.student)
  @ApiOperation({ summary: 'Record a focus gain/loss event' })
  async recordFocusEvent(
    @Param('sessionId') sessionId: string,
    @Body() body: { type: 'gained' | 'lost'; timestamp?: string },
  ) {
    return this.studyService.recordFocusEvent(sessionId, {
      type: body.type,
      timestamp: body.timestamp ? new Date(body.timestamp) : new Date(),
    });
  }

  @Get('overview')
  @Roles(Role.student)
  async getStudyStats(@CurrentUser() user: User) {
    return this.studyService.getStudyStats(user.id);
  }
  @Get('reviews/due')
  @Roles(Role.student)
  async getDueReviews(@CurrentUser() user: User) {
    return this.studyService.getDueReviews(user.id);
  }

  @Get('focus-recommendations')
  @Roles(Role.student)
  async getFocusRecommendations(@CurrentUser() user: User) {
    return this.studyService.getFocusRecommendations(user.id);
  }

  @Get('sessions')
  @Roles(Role.student)
  @ApiOperation({ summary: 'Get all study sessions for user' })
  @ApiQuery({ name: 'courseId', required: false })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  async getUserSessions(
    @CurrentUser() user: User,
    @Query('courseId') courseId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.studyService.getUserSessions(user.id, {
      courseId,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });
  }

  @Get('data/summary')
  @Roles(Role.student)
  @ApiOperation({ summary: 'Get study session statistics summary' })
  @ApiQuery({
    name: 'period',
    required: false,
    enum: ['week', 'month', 'year'],
  })
  async getStudyStatsSummary(
    @CurrentUser() user: User,
    @Query('period') period: 'week' | 'month' | 'year' = 'month',
  ) {
    return this.studyService.getLegacyStudyStatistics(user.id, period);
  }

  @Get('deadlines')
  @Roles(Role.student, Role.admin)
  @ApiOperation({ summary: 'Get upcoming deadlines for the current user' })
  async getMyDeadlines(@CurrentUser() user: User) {
    return this.studyService.getDeadlines(user.id);
  }

  @Get('resume/:courseId')
  @Roles(Role.student)
  @ApiOperation({ summary: 'Get the resume point (next topic) for a course' })
  async getResumePoint(
    @CurrentUser() user: User,
    @Param('courseId') courseId: string,
  ) {
    return this.studyService.getResumePoint(user.id, courseId);
  }
}
