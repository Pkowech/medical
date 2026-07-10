import {
  IsString,
  IsOptional,
  IsBoolean,
  MinLength,
  IsEmail,
  IsNumber,
  IsObject,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Prisma } from '@prisma/client';
import { Role } from '#modules/auth/constants/role.constants';

// ============================================================================
// CORE SECURITY INTERFACES
// ============================================================================

export interface JwtPayload {
  sub: string;
  email: string | null;
  role: Role;
  roles: Role[];
  permissions: string[];
  iat?: number;
  exp?: number;
}

export interface TokenValidationResult {
  isValid: boolean;
  payload?: JwtPayload;
  error?: string;
}

export interface TokenData {
  token: string;
  userId: string;
  deviceId?: string;
  expiresAt: Date;
}

// ============================================================================
// SESSION INTERFACES
// ============================================================================

export interface SessionInfo {
  id: string;
  userId: string;
  role: string;
  token?: string;
  deviceId?: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
  lastAccessed?: Date;
  expiresAt?: Date;
  revokedAt?: Date | null;
  isActive?: boolean;
  deviceInfo?: {
    ip: string;
    userAgent: string;
    platform: string;
  };
}

// ============================================================================
// SECURITY EVENT INTERFACES AND TYPES
// ============================================================================

export const securityEventTypes = {
  loginSuccess: 'loginSuccess',
  loginFailure: 'loginFailure',
  passwordChange: 'passwordChange',
  twoFactorEnabled: 'twoFactorEnabled',
  twoFactorDisabled: 'twoFactorDisabled',
  sessionRevoked: 'sessionRevoked',
  emailVerified: 'emailVerified',
  securitySettingsUpdate: 'securitySettingsUpdate',
  suspiciousActivity: 'suspiciousActivity',
  userCreated: 'userCreated',
  tokenRefresh: 'tokenRefresh',
  tokenRevoked: 'tokenRevoked',
  sessionCreated: 'sessionCreated',
  logoutSuccess: 'logoutSuccess',
} as const;

export type SecurityEventType =
  (typeof securityEventTypes)[keyof typeof securityEventTypes];

export interface SecurityEventData {
  eventType: SecurityEventType;
  userId: string;
  ipAddress: string;
  userAgent: string;
  details: Record<string, any>;
  severity: 'low' | 'medium' | 'high';
  timestamp: Date;
}

// ============================================================================
// AUDIT AND LOGGING INTERFACES
// ============================================================================

export interface AuditLogEntry {
  id: string;
  timestamp: Date;
  userId?: string | null;
  action: string;
  resource: string;
  details: Record<string, any>;
  ipAddress: string;
  userAgent: string;
  status: 'success' | 'failure';
  metadata?: Record<string, any>;
}

// ============================================================================
// PERMISSION AND RATE LIMIT INTERFACES
// ============================================================================

export interface ResourcePermission {
  resource: string;
  actions: string[];
  conditions?: Record<string, any>;
}

export interface RateLimitConfig {
  points: number;
  duration: number;
  blockDuration: number;
}

// ============================================================================
// SECURITY SETTINGS DTOs
// ============================================================================

export class SecuritySettingsDto {
  @ApiProperty({
    description: 'Enable two-factor authentication',
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  twoFactorEnabled?: boolean;

  @ApiProperty({ description: 'Login notification settings', required: false })
  @IsOptional()
  @IsBoolean()
  loginNotifications?: boolean;

  @ApiProperty({
    description: 'Account activity notifications',
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  activityNotifications?: boolean;

  @ApiProperty({ description: 'Session timeout in minutes', required: false })
  @IsOptional()
  sessionTimeout?: number;
}

export class UpdateSystemSettingsDto {
  @IsOptional()
  @IsString()
  siteName?: string;

  @IsOptional()
  @IsBoolean()
  maintenanceMode?: boolean;

  @IsOptional()
  @IsNumber()
  maxFileUploadSize?: number;

  @IsOptional()
  @IsString()
  defaultLanguage?: string;

  @IsOptional()
  @IsBoolean()
  emailNotifications?: boolean;
}

// ============================================================================
// PASSWORD AND AUTHENTICATION DTOs
// ============================================================================

export class ChangePasswordDto {
  @ApiProperty({ description: 'Current password' })
  @IsString()
  @MinLength(1)
  currentPassword!: string;

  @ApiProperty({ description: 'New password' })
  @IsString()
  @MinLength(8)
  newPassword!: string;

  @ApiProperty({ description: 'Confirm new password' })
  @IsString()
  @MinLength(8)
  confirmPassword!: string;
}

// ============================================================================
// TWO-FACTOR AUTHENTICATION DTOs
// ============================================================================

export class TwoFactorSetupDto {
  @ApiProperty({ description: 'User ID for 2FA setup' })
  @IsString()
  userId!: string;
}

export class VerifyTwoFactorDto {
  @ApiProperty({ description: 'TOTP token from authenticator app' })
  @IsString()
  @MinLength(6)
  token!: string;
}

// ============================================================================
// EMAIL VERIFICATION DTOs
// ============================================================================

export class EmailVerificationDto {
  @ApiProperty({ description: 'Email verification token' })
  @IsString()
  token!: string;
}

export class ResendVerificationDto {
  @ApiProperty({ description: 'Email address to resend verification' })
  @IsEmail()
  email!: string;
}

// ============================================================================
// SESSION MANAGEMENT DTOs
// ============================================================================

export class RevokeSessionDto {
  @ApiProperty({ description: 'Session ID to revoke' })
  @IsString()
  sessionId!: string;
}

// ============================================================================
// ACCOUNT RECOVERY DTOs
// ============================================================================

export class AccountRecoveryDto {
  @ApiProperty({ description: 'Email address for account recovery' })
  @IsEmail()
  email!: string;
}

export class VerifyRecoveryDto {
  @ApiProperty({ description: 'Recovery token' })
  @IsString()
  token!: string;

  @ApiProperty({ description: 'Security question answers' })
  answers!: { [key: string]: string };
}

// ============================================================================
// SECURITY AUDIT DTOs
// ============================================================================

export class CreateSecurityAuditDto {
  @ApiPropertyOptional({ description: 'User ID associated with the audit' })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiProperty({ description: 'Action performed' })
  @IsString()
  action!: string;

  @ApiProperty({ description: 'Resource affected' })
  @IsString()
  resource!: string;

  @ApiPropertyOptional({ description: 'Details JSON' })
  @IsOptional()
  @IsObject()
  details?: Prisma.JsonValue;

  @ApiPropertyOptional({ description: 'Whether the audit is sensitive' })
  @IsOptional()
  @IsBoolean()
  isSensitive?: boolean;

  @ApiPropertyOptional({ description: 'IP address' })
  @IsOptional()
  @IsString()
  ipAddress?: string;

  @ApiPropertyOptional({ description: 'User agent' })
  @IsOptional()
  @IsString()
  userAgent?: string;

  @ApiPropertyOptional({ description: 'Role' })
  @IsOptional()
  @IsString()
  role?: string;
}

export class SecurityAuditResponseDto {
  @ApiProperty()
  id!: string;

  @ApiPropertyOptional()
  userId?: string;

  @ApiProperty()
  action!: string;

  @ApiProperty()
  resource!: string;

  @ApiPropertyOptional()
  details?: Prisma.JsonValue;

  @ApiPropertyOptional()
  isSensitive?: boolean;

  @ApiPropertyOptional()
  ipAddress?: string;

  @ApiPropertyOptional()
  userAgent?: string;

  @ApiPropertyOptional()
  role?: string;

  @ApiProperty()
  createdAt!: Date;
}

// ============================================================================
// SECURITY EVENT DTOs
// ============================================================================

export class CreateSecurityEventDto {
  @ApiProperty({
    description: 'User ID who triggered the event',
    required: false,
  })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiProperty({ description: 'Type of security event' })
  @IsString()
  eventType!: string;

  @ApiProperty({ description: 'Event description' })
  @IsString()
  description!: string;

  @ApiPropertyOptional({ description: 'Additional JSON details' })
  @IsOptional()
  @IsObject()
  details?: Prisma.JsonValue;

  @ApiPropertyOptional({ description: 'IP address' })
  @IsOptional()
  @IsString()
  ipAddress?: string;

  @ApiPropertyOptional({ description: 'User agent' })
  @IsOptional()
  @IsString()
  userAgent?: string;

  @ApiPropertyOptional({ description: 'Severity level' })
  @IsOptional()
  @IsString()
  severity?: string;
}

export class SecurityEventResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  userId?: string;

  @ApiProperty()
  eventType!: string;

  @ApiProperty()
  description!: string;

  @ApiPropertyOptional()
  details?: Prisma.JsonValue;

  @ApiPropertyOptional()
  ipAddress?: string;

  @ApiPropertyOptional()
  userAgent?: string;

  @ApiPropertyOptional()
  severity?: string;

  @ApiProperty()
  createdAt!: Date;
}
