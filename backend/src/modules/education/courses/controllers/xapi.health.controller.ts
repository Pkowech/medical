import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { XapiService } from '../services/xapi.service';
import { JwtAuthGuard } from '#modules/auth/guards/jwt-auth.guard';
import { RoleGuard } from '../../../../common/guards/roles.guard';
import { Roles } from '../../../../common/decorators/roles.decorator';
import { Role } from '#modules/auth/constants/role.constants';

@ApiTags('xAPI')
@Controller('internal/health')
@UseGuards(JwtAuthGuard, RoleGuard)
export class XapiHealthController {
  constructor(private readonly xapiService: XapiService) {}

  @Get('xapi')
  @Roles(Role.admin)
  @ApiOperation({ summary: 'Get xAPI health metrics (admin only)' })
  getXapiHealth() {
    return this.xapiService.getHealthMetrics();
  }
}
