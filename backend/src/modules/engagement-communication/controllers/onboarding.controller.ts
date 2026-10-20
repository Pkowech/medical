import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '#modules/auth/guards/jwt-auth.guard';
import { OnboardingService } from '../services/onboarding.service';
import {
  CompleteOnboardingDto,
  OnboardingStatusResponseDto,
} from '#common/dto/onboarding.dto';
import type { AuthenticatedRequest } from '#common/dto/user.dto';

@ApiTags('Onboarding')
@Controller('onboarding')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Get('status')
  @ApiOperation({ summary: 'Get current user onboarding status and profile completeness' })
  @ApiResponse({
    status: 200,
    description: 'Onboarding status retrieved successfully',
    type: OnboardingStatusResponseDto,
  })
  async getStatus(@Request() req: AuthenticatedRequest): Promise<OnboardingStatusResponseDto> {
    return this.onboardingService.getOnboardingStatus(req.user.id);
  }

  @Post('complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Complete onboarding with discipline, stage, target milestone, and study preferences' })
  @ApiResponse({
    status: 200,
    description: 'Onboarding completed and starter roadmap generated',
    type: OnboardingStatusResponseDto,
  })
  async complete(
    @Request() req: AuthenticatedRequest,
    @Body() dto: CompleteOnboardingDto,
  ): Promise<OnboardingStatusResponseDto> {
    return this.onboardingService.completeOnboarding(req.user.id, dto);
  }

  @Get('starter-paths')
  @ApiOperation({ summary: 'Get suggested starter pathways for a discipline or specialization' })
  @ApiResponse({
    status: 200,
    description: 'Starter pathways retrieved successfully',
  })
  async getStarterPaths(
    @Query('field') field?: string,
    @Query('specialization') specialization?: string,
    @Query('limit') limit: number = 4,
  ) {
    return this.onboardingService.getSuggestedStarterPaths(field, specialization, limit);
  }
}
