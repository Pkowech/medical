// src/modules/auth/security.controller.ts
import {
  Controller,
  Post,
  Get,
  Put,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { SecurityService } from '../../auth/services/security.service';
import { JwtAuthGuard } from '#modules/auth/guards/jwt-auth.guard';
import {
  SecuritySettingsDto,
  ChangePasswordDto,
  VerifyTwoFactorDto,
  EmailVerificationDto,
  AccountRecoveryDto,
  VerifyRecoveryDto,
} from '#common/dto/security.dto';
import type { AuthenticatedRequest } from '#common/dto/user.dto';

@ApiTags('Security')
@Controller('auth/security')
export class SecurityController {
  constructor(private readonly securityService: SecurityService) {}

  @Post('2fa/setup')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Setup two-factor authentication' })
  @ApiResponse({
    status: 200,
    description: 'Returns QR code and secret for 2FA setup',
  })
  async setupTwoFactor(@Request() req: AuthenticatedRequest) {
    return this.securityService.setupTwoFactor(req.user.id);
  }

  @Post('2fa/verify')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Verify two-factor authentication token' })
  @ApiResponse({ status: 200, description: '2FA token verified successfully' })
  async verifyTwoFactor(
    @Request() req: AuthenticatedRequest,
    @Body() dto: VerifyTwoFactorDto,
  ) {
    const isValid = await this.securityService.verifyTwoFactor(
      req.user.id,
      dto.token,
    );
    return { valid: isValid };
  }

  @Put('password')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Change user password' })
  @ApiResponse({ status: 204, description: 'Password changed successfully' })
  async changePassword(
    @Request() req: AuthenticatedRequest,
    @Body() dto: ChangePasswordDto,
  ) {
    await this.securityService.changePassword(req.user.id, dto);
  }

  @Put('settings')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update security settings' })
  @ApiResponse({
    status: 200,
    description: 'Security settings updated successfully',
  })
  async updateSecuritySettings(
    @Request() req: AuthenticatedRequest,
    @Body() dto: SecuritySettingsDto,
  ) {
    await this.securityService.updateSecuritySettings(req.user.id, dto);
    return { message: 'Security settings updated successfully' };
  }

  @Get('settings')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user security settings' })
  @ApiResponse({ status: 200, description: 'Returns user security settings' })
  async getSecuritySettings(@Request() req: AuthenticatedRequest) {
    return this.securityService.getSecuritySettings(req.user.id);
  }

  @Get('events')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get security events for user' })
  @ApiResponse({ status: 200, description: 'Returns list of security events' })
  async getSecurityEvents(
    @Request() req: AuthenticatedRequest,
    @Query('limit') limit?: number,
  ) {
    return this.securityService.getSecurityEvents(req.user.id, limit);
  }

  @Post('backup-codes/generate')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Generate new backup codes' })
  @ApiResponse({ status: 200, description: 'Returns new backup codes' })
  async generateBackupCodes(@Request() req: AuthenticatedRequest) {
    const codes = await this.securityService.generateNewBackupCodes(
      req.user.id,
    );
    return { backupCodes: codes };
  }

  @Post('email/verify')
  @ApiOperation({ summary: 'Verify email address' })
  @ApiResponse({ status: 200, description: 'Email verified successfully' })
  async verifyEmail(@Body() dto: EmailVerificationDto) {
    const verified = await this.securityService.verifyEmail(dto.token);
    return { verified };
  }

  @Post('email/resend')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Resend email verification' })
  @ApiResponse({ status: 200, description: 'Verification email sent' })
  async resendVerificationEmail(@Request() req: AuthenticatedRequest) {
    await this.securityService.resendVerificationEmail(req.user.id);
    return { message: 'Verification email sent' };
  }

  @Post('recovery/initiate')
  @ApiOperation({ summary: 'Initiate account recovery' })
  @ApiResponse({ status: 200, description: 'Account recovery initiated' })
  async initiateAccountRecovery(@Body() dto: AccountRecoveryDto) {
    await this.securityService.initiateAccountRecovery(dto.email);
    return { message: 'Recovery process initiated' };
  }

  @Post('recovery/verify')
  @ApiOperation({ summary: 'Verify account recovery request' })
  @ApiResponse({ status: 200, description: 'Recovery request verified' })
  async verifyRecoveryRequest(@Body() dto: VerifyRecoveryDto) {
    const verified = await this.securityService.verifyRecoveryRequest(
      dto.token,
      dto.answers,
    );
    return { verified };
  }
}
