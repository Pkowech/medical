import { Controller, Get, Param, UseGuards, Request } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '#modules/auth/guards/jwt-auth.guard';
import {
  BlueprintService,
  BoardReadinessResult,
} from '../services/blueprint.service';
import { AssessmentAnalyticsService } from '../../../ai-analytics/services/assessment-analytics.service';

@ApiTags('Blueprint')
@Controller('blueprint')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class BlueprintController {
  constructor(
    private readonly blueprintService: BlueprintService,
    private readonly analyticsService: AssessmentAnalyticsService,
  ) {}

  @Get(':learningPathId/readiness')
  @ApiOperation({ summary: 'Get Board Readiness score for an exam blueprint' })
  @ApiResponse({
    status: 200,
    description: 'Returns weighted readiness score with topic breakdown',
  })
  async getBoardReadiness(
    @Param('learningPathId') learningPathId: string,
    @Request() req: any,
  ): Promise<BoardReadinessResult> {
    const userId = req.user?.id;
    return this.blueprintService.calculateBoardReadiness(
      userId,
      learningPathId,
    );
  }

  @Get('summary')
  @ApiOperation({
    summary: 'Get summary of all exam blueprints with readiness scores',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns list of blueprints with readiness percentages',
  })
  async getBlueprintSummary(@Request() req: any) {
    const userId = req.user?.id;
    return this.blueprintService.getUserBlueprintSummary(userId);
  }

  @Get('breakdown/:userId')
  @ApiOperation({ summary: 'Get performance breakdown by category' })
  @ApiResponse({ status: 200, type: Object })
  async getCategoryBreakdown(@Param('userId') userId: string) {
    const profile =
      await this.analyticsService.getUserPerformanceProfile(userId);
    return profile.categoryAbilities;
  }

  @Get('mastery/:userId')
  @ApiOperation({ summary: 'Get topic mastery levels' })
  @ApiResponse({ status: 200, type: Object })
  async getMastery(@Param('userId') userId: string) {
    return await this.analyticsService.getMastery(userId);
  }
}
