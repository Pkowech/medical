import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '#infrastructure/prisma/prisma.service';
import * as argon2 from 'argon2';
import { CreateUserDto, LoginDto, RegisterDto } from '#common/dto/user.dto';
import { TokenBlacklistService } from './token-blacklist.service';
import { SecurityService } from './security.service';
import { RefreshTokenService } from './refresh-token.service';
import { AuditLogService } from './audit-log.service';
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

  /**
   * Locks a user account after too many failed login attempts
   */
  private async lockAccount(userId: string): Promise<void> {
    const lockedUntil = new Date(Date.now() + this.LOCK_DURATION);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        isLocked: true,
        lockedUntil,
      },
    });

    await this.auditLogService.log(
      securityEventTypes.suspiciousActivity,
      userId,
      'unknown',
      'unknown',
      {
        reason: 'ACCOUNT_LOCKED_MAX_ATTEMPTS',
        duration: this.LOCK_DURATION,
        lockedUntil: lockedUntil.toISOString(),
      },
    );

    this.logger.warn(
      `Account locked for user ${userId} until ${lockedUntil.toISOString()}`,
    );
  }

  /**
   * Clears failed login attempts and unlocks account
   */
  private async clearFailedLoginAttempts(email: string): Promise<void> {
    await this.prisma.user.update({
      where: { email },
      data: {
        failedLoginAttempts: 0,
        isLocked: false,
        lockedUntil: null,
      },
    });
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

    try {
      return await argon2.verify(storedHash, providedPassword);
    } catch (error: unknown) {
      this.logger.error(
        `Password verification failed: ${getErrorMessage(error)}`,
        { stack: getErrorStack(error) },
      );
      return false;
    }
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

    try {
      // Find user by email or username
      const whereClause = email ? { email } : { username };
      const user = await this.prisma.user.findFirst({
        where: whereClause,
        include: {
          userRoles: {
            include: {
              role: true,
            },
          },
        },
      });

      // User not found
      if (!user) {
        await this.auditLogService.log(
          securityEventTypes.loginFailure,
          'unknown',
          ipAddress || 'unknown',
          userAgent || 'unknown',
          { reason: 'USER_NOT_FOUND', identifier },
        );
        throw new UnauthorizedException(ErrorMessages.auth.invalidCredentials);
      }

      // Check if account is locked
      if (user.isLocked && user.lockedUntil && user.lockedUntil > new Date()) {
        const remainingTime = Math.ceil(
          (user.lockedUntil.getTime() - Date.now()) / 60000,
        );
        await this.auditLogService.log(
          securityEventTypes.loginFailure,
          user.id,
          ipAddress || 'unknown',
          userAgent || 'unknown',
          { reason: 'ACCOUNT_LOCKED', remainingMinutes: remainingTime },
        );
        throw new UnauthorizedException(
          `Account is locked. Please try again in ${remainingTime} minutes.`,
        );
      }

      // Check if account is active
      if (!user.isActive) {
        await this.auditLogService.log(
          securityEventTypes.loginFailure,
          user.id,
          ipAddress || 'unknown',
          userAgent || 'unknown',
          { reason: 'ACCOUNT_INACTIVE' },
        );
        throw new UnauthorizedException(ErrorMessages.user.inactive);
      }

      // Verify password
      const isPasswordValid = await this.verifyPassword(
        user.password,
        password,
      );

      if (!isPasswordValid) {
        const newFailedAttempts = user.failedLoginAttempts + 1;

        await this.prisma.user.update({
          where: { id: user.id },
          data: { failedLoginAttempts: newFailedAttempts },
        });

        await this.auditLogService.log(
          securityEventTypes.loginFailure,
          user.id,
          ipAddress || 'unknown',
          userAgent || 'unknown',
          {
            reason: 'INVALID_PASSWORD',
            attempts: newFailedAttempts,
            maxAttempts: this.MAX_FAILED_ATTEMPTS,
          },
        );

        if (newFailedAttempts >= this.MAX_FAILED_ATTEMPTS) {
          await this.lockAccount(user.id);
          throw new UnauthorizedException(
            'Too many failed attempts. Account has been locked.',
          );
        }

        throw new UnauthorizedException(ErrorMessages.auth.invalidCredentials);
      }

      // Get security settings with error handling
      let securitySettings = null;
      try {
        securitySettings = await this.securityService.getSecuritySettings(
          user.id,
        );
      } catch (error: unknown) {
        this.logger.warn(
          `Failed to fetch security settings for user ${user.id}: ${getErrorMessage(error)}`,
          { stack: getErrorStack(error) },
        );
        // Continue with null securitySettings - 2FA will be skipped
      }

      // Check 2FA if enabled
      if (
        securitySettings?.twoFactorEnabled &&
        securitySettings?.twoFactorSecret
      ) {
        if (!twoFactorToken) {
          await this.auditLogService.log(
            securityEventTypes.loginFailure,
            user.id,
            ipAddress || 'unknown',
            userAgent || 'unknown',
            { reason: '2FA_TOKEN_MISSING' },
          );
          throw new BadRequestException(
            'Two-factor authentication token required',
          );
        }

        const is2FAValid = await this.securityService.verifyTwoFactor(
          user.id,
          twoFactorToken,
        );

        if (!is2FAValid) {
          await this.auditLogService.log(
            securityEventTypes.loginFailure,
            user.id,
            ipAddress || 'unknown',
            userAgent || 'unknown',
            { reason: 'INVALID_2FA_TOKEN' },
          );
          throw new UnauthorizedException(
            'Invalid two-factor authentication token',
          );
        }
      }

      // Clear failed login attempts on successful authentication
      await this.clearFailedLoginAttempts(user.email);

      // Get user role and permissions
      const primaryRole = user.userRoles.reduce(
        (highestRole: Role, userRole: any) => {
          const currentRoleHierarchy =
            roleHierarchy[userRole.role.name as Role];
          const highestRoleHierarchy = roleHierarchy[highestRole];
          return currentRoleHierarchy > highestRoleHierarchy
            ? (userRole.role.name as Role)
            : highestRole;
        },
        Role.student, // Default fallback instead of guest
      );

      const allRoles = user.userRoles.map(
        (userRole: any) => userRole.role.name as Role,
      );

      const permissions =
        await this.permissionCalculationService.getEffectivePermissionsForRole(
          primaryRole,
        );

      // Create JWT payload
      const payload: JwtPayload = {
        sub: user.id,
        email: user.email,
        role: primaryRole,
        roles: allRoles, // Add this line
        permissions,
      };

      // Generate tokens
      const accessToken = await this.jwtService.signAsync(payload, {
        secret: this.JWT_SECRET,
        expiresIn: this.JWT_EXPIRES_IN as any,
      });

      const refreshToken = await this.refreshTokenService.createRefreshToken(
        user.id,
      );

      // Update user login information
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          lastLogin: new Date(),
          failedLoginAttempts: 0,
          isLocked: false,
          lockedUntil: null,
        },
      });

      // Log successful login
      await this.auditLogService.log(
        securityEventTypes.loginSuccess,
        user.id,
        ipAddress || 'unknown',
        userAgent || 'unknown',
        { deviceId, userRole: primaryRole },
      );

      // Calculate token expiration
      const expiresAt = new Date(
        Date.now() + this.parseDurationToMilliseconds(this.JWT_EXPIRES_IN),
      );

      // Check email verification status
      const isEmailVerified = await this.securityService.isEmailVerified(
        user.id,
      );

      return {
        accessToken,
        refreshToken,
        expiresAt,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          username: user.username ?? '',
          isEmailVerified,
        },
        roles: {
          role: primaryRole,
          roles: allRoles,
          permissions,
        },
      };
    } catch (error) {
      this.logger.error(`Login error: ${getErrorMessage(error)}`, {
        ...logContext,
        stack: getErrorStack(error),
      });

      if (
        error instanceof UnauthorizedException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      throw new UnauthorizedException('Authentication failed');
    }
  }

  /**
   * Registers a new user and returns access tokens
   */
  async register(registerDto: RegisterDto): Promise<AuthResponse> {
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

      // Send verification email
      try {
        await this.securityService.sendVerificationEmail(user as any);
      } catch (emailError) {
        this.logger.error(
          `Failed to send verification email: ${getErrorMessage(emailError)}`,
          { userId: user.id, stack: getErrorStack(emailError) },
        );

        // In development, auto-verify email if sending fails
        if (process.env.NODE_ENV !== 'production') {
          await this.prisma.userSecuritySettings.update({
            where: { id: user.id },
            data: {
              isEmailVerified: true,
            },
          });
        }
      }

      const userRole = user.userRoles?.[0]?.role.name || Role.student;
      const allRoles = user.userRoles.map((ur: any) => ur.role.name as Role);

      const permissions =
        await this.permissionCalculationService.getEffectivePermissionsForRole(
          userRole as Role,
        );

      const payload: JwtPayload = {
        sub: user.id,
        email: user.email,
        role: userRole as Role,
        roles: allRoles, // Add this line
        permissions,
      };

      const accessToken = await this.jwtService.signAsync(payload);
      const refreshToken = await this.refreshTokenService.createRefreshToken(
        user.id,
      );

      const expiresAt = new Date(
        Date.now() + this.parseDurationToMilliseconds(this.JWT_EXPIRES_IN),
      );

      let isEmailVerified = false;
      try {
        isEmailVerified = await this.securityService.isEmailVerified(user.id);
      } catch (error) {
        this.logger.warn(
          `Could not check email verification: ${getErrorMessage(error)}`,
        );
      }

      return {
        accessToken,
        refreshToken,
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
          role: userRole as Role,
          roles: allRoles,
          permissions,
        },
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

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { userRoles: { include: { role: true } } },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const userRole = (user.userRoles?.[0]?.role.name as Role) || Role.student;
    const allRoles = user.userRoles.map((ur: any) => ur.role.name as Role);

    const permissions =
      await this.permissionCalculationService.getEffectivePermissionsForRole(
        userRole,
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
      expiresIn: this.JWT_EXPIRES_IN as any,
    });

    const newRefreshToken = await this.refreshTokenService.createRefreshToken(
      user.id,
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
      Date.now() + this.parseDurationToMilliseconds(this.JWT_EXPIRES_IN),
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
