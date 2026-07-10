import { Controller, Post, Param, Body, Get } from '@nestjs/common';
import { GamificationService } from '../services/gamification.service';

@Controller('gamification')
export class GamificationController {
  constructor(private readonly gamificationService: GamificationService) {}

  @Post('award/:userId')
  async awardPoints(
    @Param('userId') userId: string,
    @Body('points') points: number,
  ) {
    return this.gamificationService.awardPoints(userId, points);
  }

  @Get('points/:userId')
  async getPoints(@Param('userId') userId: string) {
    return this.gamificationService.getUserPoints(userId);
  }
}
