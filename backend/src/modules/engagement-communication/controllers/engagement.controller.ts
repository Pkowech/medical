import { Controller, Get, Param } from '@nestjs/common';
import { PeerBenchmarkingService } from '../services/peer-benchmarking.service';
import { AiAnalyticsService } from '#modules/ai-analytics/services/ai-analytics.service';

@Controller('engagement')
export class EngagementController {
  constructor(
    private readonly peerBenchmarkingService: PeerBenchmarkingService,
    private readonly analyticsService: AiAnalyticsService,
  ) {}

  @Get('peer-benchmarking/:userId/:topicId')
  async getPeerStats(
    @Param('userId') userId: string,
    @Param('topicId') topicId: string,
  ) {
    return this.peerBenchmarkingService.getPeerStats(userId, topicId);
  }

  @Get('leaderboard/:topicId')
  async getLeaderboard(@Param('topicId') topicId: string) {
    return this.peerBenchmarkingService.getLeaderboard(topicId);
  }

  @Get('study-group/:groupId')
  async getStudyGroupStats(@Param('groupId') groupId: string) {
    return this.peerBenchmarkingService.getStudyGroupStats(groupId);
  }

  @Get('insights/:userId')
  async getUserInsights(@Param('userId') userId: string) {
    return this.analyticsService.getUserEngagement(userId);
  }
}
