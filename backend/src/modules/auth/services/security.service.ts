import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import * as speakeasy from 'speakeasy';
import * as qrcode from 'qrcode';
import * as crypto from 'crypto';
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

@Injectable()
export class SecurityService {
  private readonly logger = new Logger(SecurityService.name);

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    @Inject(forwardRef(() => TokenBlacklistService))
    private tokenBlacklistService: TokenBlacklistService,
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

    return speakeasy.totp.verify({
      secret: settings.twoFactorSecret,
      encoding: 'base32',
      token,
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

    // Production: Create token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await this.prisma.emailVerificationToken.create({
      data: {
        userId: user.id,
        token: verificationToken,
        expiresAt,
      },
    });

    const verificationLink = `${this.configService.get(
      'FRONTEND_URL',
    )}/verify-email?token=${verificationToken}`;

    // TODO: Implement actual email sending (e.g., via Nodemailer)
    this.logger.log(
      `Verification email sent to ${user.email}. Link: ${verificationLink}`,
    );
  }

  async verifyEmail(token: string): Promise<void> {
    const emailToken = await this.prisma.emailVerificationToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!emailToken || emailToken.expiresAt < new Date()) {
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

  async resendVerificationEmail(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const settings = await this.prisma.userSecuritySettings.findUnique({
      where: { userId: user.id },
    });
    if (settings?.isEmailVerified) {
      throw new BadRequestException('Email already verified');
    }

    // Delete existing tokens
    await this.prisma.emailVerificationToken.deleteMany({
      where: { userId: user.id },
    });

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

  initiateAccountRecovery(email: string): Promise<void> {
    this.logger.log(`Initiating account recovery for ${email}`);
    return Promise.resolve();
  }

  verifyRecoveryRequest(
    token: string,
    answers: { [key: string]: string },
  ): Promise<boolean> {
    this.logger.log(
      `Verifying recovery request with token ${token} and answers ${JSON.stringify(answers)}`,
    );
    return Promise.resolve(true);
  }
}
