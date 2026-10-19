import { Controller, Get, Param, Post, Body } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { UserFeaturesService } from '../services/user-features.service';

@Controller('user-features')
export class UserFeaturesController {
  constructor(private readonly userFeaturesService: UserFeaturesService) {}

  @Get(':userId')
  @ApiOperation({
    summary: 'Get legacy Redis-derived user features',
    deprecated: true,
  })
  async getFeatures(@Param('userId') userId: string) {
    return this.userFeaturesService.getUserFeatures(userId);
  }

  @Get(':userId/vector')
  @ApiOperation({ summary: 'Get Rust-computed user feature vector' })
  async getFeatureVector(@Param('userId') userId: string) {
    return this.userFeaturesService.getRustUserFeatureVector(userId);
  }

  @Post(':userId/enable')
  async enableFeature(
    @Param('userId') userId: string,
    @Body('feature') feature: string,
  ) {
    return this.userFeaturesService.enableFeature(userId, feature);
  }

  @Post(':userId/disable')
  async disableFeature(
    @Param('userId') userId: string,
    @Body('feature') feature: string,
  ) {
    return this.userFeaturesService.disableFeature(userId, feature);
  }
}
