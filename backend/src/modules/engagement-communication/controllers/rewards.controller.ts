import { Controller, Post, Get, Param, Body } from '@nestjs/common';
import { RewardsService } from '../services/rewards.service';

@Controller('rewards')
export class RewardsController {
  constructor(private readonly rewardsService: RewardsService) {}

  @Post('grant/:userId')
  async grantReward(
    @Param('userId') userId: string,
    @Body('rewardId') rewardId: string,
  ) {
    return this.rewardsService.grantReward(userId, rewardId);
  }

  @Get('user/:userId')
  async getUserRewards(@Param('userId') userId: string) {
    return this.rewardsService.getRewards(userId);
  }
}
