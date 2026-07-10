import {
  Controller,
  Get,
  Param,
  Post,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { WeeklyDigestService } from '../services/weekly-digest.service';
import { JwtAuthGuard } from '#modules/auth/guards/jwt-auth.guard';
import { CustomThrottlerGuard } from '#common/guards/throttle.guard';
import { GenerateWeeklyDigestDto } from '#common/dto/weekly-digest.dto';
import { WeeklyDigest } from '@prisma/client';

interface AuthenticatedUser {
  id: string;
}

@Controller('weekly-digest')
@UseGuards(JwtAuthGuard, CustomThrottlerGuard)
export class WeeklyDigestController {
  constructor(private readonly weeklyDigestService: WeeklyDigestService) {}

  @Post('generate')
  generate(
    @Request() req: { user: AuthenticatedUser },
    @Body() dto: GenerateWeeklyDigestDto,
  ): Promise<WeeklyDigest> {
    const userId = dto.userId || req.user?.id;
    return this.weeklyDigestService.generateWeeklyDigest(userId);
  }

  @Get('latest')
  getLatest(
    @Request() req: { user: AuthenticatedUser },
  ): Promise<WeeklyDigest | null> {
    return this.weeklyDigestService.getLatestDigest(req.user?.id);
  }

  @Post(':digestId/read')
  markRead(@Param('digestId') digestId: string): Promise<WeeklyDigest> {
    return this.weeklyDigestService.markDigestAsRead(digestId);
  }
}
