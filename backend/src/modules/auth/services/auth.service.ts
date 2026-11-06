import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  Optional,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '#infrastructure/prisma/prisma.service';
import * as argon2 from 'argon2';
import { randomBytes } from 'node:crypto';
import { google } from 'googleapis';
import {
  CreateUserDto,
  GoogleAuthDto,
  LoginDto,
  RegisterDto,
  RegistrationResponseDto,
} from '#common/dto/user.dto';
import { TokenBlacklistService } from './token-blacklist.service';
import { SecurityService } from './security.service';
import { RefreshTokenService } from './refresh-token.service';
import { AuditLogService, type AuditOutboxPayload } from './audit-log.service';
import { Role, roleHierarchy } from '../constants/role.constants';
import { RedisService } from '#infrastructure/redis/redis.service';
import { getErrorMessage, getErrorStack } from '#common/utils/error.utils';
import { PermissionCalculationService } from './permission-calculation.service';
import { UsersService } from './users.service';
import type { AuthenticatedUser, AuthResponse } from '#common/dto/user.dto';
import { ApiResponseDto } from '#common/dto/base';
import { ErrorMessages } from '#common/constants/error-messages';
import { RolesService } from '#modules/auth/services/roles.service';
import { ConfigService } from '@nestjs/config';
import { RoleLimitingService } from './role-limiting.service'; // Inject for guest rate limit
import type { JwtPayload } from '#common/dto/security.dto';
import { securityEventTypes } from '#common/dto/security.dto';
import { Prisma } from '@prisma/client';
import { AdminSettingsService } from '#modules/admin/services/admin-settings.service';
import { MetricsService } from '#infrastructure/metrics/metrics.service';
import { PasswordVerificationGate } from './password-verification-gate';
import { performance } from 'node:perf_hooks';

interface GoogleIdentityPayload {
  sub?: string;
  email?: string;
  email_verified?: boolean;
  given_name?: string;
  family_name?: string;
  picture?: string;
}

const AUTH_RESPONSE_USER_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  username: true,
  careerStage: true,
  healthcareField: true,
  studyYear: true,
  yearOfExperience: true,
  specialization: true,
  userRoles: { select: { role: { select: { name: true } } } },
  securitySettings: {
    select: {
      twoFactorEnabled: true,
      twoFactorSecret: true,
      isEmailVerified: true,
    },
  },
} satisfies Prisma.UserSelect;

const AUTH_LOGIN_USER_SELECT = {
  ...AUTH_RESPONSE_USER_SELECT,
  password: true,
  isActive: true,
  isLocked: true,
  lockedUntil: true,
  failedLoginAttempts: true,
} satisfies Prisma.UserSelect;

type AuthResponseUser = Prisma.UserGetPayload<{
  select: typeof AUTH_RESPONSE_USER_SELECT;
}>;

type AuthResponseOptions = {
  forceMfaSetup?: boolean;
  user?: AuthResponseUser;
  systemSettings?: Awaited<
    ReturnType<AdminSettingsService['getSettings']>
  >;
  isEmailVerified?: boolean;
};

/**
 * Authentication Service
 * Handles user authentication, registration, session management, and guest access
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  // Configuration constants - should be moved to ConfigService
  private readonly MAX_FAILED_ATTEMPTS: number;
  private readonly LOCK_DURATION: number;
  private readonly GUEST_SESSION_DURATION: number;
  private readonly JWT_SECRET: string;
  private readonly JWT_EXPIRES_IN: string;
  private readonly JWT_REFRESH_SECRET: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly securityService: SecurityService,
    private readonly refreshTokenService: RefreshTokenService,
    private readonly tokenBlacklistService: TokenBlacklistService,
    private readonly auditLogService: AuditLogService,
    private readonly redisService: RedisService,
    private readonly permissionCalculationService: PermissionCalculationService,
    private readonly usersService: UsersService,
    private readonly rolesService: RolesService,
    private readonly roleLimitingService: RoleLimitingService, // Added for guest rate limit
    private readonly configService: ConfigService,
    private readonly passwordVerificationGate: PasswordVerificationGate,
    private readonly metrics: MetricsService,
    @Optional()
    private readonly adminSettingsService?: AdminSettingsService,
  ) {
    // Initialize configuration from environment
    this.MAX_FAILED_ATTEMPTS = this.configService.get<number>(
      'MAX_FAILED_ATTEMPTS',
      5,
    );
    this.LOCK_DURATION = this.configService.get<number>(
      'LOCK_DURATION',
      3600000,
    ); // 1 hour
    this.GUEST_SESSION_DURATION = this.configService.get<number>(
      'GUEST_SESSION_DURATION',
      3600,
    ); // 1 hour
    this.JWT_SECRET =
      this.configService.get<string>('JWT_SECRET') ||
      this.configService.get<string>('NEXTAUTH_SECRET') ||
      'fallback_secret_for_dev'; // Fallback for development, should be strong in prod
    this.JWT_EXPIRES_IN = this.configService.get<string>(
      'JWT_EXPIRES_IN',
      '24h',
    );
    this.JWT_REFRESH_SECRET =
      this.configService.get<string>('JWT_REFRESH_SECRET') ||
      'fallback_refresh_secret_for_dev'; // Fallback for development, should be strong in prod

    // Validate JWT configuration
    if (!this.JWT_SECRET) {
      throw new Error(
        'JWT_SECRET environment variable is not set. Authentication will fail.',
      );
    }
  }

  private async measureAuthStage<T>(
    stage: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    const startedAt = performance.now();
    try {
      const result = await operation();
      this.metrics.recordAuthStage(
        stage,
        performance.now() - startedAt,
        'success',
      );
      return result;
    } catch (error) {
      this.metrics.recordAuthStage(
        stage,
        performance.now() - startedAt,
        'failure',
      );
      throw error;
    }
  }

  private async enqueueAuthenticationAudit(
    payload: AuditOutboxPayload,
  ): Promise<void> {
    await this.prisma.$transaction((transaction) =>
      this.auditLogService.enqueueInTransaction(transaction, payload),
    );
  }

  /**
   * Converts a duration string (e.g., '24h', '7d') to milliseconds
   */
  private parseDurationToMilliseconds(duration: string): number {
    const match = duration.match(/^(\d+)([smhd])$/);
    if (!match) {
      this.logger.warn(
        `Invalid duration format: ${duration}, defaulting to parse as number`,
      );
      return parseInt(duration, 10) || 86400000; // 24h default
    }

    const [, value, unit] = match;
    const numValue = parseInt(value, 10);

    const multipliers: Record<string, number> = {
      s: 1000,
      m: 60000,
      h: 3600000,
      d: 86400000,
    };

    return numValue * (multipliers[unit] || 1);
  }

  private async getTwoFactorEnabled(
    userId: string,
    user?: { securitySettings?: { twoFactorEnabled?: boolean } | null },
  ): Promise<boolean> {
    if (user && 'securitySettings' in user) {
      return Boolean(user.securitySettings?.twoFactorEnabled);
    }

    const settings = await this.prisma.userSecuritySettings.findUnique({
      where: { userId },
      select: { twoFactorEnabled: true },
    });

    return Boolean(settings?.twoFactorEnabled);
  }

  /**
   * Creates the application session and records a successful authentication.
   */
  private async issueAuthResponse(
    userId: string,
    ipAddress?: string,
    userAgent?: string,
    deviceId?: string,
    options: AuthResponseOptions = {},
  ): Promise<AuthResponse> {
    const user =
      options.user ??
      (await this.prisma.user.findUnique({
        where: { id: userId },
        select: AUTH_RESPONSE_USER_SELECT,
      }));

    if (!user) {
      throw new NotFoundException('Authenticated user no longer exists');
    }

    const primaryRole = user.userRoles.reduce(
      (highestRole: Role, userRole: any) => {
        const currentRoleHierarchy =
          roleHierarchy[userRole.role.name as Role];
        const highestRoleHierarchy = roleHierarchy[highestRole];
        return currentRoleHierarchy > highestRoleHierarchy
          ? (userRole.role.name as Role)
          : highestRole;
      },
      Role.student,
    );
    const allRoles = user.userRoles.map(
      (userRole: any) => userRole.role.name as Role,
    );
    const permissions =
      await this.permissionCalculationService.getEffectivePermissionsForRole(
        primaryRole,
      );
    const twoFactorEnabled = await this.getTwoFactorEnabled(
      user.id,
      user,
    );
    const systemSettings =
      'systemSettings' in options
        ? options.systemSettings
        : await this.adminSettingsService?.getSettings();
    const mfaSetupRequired =
      options.forceMfaSetup ||
      Boolean(
        systemSettings?.twoFactorAuthRequired && !twoFactorEnabled,
      );
    const sessionTimeoutMinutes = systemSettings?.sessionTimeout ?? 120;
    const accessTokenLifetimeMs = mfaSetupRequired
      ? 10 * 60 * 1000
      : Math.min(
          this.parseDurationToMilliseconds(this.JWT_EXPIRES_IN),
          sessionTimeoutMinutes * 60 * 1000,
        );
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: primaryRole,
      roles: allRoles,
      permissions,
      ...(mfaSetupRequired && { mfaSetupRequired: true }),
    };
    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.JWT_SECRET,
      expiresIn: Math.floor(accessTokenLifetimeMs / 1000),
    });
    const refreshToken = mfaSetupRequired
      ? ''
      : await this.measureAuthStage('refresh_token_write', () =>
          this.refreshTokenService.createRefreshToken(
            user.id,
            Math.ceil(accessTokenLifetimeMs / 1000),
            true,
          ),
        );

    await this.measureAuthStage('login_commit', () =>
      this.prisma.$transaction(async (transaction) => {
        await transaction.user.update({
          where: { id: user.id },
          data: {
            lastLogin: new Date(),
            failedLoginAttempts: 0,
            isLocked: false,
            lockedUntil: null,
          },
        });
        await this.auditLogService.enqueueInTransaction(transaction, {
          eventType: securityEventTypes.loginSuccess,
          userId: user.id,
          ipAddress: ipAddress || 'unknown',
          userAgent: userAgent || 'unknown',
          eventData: { deviceId, userRole: primaryRole },
        });
        if (refreshToken) {
          await this.auditLogService.enqueueInTransaction(transaction, {
            eventType: securityEventTypes.tokenRefresh,
            userId: user.id,
            ipAddress: 'unknown',
            userAgent: 'unknown',
            eventData: { success: true, action: 'create' },
          });
        }
      }),
    );

    return {
      accessToken,
      refreshToken,
      expiresAt: new Date(
        Date.now() + accessTokenLifetimeMs,
      ),
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username ?? '',
        isEmailVerified:
          options.isEmailVerified ??
          (await this.securityService.isEmailVerified(user.id)),
        careerStage: user.careerStage,
        healthcareField: user.healthcareField,
        studyYear: user.studyYear,
        yearOfExperience: user.yearOfExperience,
        specialization: user.specialization,
        ...(mfaSetupRequired && { mfaSetupRequired: true }),
      },
      roles: {
        role: primaryRole,
        roles: allRoles,
        permissions,
      },
    };
  }

  async completeRequiredTwoFactor(userId: string): Promise<AuthResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        securitySettings: { select: { twoFactorEnabled: true } },
      },
    });
    if (!(await this.getTwoFactorEnabled(userId, user ?? undefined))) {
      throw new UnauthorizedException('Required two-factor setup is incomplete.');
    }
    return this.issueAuthResponse(userId);
  }

  /**
   * Verifies a password against a stored hash
   * @returns true if password is valid, false otherwise
   */
  private async verifyPassword(
    storedHash: string | null,
    providedPassword: string,
  ): Promise<boolean> {
    if (!storedHash) {
      this.logger.warn('Attempted password verification with no stored hash');
      return false;
    }

    if (!storedHash.startsWith('$argon2')) {
      this.logger.error('Invalid password hash format detected');
      return false;
    }

    return this.passwordVerificationGate.run(() =>
      this.measureAuthStage('argon2_verify', async () => {
        try {
          return await argon2.verify(storedHash, providedPassword);
        } catch (error: unknown) {
          this.logger.error(
            `Password verification failed: ${getErrorMessage(error)}`,
            { stack: getErrorStack(error) },
          );
          return false;
        }
      }),
    );
  }

  /**
   * Validates a JWT payload and returns the authenticated user
   */
  async validateUser(payload: JwtPayload): Promise<AuthenticatedUser> {
    const { sub: userId } = payload;
    
    this.logger.debug(`Attempting to validate user with ID: ${userId}`);

    const user = await this.usersService.findOne(userId);

    if (!user) {
      this.logger.error(
        `User not found in database for JWT subject: ${userId}. User may have been deleted or ID mismatch.`,
      );
      throw new UnauthorizedException('User not found');
    }

    this.logger.debug(`User validated successfully: ${user.id} (${user.email})`);

    const primaryRole = user.userRoles.reduce(
      (highestRole: Role, userRole: any) => {
        const currentRoleHierarchy = roleHierarchy[userRole.role.name as Role];
        const highestRoleHierarchy = roleHierarchy[highestRole];
        return currentRoleHierarchy > highestRoleHierarchy
          ? (userRole.role.name as Role)
          : highestRole;
      },
      Role.student,
    );

    const allRoles = user.userRoles.map(
      (userRole: any) => userRole.role.name as Role,
    );

    const [systemSettings, twoFactorEnabled] = await Promise.all([
      this.adminSettingsService?.getSettings(),
      this.getTwoFactorEnabled(userId),
    ]);
    const mfaSetupRequired =
      payload.mfaSetupRequired ||
      Boolean(systemSettings?.twoFactorAuthRequired && !twoFactorEnabled);

    return {
      id: user.id,
      username: user.username ?? '',
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: primaryRole,
      roles: allRoles, // Add this line
      permissions:
        await this.permissionCalculationService.calculateUserPermissions(
          user.id,
        ),
      isEmailVerified: user.securitySettings?.isEmailVerified || false,
      ...(mfaSetupRequired && { mfaSetupRequired: true }),
    };
  }

  /**
   * Authenticates a user and returns access tokens
   */
  async login(
    loginDto: LoginDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AuthResponse> {
    const { email, username, password, deviceId, twoFactorToken } = loginDto;
    const identifier = email || username || 'unknown';
    const logContext = { identifier, ipAddress, userAgent };
    const loginStartedAt = performance.now();
    let loginOutcome: 'success' | 'failure' | 'rejected' = 'failure';

    try {
      // Find user by email or username
      const whereClause: Prisma.UserWhereInput = email
        ? { email }
        : {
            username: {
              equals: username ?? '',
              mode: 'insensitive',
            },
          };
      const user = await this.measureAuthStage('user_lookup', () =>
        this.prisma.user.findFirst({
          where: whereClause,
          select: AUTH_LOGIN_USER_SELECT,
        }),
      );

      // User not found
      if (!user) {
        await this.enqueueAuthenticationAudit({
          eventType: securityEventTypes.loginFailure,
          userId: 'unknown',
          ipAddress: ipAddress || 'unknown',
          userAgent: userAgent || 'unknown',
          eventData: { reason: 'USER_NOT_FOUND', identifier },
        });
        throw new UnauthorizedException(
          email
            ? 'No account found for this email. Please sign up if you do not have an account.'
            : 'Username not found. Please sign up if you do not have an account.',
        );
      }

      // Check if account is locked
      if (user.isLocked && user.lockedUntil && user.lockedUntil > new Date()) {
        const remainingTime = Math.ceil(
          (user.lockedUntil.getTime() - Date.now()) / 60000,
        );
        await this.enqueueAuthenticationAudit({
          eventType: securityEventTypes.loginFailure,
          userId: user.id,
          ipAddress: ipAddress || 'unknown',
          userAgent: userAgent || 'unknown',
          eventData: {
            reason: 'ACCOUNT_LOCKED',
            remainingMinutes: remainingTime,
          },
        });
        throw new UnauthorizedException(
          `Account is locked. Please try again in ${remainingTime} minutes.`,
        );
      }

      // Check if account is active
      if (!user.isActive) {
        await this.enqueueAuthenticationAudit({
          eventType: securityEventTypes.loginFailure,
          userId: user.id,
          ipAddress: ipAddress || 'unknown',
          userAgent: userAgent || 'unknown',
          eventData: { reason: 'ACCOUNT_INACTIVE' },
        });
        throw new UnauthorizedException(ErrorMessages.user.inactive);
      }

      // Verify password
      const isPasswordValid = await this.verifyPassword(
        user.password,
        password,
      );

      if (!isPasswordValid) {
        const { failedAttempts, lockedUntil } =
          await this.measureAuthStage('failed_attempt_commit', () =>
            this.prisma.$transaction(async (transaction) => {
              const updatedUser = await transaction.user.update({
                where: { id: user.id },
                data: { failedLoginAttempts: { increment: 1 } },
                select: { failedLoginAttempts: true },
              });
              const shouldLock =
                updatedUser.failedLoginAttempts >= this.MAX_FAILED_ATTEMPTS;
              const nextLockedUntil = shouldLock
                ? new Date(Date.now() + this.LOCK_DURATION)
                : null;

              if (nextLockedUntil) {
                await transaction.user.update({
                  where: { id: user.id },
                  data: { isLocked: true, lockedUntil: nextLockedUntil },
                });
              }

              await this.auditLogService.enqueueInTransaction(transaction, {
                eventType: securityEventTypes.loginFailure,
                userId: user.id,
                ipAddress: ipAddress || 'unknown',
                userAgent: userAgent || 'unknown',
                eventData: {
                  reason: 'INVALID_PASSWORD',
                  attempts: updatedUser.failedLoginAttempts,
                  maxAttempts: this.MAX_FAILED_ATTEMPTS,
                },
              });

              if (nextLockedUntil) {
                await this.auditLogService.enqueueInTransaction(transaction, {
                  eventType: securityEventTypes.suspiciousActivity,
                  userId: user.id,
                  ipAddress: 'unknown',
                  userAgent: 'unknown',
                  eventData: {
                    reason: 'ACCOUNT_LOCKED_MAX_ATTEMPTS',
                    duration: this.LOCK_DURATION,
                    lockedUntil: nextLockedUntil.toISOString(),
                  },
                });
              }

              return {
                failedAttempts: updatedUser.failedLoginAttempts,
                lockedUntil: nextLockedUntil,
              };
            }),
        );

        if (lockedUntil) {
          this.logger.warn(
            `Account locked for user ${user.id} until ${lockedUntil.toISOString()}`,
          );
        }
        if (failedAttempts >= this.MAX_FAILED_ATTEMPTS) {
          throw new UnauthorizedException(
            'Too many failed attempts. Account has been locked.',
          );
        }

        throw new UnauthorizedException('Incorrect password. Please try again.');
      }

      const { isEmailVerified, systemSettings } =
        await this.measureAuthStage('account_checks', async () => ({
          isEmailVerified: Boolean(
            user.securitySettings?.isEmailVerified,
          ),
          systemSettings: await this.adminSettingsService?.getSettings(),
        }));
      if (
        this.configService.get<boolean>('ENABLE_EMAIL_VERIFICATION', true) &&
        !isEmailVerified
      ) {
        throw new UnauthorizedException(
          'Please verify your email address',
        );
      }

      const securitySettings = user.securitySettings;
      if (
        systemSettings?.twoFactorAuthRequired &&
        !securitySettings?.twoFactorEnabled
      ) {
        const response = await this.measureAuthStage('auth_response', () =>
          this.issueAuthResponse(
            user.id,
            ipAddress,
            userAgent,
            deviceId,
            {
              forceMfaSetup: true,
              user,
              systemSettings,
              isEmailVerified,
            },
          ),
        );
        loginOutcome = 'success';
        return response;
      }

      // Check 2FA if enabled
      if (
        securitySettings?.twoFactorEnabled &&
        securitySettings?.twoFactorSecret
      ) {
        if (!twoFactorToken) {
          await this.enqueueAuthenticationAudit({
            eventType: securityEventTypes.loginFailure,
            userId: user.id,
            ipAddress: ipAddress || 'unknown',
            userAgent: userAgent || 'unknown',
            eventData: { reason: '2FA_TOKEN_MISSING' },
          });
          throw new BadRequestException(
            'Two-factor authentication token required',
          );
        }

        const is2FAValid = await this.measureAuthStage(
          'mfa_verification',
          () =>
            this.securityService.verifyTwoFactor(
              user.id,
              twoFactorToken,
              user.securitySettings,
            ),
        );

        if (!is2FAValid) {
          await this.enqueueAuthenticationAudit({
            eventType: securityEventTypes.loginFailure,
            userId: user.id,
            ipAddress: ipAddress || 'unknown',
            userAgent: userAgent || 'unknown',
            eventData: { reason: 'INVALID_2FA_TOKEN' },
          });
          throw new UnauthorizedException(
            'Invalid two-factor authentication token',
          );
        }
      }

      const response = await this.measureAuthStage('auth_response', () =>
        this.issueAuthResponse(
          user.id,
          ipAddress,
          userAgent,
          deviceId,
          { user, systemSettings, isEmailVerified },
        ),
      );
      loginOutcome = 'success';
      return response;
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        loginOutcome = 'rejected';
      }
      this.logger.error(`Login error: ${getErrorMessage(error)}`, {
        ...logContext,
        stack: getErrorStack(error),
      });

      if (
        error instanceof UnauthorizedException ||
        error instanceof BadRequestException ||
        error instanceof ServiceUnavailableException
      ) {
        throw error;
      }

      throw new ServiceUnavailableException(
        'Authentication service is temporarily unavailable.',
      );
    } finally {
      this.metrics.recordAuthStage(
        'login_total',
        performance.now() - loginStartedAt,
        loginOutcome,
      );
    }
  }

  async loginWithGoogle(
    googleAuthDto: GoogleAuthDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AuthResponse> {
    const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
    if (!clientId) {
      throw new ServiceUnavailableException(
        'Google sign-in is not configured',
      );
    }

    let googleProfile: GoogleIdentityPayload | undefined;
    try {
      const ticket = await new google.auth.OAuth2(clientId).verifyIdToken({
        idToken: googleAuthDto.idToken,
        audience: clientId,
      });
      googleProfile = ticket.getPayload() ?? undefined;
    } catch {
      throw new UnauthorizedException('Google credential is invalid or expired');
    }

    if (
      !googleProfile?.sub ||
      !googleProfile.email ||
      googleProfile.email_verified !== true
    ) {
      throw new UnauthorizedException(
        'Google must provide a verified email address',
      );
    }

    const email = googleProfile.email.trim().toLowerCase();
    let user = await this.prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
    });
    let isNewUser = false;

    if (!user) {
      if (googleAuthDto.acceptTerms !== true) {
        throw new BadRequestException(
          {
            code: 'GOOGLE_TERMS_REQUIRED',
            message:
              'Accept the Terms of Service before creating an account with Google',
          },
        );
      }

      const createdUser = await this.usersService.create({
        email,
        password: randomBytes(32).toString('base64url'),
        firstName: googleProfile.given_name,
        lastName: googleProfile.family_name,
        profileImage: googleProfile.picture,
        role: Role.student,
        acceptTerms: true,
      });
      user = await this.prisma.user.findUnique({
        where: { id: createdUser.id },
      });
      if (!user) {
        throw new NotFoundException(
          'Google account was created but could not be loaded',
        );
      }
      isNewUser = true;
    }

    if (
      !user.isActive ||
      (user.isLocked && user.lockedUntil && user.lockedUntil > new Date())
    ) {
      throw new UnauthorizedException(
        'This account is unavailable. Contact support for help.',
      );
    }

    await this.prisma.userSecuritySettings.upsert({
      where: { userId: user.id },
      update: { isEmailVerified: true },
      create: {
        userId: user.id,
        isEmailVerified: true,
        acceptTerms: isNewUser,
      },
    });

    return this.issueAuthResponse(user.id, ipAddress, userAgent);
  }

  /**
   * Registers a new user and returns access tokens
   */
  async register(
    registerDto: RegisterDto,
  ): Promise<RegistrationResponseDto> {
    const {
      email,
      password,
      firstName,
      lastName,
      username,
      role: providedRole,
      acceptTerms,
      bio,
      location,
      specialization,
      yearOfExperience,
      phoneNumber,
      profilePicture,
    } = registerDto;

    await this.adminSettingsService?.validatePassword(password);

    this.logger.debug('Register request received with fields:', {
      firstName,
      lastName,
      email,
      username,
      bio: bio || 'undefined',
      location: location || 'undefined',
      specialization: specialization || 'undefined',
      yearOfExperience: yearOfExperience || 'undefined',
      phoneNumber: phoneNumber || 'undefined',
      profilePicture: profilePicture || 'undefined',
    });

    try {
      // Use UsersService for consistency and default role
      const createDto: CreateUserDto = {
        email,
        password,
        firstName,
        lastName,
        username,
        acceptTerms,
        role: providedRole || Role.student, // Default enforced
        // Optional profile fields - only include if provided
        ...(bio && { bio }),
        ...(location && { location }),
        ...(specialization && { specialization }),
        ...(yearOfExperience !== undefined && { yearOfExperience }),
        ...(phoneNumber && { phoneNumber }),
        ...(profilePicture && { profileImage: profilePicture }), // Map profilePicture to profileImage
      };
      const createdUserDto = await this.usersService.create(createDto);
      if (!createdUserDto?.id) {
        throw new Error('Created user missing id');
      }
      const user = await this.usersService.findOne(createdUserDto.id); // Fetch full with relations

      if (!user) {
        throw new NotFoundException('Failed to fetch created user');
      }

      const emailVerificationRequired = this.configService.get<boolean>(
        'ENABLE_EMAIL_VERIFICATION',
        true,
      );
      let verificationEmailSent = false;
      if (emailVerificationRequired) {
        try {
          await this.securityService.sendVerificationEmail(user as any);
          verificationEmailSent = true;
        } catch (emailError) {
          this.logger.error(
            `Failed to send verification email: ${getErrorMessage(emailError)}`,
            { userId: user.id, stack: getErrorStack(emailError) },
          );
        }
      }

      return {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName || '',
          lastName: user.lastName || '',
          username: user.username || '',
          isEmailVerified: await this.securityService.isEmailVerified(user.id),
        },
        emailVerificationRequired,
        verificationEmailSent,
      };
    } catch (error) {
      this.logger.error(`Registration error: ${getErrorMessage(error)}`, {
        email,
        username,
        stack: getErrorStack(error),
      });
      throw error;
    }
  }

  /**
   * Refreshes an access token using a refresh token
   */
  async refreshToken(refreshToken: string): Promise<AuthResponse> {
    const userId =
      await this.refreshTokenService.validateAndGetUserId(refreshToken);

    if (!userId) {
      await this.auditLogService.log(
        securityEventTypes.tokenRefresh,
        'unknown',
        'unknown',
        'unknown',
        { success: false, reason: 'INVALID_REFRESH_TOKEN' },
      );
      throw new UnauthorizedException('Invalid refresh token');
    }

    const systemSettings = await this.adminSettingsService?.getSettings();
    if (systemSettings?.twoFactorAuthRequired) {
      const twoFactorEnabled = await this.getTwoFactorEnabled(userId);
      if (!twoFactorEnabled) {
        throw new UnauthorizedException(
          'Complete required two-factor setup before refreshing this session.',
        );
      }
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { userRoles: { include: { role: true } } },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const userRole = user.userRoles?.[0]?.role.name || Role.student;
    const allRoles = user.userRoles.map((ur: any) => ur.role.name as Role);

    const permissions =
      await this.permissionCalculationService.getEffectivePermissionsForRole(
        userRole,
      );

    const sessionTimeoutMinutes = systemSettings?.sessionTimeout ?? 120;
    const accessTokenLifetimeMs = Math.min(
      this.parseDurationToMilliseconds(this.JWT_EXPIRES_IN),
      sessionTimeoutMinutes * 60 * 1000,
    );
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: userRole,
      roles: allRoles, // Add this line
      permissions,
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.JWT_SECRET,
      expiresIn: Math.floor(accessTokenLifetimeMs / 1000),
    });

    const newRefreshToken = await this.refreshTokenService.createRefreshToken(
      user.id,
      Math.ceil(accessTokenLifetimeMs / 1000),
    );
    await this.refreshTokenService.revokeRefreshToken(refreshToken);

    await this.auditLogService.log(
      securityEventTypes.tokenRefresh,
      user.id,
      'unknown',
      'unknown',
      { success: true },
    );

    const isEmailVerified = await this.securityService.isEmailVerified(user.id);
    const expiresAt = new Date(
      Date.now() + accessTokenLifetimeMs,
    );

    return {
      accessToken,
      refreshToken: newRefreshToken,
      expiresAt,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        username: user.username || '',
        isEmailVerified,
      },
      roles: {
        role: userRole,
        roles: allRoles,
        permissions,
      },
    };
  }

  /**
   * Logs out a user and invalidates their tokens
   */
  async logout(
    userId: string,
    accessToken?: string,
    refreshToken?: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<ApiResponseDto<null>> {
    try {
      // Revoke refresh token if provided
      if (refreshToken) {
        await this.refreshTokenService.revokeRefreshToken(refreshToken);
      }

      // Blacklist access token if provided
      if (accessToken) {
        await this.tokenBlacklistService.blacklistToken(accessToken);
      }

      // Revoke all active sessions
      await this.prisma.userSession.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      await this.auditLogService.log(
        securityEventTypes.logoutSuccess,
        userId,
        ipAddress || 'unknown',
        userAgent || 'unknown',
      );

      return ApiResponseDto.success(null, 'Successfully logged out');
    } catch (error) {
      this.logger.error(`Logout error: ${getErrorMessage(error)}`, {
        userId,
        stack: getErrorStack(error),
      });
      throw new UnauthorizedException('Logout failed');
    }
  }

  /**
   * Logs out a user from all devices
   */
  async logoutAllDevices(userId: string): Promise<void> {
    await this.refreshTokenService.revokeAllUserTokens(userId);

    await this.prisma.userSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await this.auditLogService.log(
      securityEventTypes.sessionRevoked,
      userId,
      'unknown',
      'unknown',
      { success: true, allDevices: true },
    );
  }

  /**
   * Validates a JWT token and returns the authenticated user
   */
  async validateToken(token: string): Promise<AuthenticatedUser | null> {
    try {
      const payload: JwtPayload = await this.jwtService.verifyAsync(token, {
        secret: this.JWT_SECRET,
      });
      return this.validateUser(payload);
    } catch (error) {
      this.logger.error(`Token validation error: ${getErrorMessage(error)}`, {
        stack: getErrorStack(error),
      });
      return null;
    }
  }
}
