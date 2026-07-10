import {
  Controller,
  Post,
  Put,
  Param,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { CPDService } from '../services/cpd.service';
import { JwtAuthGuard } from '#modules/auth/guards/jwt-auth.guard';
import { RoleGuard } from '../../../../common/guards/roles.guard';
import { Roles } from '../../../../common/decorators/roles.decorator';
import { Request as ExpressRequest } from 'express';
import { Role } from '#modules/auth/constants/role.constants';

@Controller('cpd')
@UseGuards(JwtAuthGuard, RoleGuard)
export class CPDController {
  constructor(private readonly cpdService: CPDService) {}

  @Put('activities/:id/verify')
  @Roles(Role.admin)
  async verifyActivity(
    @Param('id') activityId: string,
    @Body() data: { verified: boolean; notes?: string },
  ) {
    return this.cpdService.verifyCPDActivity(
      activityId,
      data.verified,
      data.notes,
    );
  }

  @Post('cycles/:cycleId')
  @Roles(Role.admin)
  async updateCPDCycle(
    @Param('cycleId') cycleId: string,
    @Body()
    data: {
      requiredPoints?: number;
    },
  ) {
    return this.cpdService.updateCPDCycle(cycleId, data);
  }
}
