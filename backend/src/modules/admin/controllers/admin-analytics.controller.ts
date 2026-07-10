import { Controller, Get, Post, Body, Query, UseGuards, Logger, Request } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AdminAnalyticsService } from '../services/admin-analytics.service';
import { JwtAuthGuard } from '#modules/auth/guards/jwt-auth.guard';
import { RoleGuard } from '#common/guards/roles.guard';
import { Roles } from '#common/decorators/roles.decorator';
import { Role } from '#modules/auth/constants/role.constants';
import { AssessmentAnalyticsService } from '../../ai-analytics/services/assessment-analytics.service';
import { PerformanceMetricsService } from '#infrastructure/monitoring/performance-metrics.service';
import {
  AnalyticsQueryDto,
  PerformanceMetricDto,
  PageLoadMetricDto,
  ApiPerformanceMetricDto,
  FlushPerformanceDto,
} from '#common/dto/analytics.dto';

@ApiTags('Admin System Overview')
@Controller('admin/system-overview')
@UseGuards(JwtAuthGuard, RoleGuard)
@Roles(Role.admin)
export class AdminAnalyticsController {
  private readonly logger = new Logger(AdminAnalyticsController.name);

  constructor(
    private readonly adminAnalyticsService: AdminAnalyticsService,
    private readonly assessmentAnalyticsService: AssessmentAnalyticsService,
  ) {}

  @Get('summary')
  async getSystemAnalytics() {
    this.logger.log('GET /admin/system-overview/summary');
    return this.adminAnalyticsService.getSystemAnalytics();
  }

  @Get('ai-summary')
  getSystemAnalyticsFromAI() {
    return this.adminAnalyticsService.getSystemAnalyticsFromAI();
  }

  @Get('progress-data')
  getProgressRecordsForPeriod(
    @Query('start') start: string,
    @Query('end') end: string,
  ) {
    return this.adminAnalyticsService.getProgressRecordsForPeriod(start, end);
  }

  @Post('process-insights')
  processAnalyticsForUsers(@Body() userIds: string[]) {
    return this.adminAnalyticsService.processAnalyticsForUsers(userIds);
  }

  @Get('trending')
  getTrendingPaths(@Query('limit') limit: string) {
    return this.adminAnalyticsService.getTrendingPaths(parseInt(limit, 10));
  }

  @Get('consolidated-data')
  getConsolidatedAnalytics() {
    return this.assessmentAnalyticsService.getConsolidatedAnalytics();
  }
}


