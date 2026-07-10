import { Controller, Get, Query, UseGuards, HttpStatus } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '#modules/auth/guards/jwt-auth.guard';
import { RoleGuard } from '#common/guards/roles.guard';
import { Roles } from '#common/decorators/roles.decorator';
import { Role } from '#modules/auth/constants/role.constants';
import { AuditLogService } from '../services/audit-log.service';
import { PaginationDto } from '#common/dto/pagination.dto';
import type { AuditLogEntry } from '#common/dto/security.dto';

@ApiTags('Audit')
@Controller('auth/audit')
@UseGuards(JwtAuthGuard, RoleGuard)
@Roles(Role.admin) // Only admins can view audit logs
export class AuditController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get audit logs with pagination (Admin only)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of audit logs',
    type: [Object],
  })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Forbidden' })
  async getAuditLogs(
    @Query() pagination: PaginationDto,
  ): Promise<AuditLogEntry[]> {
    const { page = 1, limit = 10 } = pagination;
    return this.auditLogService.getAuditLogs(page, limit);
  }
}
