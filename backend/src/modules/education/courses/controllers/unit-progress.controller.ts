import { Body, Controller, Post, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '#modules/auth/guards/jwt-auth.guard';
import { GetUser } from '#common/decorators/get-user.decorator';
import { User as PrismaUser } from '@prisma/client';
import { ProgressService } from '../services/progress.service';
import { MasteryGateService } from '../services/mastery-gate.service';

@ApiTags('Units Progress')
@Controller('units')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UnitProgressController {
  constructor(
    private readonly progressService: ProgressService,
    private readonly masteryGateService: MasteryGateService,
  ) {}

  @Post(':id/start')
  @ApiOperation({ summary: 'Start a unit and mark it as in progress' })
  async startUnit(@Param('id') unitId: string, @GetUser() user: PrismaUser) {
    return this.progressService.startUnit(user.id, unitId);
  }

  @Post(':id/activate')
  @ApiOperation({ summary: 'Activate a unit within the concurrent study limit' })
  async activateUnit(
    @Param('id') unitId: string,
    @Body('maxConcurrent') maxConcurrent: number | undefined,
    @GetUser() user: PrismaUser,
  ) {
    return this.masteryGateService.activateUnit(
      user.id,
      unitId,
      maxConcurrent ?? 4,
    );
  }
}
