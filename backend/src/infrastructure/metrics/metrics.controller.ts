import { Controller, Get, UseGuards } from '@nestjs/common';
import { MetricsService } from './metrics.service';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '#modules/auth/guards/jwt-auth.guard';
import { RoleGuard } from '#common/guards/roles.guard';
import { Roles } from '#common/decorators/roles.decorator';
import { Role } from '#modules/auth/constants/role.constants';

@ApiTags('Monitoring')
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get()
  @ApiOperation({ summary: 'Get application metrics' })
  async getMetrics(): Promise<string> {
    return this.metricsService.getMetrics();
  }

  @Get('summary')
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles(Role.admin)
  @ApiOperation({
    summary: 'Get a JSON summary of application metrics (admin only)',
  })
  async getMetricsSummary() {
    return this.metricsService.getMetricsSummary();
  }
}
