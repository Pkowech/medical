// src/modules/auth/controllers/sessions.controller.ts
import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Req,
  UseGuards,
  Logger,
  UnauthorizedException,
  Headers,
} from '@nestjs/common';
import { JwtAuthGuard } from '#modules/auth/guards/jwt-auth.guard';
import { RoleGuard } from '#common/guards/roles.guard';
import type { AuthenticatedRequest } from '#common/dto/user.dto';
import { SessionTrackingService } from '../../auth/services/session-tracking.service';
import { SecurityService } from '../../auth/services/security.service';
import { AuditLogService } from '../../auth/services/audit-log.service';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Roles } from '#common/decorators/roles.decorator';
import { Role } from '#modules/auth/constants/role.constants';
import { getErrorMessage, getErrorStack } from '#common/utils/error.utils';
import type { SessionInfo } from '#common/dto/security.dto';
import { securityEventTypes } from '#common/dto/security.dto';

@ApiTags('sessions')
@Controller('auth/sessions')
@UseGuards(JwtAuthGuard, RoleGuard)
@Roles(Role.student) // Minimum role: student
export class SessionsController {
  private readonly logger = new Logger(SessionsController.name);

  constructor(
    private readonly sessionTrackingService: SessionTrackingService,
    private readonly auditLogService: AuditLogService,
    private readonly securityService: SecurityService,
  ) {}

  @Get()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all active sessions for the user' })
  @ApiResponse({
    status: 200,
    description: 'List of active sessions',
    type: Object,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getActiveSessions(
    @Req() req: AuthenticatedRequest,
  ): Promise<SessionInfo[]> {
    const user = req.user;
    if (!user?.id) {
      throw new UnauthorizedException('User not authenticated');
    }

    try {
      const sessions = await this.sessionTrackingService.getUserSessions(
        user.id,
      );
      await this.auditLogService.log(
        securityEventTypes.suspiciousActivity,
        user.id,
        req.ip || 'unknown',
        req.get('user-agent') || 'unknown',
        {
          action: 'view_sessions',
          success: true,
          sessionCount: sessions.length,
        },
      );
      return sessions;
    } catch (error) {
      this.logger.error(
        `Failed to fetch sessions for user ${user.id}: ${getErrorMessage(error)}`,
        getErrorStack(error),
      );
      throw error;
    }
  }

  @Delete(':sessionId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke a specific session' })
  @ApiResponse({ status: 200, description: 'Session revoked successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Session not found' })
  async revokeSession(
    @Param('sessionId') sessionId: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<void> {
    const user = req.user;
    if (!user?.id) {
      throw new UnauthorizedException('User not authenticated');
    }

    try {
      await this.sessionTrackingService.removeSession(sessionId, user.id);
      await this.auditLogService.log(
        securityEventTypes.sessionRevoked,
        user.id,
        req.ip || 'unknown',
        req.get('user-agent') || 'unknown',
        { action: 'revoke_session', sessionId, success: true },
      );
    } catch (error) {
      this.logger.error(
        `Failed to revoke session ${sessionId} for user ${user.id}: ${getErrorMessage(error)}`,
        getErrorStack(error),
      );
      throw error;
    }
  }

  @Post('logout')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Logout user from current device',
  })
  @ApiResponse({
    status: 200,
    description: 'Current session revoked successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async logout(
    @Req() req: AuthenticatedRequest,
    @Headers('authorization') authorization: string,
  ): Promise<{ message: string }> {
    const user = req.user;
    if (!user?.id) {
      throw new UnauthorizedException('User not authenticated');
    }

    try {
      const token = authorization?.replace('Bearer ', '');
      if (token) {
        await this.sessionTrackingService.endSessionByToken(user.id, token);
      }

      await this.auditLogService.log(
        securityEventTypes.logoutSuccess,
        user.id,
        req.ip || 'unknown',
        req.get('user-agent') || 'unknown',
        {
          action: 'logout_current_session',
          success: true,
        },
      );
      return { message: 'Successfully logged out from current device' };
    } catch (error) {
      this.logger.error(
        `Failed to logout user ${user.id}: ${getErrorMessage(error)}`,
        getErrorStack(error),
      );
      throw error;
    }
  }

  @Post('revoke-all')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke all sessions for the user' })
  @ApiResponse({
    status: 200,
    description: 'All sessions revoked successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async revokeAllSessions(@Req() req: AuthenticatedRequest): Promise<void> {
    const user = req.user;
    if (!user?.id) {
      throw new UnauthorizedException('User not authenticated');
    }

    try {
      const sessions = await this.sessionTrackingService.getUserSessions(
        user.id,
      );
      for (const session of sessions) {
        await this.sessionTrackingService.removeSession(session.id, user.id);
      }
      await this.auditLogService.log(
        securityEventTypes.sessionRevoked,
        user.id,
        req.ip || 'unknown',
        req.get('user-agent') || 'unknown',
        {
          action: 'revoke_all_sessions',
          success: true,
          sessionCount: sessions.length,
        },
      );
    } catch (error) {
      this.logger.error(
        `Failed to revoke all sessions for user ${user.id}: ${getErrorMessage(error)}`,
        getErrorStack(error),
      );
      throw error;
    }
  }
}
