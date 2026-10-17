import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
  Logger,
  Inject,
  forwardRef,
  ServiceUnavailableException,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import * as speakeasy from 'speakeasy';
import * as qrcode from 'qrcode';
import * as crypto from 'crypto';
import { createTransport } from 'nodemailer';
import { PrismaService } from '#infrastructure/prisma/prisma.service';
import {
  UserSecuritySettings,
  UserSession,
  SecurityEvent,
  User,
} from '@prisma/client';
import {
  SecuritySettingsDto,
  ChangePasswordDto,
  securityEventTypes,
} from '#common/dto/security.dto';
import { TokenBlacklistService } from './token-blacklist.service';
import type { SecurityEventData } from '#common/dto/security.dto';
import { AdminSettingsService } from '#modules/admin/services/admin-settings.service';

@Injectable()
export class SecurityService {
  private readonly logger = new Logger(SecurityService.name);

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    @Inject(forwardRef(() => TokenBlacklistService))
    private tokenBlacklistService: TokenBlacklistService,
    @Optional()
    private readonly adminSettingsService?: AdminSettingsService,
  ) {}

  private generateBackupCodes(count = 10): string[] {
    const codes: string[] = [];
    for (let i = 0; i < count; i++) {
      codes.push(Math.random().toString(36).substr(2, 10).toUpperCase());
    }
    return codes;
  }

  async setupTwoFactor(
    userId: string,
  ): Promise<{ secret: string; qrCode: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const secret = speakeasy.generateSecret({
      name: `MedicalApp:${user.email}`,
      issuer: 'MedicalApp',
    });

    let settings = await this.prisma.userSecuritySettings.findUnique({
      where: { userId },
    });
    const settingsData = {
      userId,
      twoFactorSecret: secret.base32,
      backupCodes: this.generateBackupCodes(),
    };

    if (!settings) {
      settings = await this.prisma.userSecuritySettings.create({
        data: settingsData,
      });
    } else {
      settings = await this.prisma.userSecuritySettings.update({
        where: { userId },
        data: settingsData,
      });
    }

    const otpauthUrl = speakeasy.otpauthURL({
      secret: secret.ascii,
      label: `MedTrackHubApp:${user.email}`,
      issuer: 'MedTrackHubApp',
      encoding: 'base32',
    });
    const qrCodeData = await qrcode.toDataURL(otpauthUrl);

    return { secret: secret.base32, qrCode: qrCodeData };
  }

  async verifyTwoFactor(userId: string, token: string): Promise<boolean> {
    const settings = await this.prisma.userSecuritySettings.findUnique({
      where: { userId },
    });
    if (!settings?.twoFactorSecret) {
      throw new BadRequestException('2FA not set up');
    }

    const isValid = speakeasy.totp.verify({
      secret: settings.twoFactorSecret,
      encoding: 'base32',
      token,
    });
    if (!isValid) return false;

    if (!settings.twoFactorEnabled) {
      await this.prisma.userSecuritySettings.update({
        where: { userId },
        data: { twoFactorEnabled: true },
      });
      await this.logSecurityEvent(userId, securityEventTypes.twoFactorEnabled, {
        details: { message: 'Two-factor authentication was enabled' },
        severity: 'high',
        timestamp: new Date(),
      });
    }

    return true;
  }

  async disableTwoFactor(userId: string, token: string): Promise<void> {
    const settings = await this.prisma.userSecuritySettings.findUnique({
      where: { userId },
    });
    if (!settings?.twoFactorEnabled || !settings.twoFactorSecret) {
      throw new BadRequestException('Two-factor authentication is not enabled');
    }

    const isValid = speakeasy.totp.verify({
      secret: settings.twoFactorSecret,
      encoding: 'base32',
      token,
    });
    if (!isValid) {
      throw new UnauthorizedException('The authenticator code is incorrect');
    }

    await this.prisma.userSecuritySettings.update({
      where: { userId },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
        backupCodes: [],
      },
    });
    await this.logSecurityEvent(userId, securityEventTypes.twoFactorDisabled, {
      details: { message: 'Two-factor authentication was disabled' },
      severity: 'high',
      timestamp: new Date(),
    });
  }

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const isValid = await argon2.verify(
      user.password || '',
      dto.currentPassword,
    );
    if (!isValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    if (dto.newPassword !== dto.confirmPassword) {
      throw new BadRequestException('New passwords do not match');
    }

    await this.adminSettingsService?.validatePassword(dto.newPassword);
    const passwordHash = await argon2.hash(dto.newPassword);
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: passwordHash },
    });

    await this.logSecurityEvent(userId, securityEventTypes.passwordChange, {
      details: { message: 'User password was changed' },
      severity: 'high',
      timestamp: new Date(),
    });
  }

  async updateSecuritySettings(
    userId: string,
    settingsDto: SecuritySettingsDto,
  ): Promise<void> {
    let settings = await this.prisma.userSecuritySettings.findUnique({
      where: { userId },
    });

    if (!settings) {
      settings = await this.prisma.userSecuritySettings.create({
        data: { userId, ...settingsDto },
      });
    } else {
      settings = await this.prisma.userSecuritySettings.update({
        where: { userId },
        data: settingsDto,
      });
    }

    await this.logSecurityEvent(
      userId,
      securityEventTypes.securitySettingsUpdate,
      {
        details: { settings: settingsDto },
        severity: 'low',
        timestamp: new Date(),
      },
    );
  }

  async getActiveSessions(userId: string): Promise<UserSession[]> {
    return this.prisma.userSession.findMany({
      where: { userId, revokedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  async revokeSession(userId: string, sessionId: string): Promise<void> {
    const session = await this.prisma.userSession.findFirst({
      where: { id: sessionId, userId },
    });

    if (!session) {
      throw new BadRequestException('Session not found');
    }

    await this.prisma.userSession.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    });

    if (session.token) {
      await this.tokenBlacklistService.addToBlacklist(
        session.token,
        7 * 24 * 60 * 60,
      );
    }

    await this.logSecurityEvent(userId, securityEventTypes.sessionRevoked, {
      details: { sessionId, deviceId: session.deviceId },
      ipAddress: session.ipAddress || '',
      userAgent: session.userAgent || '',
      severity: 'low',
      timestamp: new Date(),
    });
  }

  async isEmailVerified(userId: string): Promise<boolean> {
    const settings = await this.prisma.userSecuritySettings.findUnique({
      where: { userId },
      select: { isEmailVerified: true },
    });
    return settings?.isEmailVerified || false;
  }

  async sendVerificationEmail(user: User): Promise<void> {
    // In dev mode, just auto-verify without creating tokens
    if (process.env.NODE_ENV !== 'production') {
      this.logger.warn(`DEV MODE: Auto-verifying email for ${user.email}`);
      await this.prisma.userSecuritySettings.upsert({
        where: { userId: user.id },
        update: { isEmailVerified: true },
        create: { userId: user.id, isEmailVerified: true, acceptTerms: false },
      });
      return;
    }

    const host = this.configService.get<string>('EMAIL_HOST');
    const userName = this.configService.get<string>('EMAIL_USER');
    const password = this.configService.get<string>('EMAIL_PASSWORD');
    const frontendUrl = this.configService.get<string>('FRONTEND_URL');
    if (!host || !userName || !password || !frontendUrl) {
      throw new ServiceUnavailableException(
        'Email verification delivery is not configured.',
      );
    }

    const verificationToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await this.prisma.emailVerificationToken.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        token: verificationToken,
        expiresAt,
      },
      update: {
        token: verificationToken,
        expiresAt,
        createdAt: new Date(),
      },
    });

    const verificationUrl = new URL('/verify-email', frontendUrl);
    verificationUrl.searchParams.set('token', verificationToken);
    const transporter = createTransport({
      host,
      port: this.configService.get<number>('EMAIL_PORT', 587),
      secure: this.configService.get<boolean>('EMAIL_SECURE', false),
      auth: {
        user: userName,
        pass: host.toLowerCase() === 'smtp.gmail.com'
          ? password.replace(/\s+/g, '')
          : password,
      },
      connectionTimeout: 10_000,
      socketTimeout: 10_000,
    });

    try {
      await transporter.sendMail({
        from: this.configService.get<string>('EMAIL_FROM') || userName,
        to: user.email,
        subject: 'Verify your MedTrack Hub email',
        text: `Verify your email address to complete your MedTrack Hub account setup: ${verificationUrl.toString()}\n\nThis link expires in 24 hours. If you did not create this account, you can ignore this email.`,
        html: `<p>Verify your email address to complete your MedTrack Hub account setup.</p><p><a href="${verificationUrl.toString()}">Verify email address</a></p><p>This link expires in 24 hours. If you did not create this account, you can ignore this email.</p>`,
      });
    } catch (error) {
      await this.prisma.emailVerificationToken.deleteMany({
        where: { userId: user.id, token: verificationToken },
      });
      this.logger.error(
        'Email verification delivery failed.',
        error instanceof Error ? error.stack : undefined,
      );
      throw new ServiceUnavailableException(
        'Email verification delivery is temporarily unavailable.',
      );
    } finally {
      transporter.close();
    }
  }

  async verifyEmail(token: string): Promise<void> {
    const emailToken = await this.prisma.emailVerificationToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!emailToken || emailToken.expiresAt <= new Date()) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    await this.prisma.userSecuritySettings.upsert({
      where: { userId: emailToken.userId },
      update: { isEmailVerified: true },
      create: {
        userId: emailToken.userId,
        isEmailVerified: true,
        acceptTerms: false,
      },
    });

    await this.prisma.emailVerificationToken.delete({
      where: { id: emailToken.id },
    });

    await this.logSecurityEvent(
      emailToken.userId,
      securityEventTypes.emailVerified,
      {
        details: { email: emailToken.user.email, action: 'email_verified' },
        severity: 'medium',
        timestamp: new Date(),
      },
    );
  }

  async requestVerificationEmail(email: string): Promise<void> {
    const mailIsConfigured = Boolean(
      this.configService.get<string>('EMAIL_HOST') &&
        this.configService.get<string>('EMAIL_USER') &&
        this.configService.get<string>('EMAIL_PASSWORD') &&
        this.configService.get<string>('FRONTEND_URL'),
    );
    if (!mailIsConfigured) {
      throw new ServiceUnavailableException(
        'Email verification delivery is not configured.',
      );
    }

    const user = await this.prisma.user.findFirst({
      where: { email: { equals: email.trim(), mode: 'insensitive' } },
    });
    if (!user) return;
    const settings = await this.prisma.userSecuritySettings.findUnique({
      where: { userId: user.id },
    });
    if (settings?.isEmailVerified) return;

    await this.sendVerificationEmail(user);
  }

  async resendVerificationEmail(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const settings = await this.prisma.userSecuritySettings.findUnique({
      where: { userId },
    });
    if (settings?.isEmailVerified) {
      throw new BadRequestException('Email already verified');
    }

    await this.sendVerificationEmail(user);
  }

  async logSecurityEvent(
    userId: string,
    eventType: SecurityEventData['eventType'],
    data: Partial<SecurityEventData>,
  ): Promise<SecurityEvent> {
    return this.prisma.securityEvent.create({
      data: {
        userId,
        eventType,
        description: data.details?.message || `Event: ${eventType}`,
        details: data.details as any, // Align with schema Json?
        ipAddress: data.ipAddress || '',
        userAgent: data.userAgent || '',
        severity: data.severity || 'low',
        timestamp: data.timestamp || new Date(),
      },
    });
  }

  async getSecurityEvents(
    userId: string,
    limit = 50,
  ): Promise<SecurityEvent[]> {
    return this.prisma.securityEvent.findMany({
      where: { userId },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });
  }

  private generateVerificationToken(): Promise<string> {
    return Promise.resolve(crypto.randomBytes(32).toString('hex'));
  }

  async getSecuritySettings(userId: string): Promise<UserSecuritySettings> {
    const settings = await this.prisma.userSecuritySettings.findUnique({
      where: { userId },
    });
    if (!settings) {
      throw new NotFoundException('Security settings not found');
    }
    return settings;
  }

  async generateNewBackupCodes(userId: string): Promise<string[]> {
    const settings = await this.prisma.userSecuritySettings.findUnique({
      where: { userId },
    });
    if (!settings) {
      throw new NotFoundException('Security settings not found');
    }

    const newCodes = this.generateBackupCodes();
    await this.prisma.userSecuritySettings.update({
      where: { userId },
      data: { backupCodes: newCodes },
    });
    return newCodes;
  }

  async initiateAccountRecovery(email: string): Promise<void> {
    const host = this.configService.get<string>('EMAIL_HOST');
    const userName = this.configService.get<string>('EMAIL_USER');
    const password = this.configService.get<string>('EMAIL_PASSWORD');
    const frontendUrl = this.configService.get<string>('FRONTEND_URL');
    if (!host || !userName || !password || !frontendUrl) {
      throw new ServiceUnavailableException(
        'Password recovery email delivery is not configured.',
      );
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.prisma.user.findFirst({
      where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
      select: { id: true, email: true },
    });
    if (!user) return;

    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    try {
      await this.prisma.passwordResetToken.upsert({
        where: { userId: user.id },
        create: { userId: user.id, tokenHash, expiresAt },
        update: { tokenHash, expiresAt, createdAt: new Date() },
      });
    } catch (error) {
      this.logger.error(
        'Could not persist a password recovery token.',
        error instanceof Error ? error.stack : undefined,
      );
      throw new ServiceUnavailableException(
        'Password recovery is temporarily unavailable.',
      );
    }

    const resetUrl = new URL('/reset-password', frontendUrl);
    resetUrl.hash = new URLSearchParams({ token }).toString();
    const transporter = createTransport({
      host,
      port: this.configService.get<number>('EMAIL_PORT', 587),
      secure: this.configService.get<boolean>('EMAIL_SECURE', false),
      auth: {
        user: userName,
        pass: host.toLowerCase() === 'smtp.gmail.com'
          ? password.replace(/\s+/g, '')
          : password,
      },
      connectionTimeout: 10_000,
      socketTimeout: 10_000,
    });

    try {
      await transporter.sendMail({
        from: this.configService.get<string>('EMAIL_FROM') || userName,
        to: user.email,
        subject: 'Reset your MedTrack Hub password',
        text: `Use this link to reset your password. It expires in 30 minutes: ${resetUrl.toString()}`,
        html: `<p>We received a request to reset your MedTrack Hub password.</p><p><a href="${resetUrl.toString()}">Reset your password</a></p><p>This link expires in 30 minutes. If you did not request this, you can ignore this email.</p>`,
      });
    } catch (error) {
      // Keep the response indistinguishable from an unknown address to avoid account enumeration.
      this.logger.error(
        'Password recovery email delivery failed.',
        error instanceof Error ? error.stack : undefined,
      );
    } finally {
      transporter.close();
    }
  }

  async verifyRecoveryRequest(token: string, newPassword: string): Promise<void> {
    await this.adminSettingsService?.validatePassword(newPassword);
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const now = new Date();
    const resetToken = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      select: { id: true, userId: true, expiresAt: true },
    });

    if (!resetToken || resetToken.expiresAt <= now) {
      throw new BadRequestException('Invalid or expired password reset link.');
    }

    const passwordHash = await argon2.hash(newPassword);
    const activeSessions = await this.prisma.userSession.findMany({
      where: {
        userId: resetToken.userId,
        revokedAt: null,
        expiresAt: { gt: now },
      },
      select: { token: true },
    });

    await this.prisma.$transaction(async transaction => {
      const consumed = await transaction.passwordResetToken.deleteMany({
        where: { id: resetToken.id, tokenHash, expiresAt: { gt: now } },
      });
      if (consumed.count !== 1) {
        throw new BadRequestException('Invalid or expired password reset link.');
      }

      await transaction.user.update({
        where: { id: resetToken.userId },
        data: { password: passwordHash, updatedAt: now },
      });
      await transaction.userSecuritySettings.updateMany({
        where: { userId: resetToken.userId },
        data: { passwordLastChanged: now },
      });
      await transaction.userSession.updateMany({
        where: { userId: resetToken.userId, revokedAt: null },
        data: { isActive: false, revokedAt: now },
      });

      await transaction.securityEvent.create({
        data: {
          userId: resetToken.userId,
          eventType: securityEventTypes.passwordChange,
          description: 'Password was reset using account recovery',
          details: { message: 'Password was reset using account recovery' },
          severity: 'high',
          timestamp: now,
        },
      });
    });

    await Promise.all(
      activeSessions.map(({ token: sessionToken }) =>
        this.tokenBlacklistService.blacklistToken(sessionToken),
      ),
    );
  }
}
