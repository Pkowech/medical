import { ApiProperty, PartialType, ApiPropertyOptional } from '@nestjs/swagger';
import { Request } from 'express';
import {
  IsOptional,
  IsString,
  IsEmail,
  MinLength,
  IsObject,
  IsNumber,
  IsBoolean,
  IsArray,
  IsEnum,
  Validate,
  ValidateIf,
  ValidationArguments,
  IsNotEmpty,
  MaxLength,
  Min,
  Max,
} from 'class-validator';
import { BaseUserResponseDto } from './base';
import { Transform, Type } from 'class-transformer';
import { RoleName } from '@prisma/client';

// Define role type for DTO schema generation (avoids Prisma circular imports in Swagger)
type RoleType = 'student' | 'moderator' | 'instructor' | 'admin';

// Define role string enum for DTO validation
enum RoleStrings {
  STUDENT = 'student',
  MODERATOR = 'moderator',
  INSTRUCTOR = 'instructor',
  ADMIN = 'admin',
}

// Use Prisma's RoleName enum as the canonical role type for runtime/database operations
type RoleValues = RoleName;
type Role = RoleName;

// ============================================================================
// CORE USER INTERFACES
// ============================================================================

// Essential interface for Request hydration, typically populated by Passport/JWT strategies
export interface AuthenticatedUser {
  id: string;
  email: string;
  username: string;
  firstName: string | null;
  lastName: string | null;
  role: RoleName;
  isEmailVerified: boolean;
  permissions: string[];
  roles: RoleName[];
}

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
  role?: RoleName;
  roleLevel?: number;
  ip: string;
  path: string;
}

// ============================================================================
// USER STATS AND ACTIVITY DTOs
// ============================================================================

export class UserStatsDto {
  @ApiProperty({ description: 'Number of courses enrolled' })
  coursesEnrolled!: number;

  @ApiProperty({ description: 'Number of courses completed' })
  coursesCompleted!: number;

  @ApiProperty({ description: 'Total study time in minutes' })
  totalStudyTime!: number;

  @ApiProperty({ description: 'Average score across all assessments' })
  averageScore!: number;

  @ApiProperty({ description: 'Number of badges earned' })
  badges!: number;

  @ApiProperty({ description: 'Total points earned' })
  points!: number;

  @ApiProperty({ description: 'Current user level' })
  level!: number;

  @ApiProperty({ description: 'Current learning streak' })
  currentStreak!: number;
}

export class UserAnalyticsResponseDto extends UserStatsDto {
  @ApiProperty()
  @IsString()
  lastActiveDate!: string;

  @ApiProperty()
  @IsNumber()
  streakDays!: number;

  @ApiProperty({ type: [String] })
  @IsArray()
  strongestCategories!: string[];

  @ApiProperty({ type: [String] })
  @IsArray()
  improvementAreas!: string[];

  @ApiProperty({ type: [String] })
  @IsArray()
  recommendedNextSteps!: string[];
}

// BaseUserStatsDto removed as it's unused

export class UserActivityDto {
  @ApiProperty({ description: 'Activity identifier' })
  id!: string;

  @ApiProperty({ description: 'Type of activity' })
  type!: string;

  @ApiProperty({ description: 'Activity description' })
  description!: string;

  @ApiProperty({ description: 'Activity timestamp' })
  createdAt!: string;
}

export class AchievementDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  description!: string;

  @ApiProperty()
  icon!: string;

  @ApiProperty()
  unlockedAt!: Date;

  @ApiProperty()
  progress!: number;

  @ApiProperty()
  isUnlocked!: boolean;
}

export class AchievementStatsDto {
  @ApiProperty()
  totalEarned!: number;

  @ApiProperty()
  totalPossible!: number;

  @ApiProperty()
  points!: number;

  @ApiProperty()
  rank!: string;

  @ApiProperty()
  nextRankProgress!: number;
}

// UserAssessmentDto removed as it's unused

// ============================================================================
// CREATE AND UPDATE DTOs
// ============================================================================

export class CreateUserDto {
  @ApiProperty({ description: 'User email address' })
  @IsEmail()
  email!: string;

  @ApiProperty({ description: 'User password', minLength: 6 })
  @IsString()
  @MinLength(6)
  password!: string;

  @ApiProperty({ description: 'Username', required: false })
  @IsOptional()
  @IsString()
  username?: string;

  @ApiProperty({ description: 'First name', required: false })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiProperty({ description: 'Last name', required: false })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiProperty({
    description: 'User role name',
    required: false,
    default: 'student',
  })
  @IsOptional()
  @IsEnum(RoleStrings)
  role?: RoleType;

  @ApiProperty({ description: 'User preferences', required: false })
  @IsOptional()
  @IsObject()
  preferences?: Record<string, any>;

  @ApiProperty({ description: 'Phone number', required: false })
  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @ApiProperty({ description: 'Profile image URL', required: false })
  @IsOptional()
  @IsString()
  profileImage?: string;

  @ApiProperty({ description: 'Short biography', required: false })
  @IsOptional()
  @IsString()
  bio?: string;

  @ApiProperty({ description: 'Location (City, Country)', required: false })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiProperty({ description: 'Institution', required: false })
  @IsOptional()
  @IsString()
  institution?: string;

  @ApiProperty({ description: 'Specialization', required: false })
  @IsOptional()
  @IsString()
  specialization?: string;

  @ApiProperty({ description: 'Years of experience', required: false })
  @IsOptional()
  @IsNumber()
  yearOfExperience?: number;

  @ApiProperty({ description: 'Terms of service acceptance' })
  @IsBoolean()
  acceptTerms!: boolean;
}

export class UpdateUserDto extends PartialType(CreateUserDto) {
  @ApiPropertyOptional({ description: 'Short biography' })
  @IsOptional()
  @IsString()
  bio?: string;

  @ApiPropertyOptional({ description: 'Location' })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({ description: 'Phone number' })
  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @ApiPropertyOptional({ description: 'Profile image URL' })
  @IsOptional()
  @IsString()
  profileImage?: string;

  @ApiPropertyOptional({ description: 'Medical specialization' })
  @IsOptional()
  @IsString()
  specialization?: string;

  @ApiPropertyOptional({ description: 'Years of professional experience' })
  @IsOptional()
  @IsNumber()
  yearOfExperience?: number;
}

export class UpdateUserFeaturesDto {
  @ApiPropertyOptional({ description: 'Enable email notifications' })
  @IsOptional()
  @IsBoolean()
  emailNotifications?: boolean;

  @ApiPropertyOptional({ description: 'Enable push notifications' })
  @IsOptional()
  @IsBoolean()
  pushNotifications?: boolean;

  @ApiPropertyOptional({ description: 'Enable weekly digest' })
  @IsOptional()
  @IsBoolean()
  weeklyDigest?: boolean;

  @ApiPropertyOptional({ description: 'Enable gamification features' })
  @IsOptional()
  @IsBoolean()
  gamificationEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Enable AI recommendations' })
  @IsOptional()
  @IsBoolean()
  aiRecommendations?: boolean;

  @ApiPropertyOptional({ description: 'Preferred learning days' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  preferredLearningDays?: string[];

  @ApiPropertyOptional({ description: 'Daily learning goal in minutes' })
  @IsOptional()
  dailyLearningGoal?: number;

  @ApiPropertyOptional({ description: 'Notification preferences' })
  @IsOptional()
  notificationPreferences?: {
    courseUpdates?: boolean;
    assessmentReminders?: boolean;
    achievementAlerts?: boolean;
    peerInteractions?: boolean;
  };
}

// ============================================================================
// USER RESPONSE DTOs
// ============================================================================

export class UserFeaturesResponseDto {
  @ApiProperty({ description: 'User ID' })
  userId!: string;

  @ApiProperty({ description: 'Email notifications enabled' })
  emailNotifications!: boolean;

  @ApiProperty({ description: 'Push notifications enabled' })
  pushNotifications!: boolean;

  @ApiProperty({ description: 'Weekly digest enabled' })
  weeklyDigest!: boolean;

  @ApiProperty({ description: 'Gamification enabled' })
  gamificationEnabled!: boolean;

  @ApiProperty({ description: 'AI recommendations enabled' })
  aiRecommendations!: boolean;

  @ApiPropertyOptional({ description: 'Preferred learning days' })
  preferredLearningDays?: string[];

  @ApiPropertyOptional({ description: 'Daily learning goal in minutes' })
  dailyLearningGoal?: number;

  @ApiProperty({ description: 'Last updated' })
  updatedAt!: Date;
}

export class UserResponseDto extends BaseUserResponseDto {
  @ApiPropertyOptional({ description: 'User roles' })
  @IsArray()
  @IsOptional()
  roles?: RoleType[];

  @ApiPropertyOptional({ description: 'Total courses enrolled' })
  @IsNumber()
  @IsOptional()
  totalCourses?: number;

  @ApiPropertyOptional({ description: 'Courses completed' })
  @IsNumber()
  @IsOptional()
  completedCourses?: number;
}

export class UserListResponseDto {
  @ApiProperty({
    description: 'List of users',
    type: () => UserResponseDto,
    isArray: true,
  })
  @Type(() => UserResponseDto)
  users!: UserResponseDto[];

  @ApiProperty({ description: 'Pagination metadata' })
  pagination!: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// UserProfileDto removed as it's unused

export class UserProfileResponseDto extends BaseUserResponseDto {
  @ApiProperty({ description: 'Total courses enrolled' })
  @IsNumber()
  totalCourses!: number;

  @ApiProperty({ type: () => UserStatsDto })
  @Type(() => UserStatsDto)
  stats!: UserStatsDto;

  @ApiProperty({
    description: 'Recent user activities',
    type: () => UserActivityDto,
    isArray: true,
  })
  @IsArray()
  @Type(() => UserActivityDto)
  recentActivity!: UserActivityDto[];
}

// ============================================================================
// AUTHENTICATION DTOs - PROPER ORDER TO AVOID CIRCULAR DEPENDENCY
// ============================================================================

// Define UserRolesDto FIRST (for role/permission information only)
/**
 * Contains only user role and permission information.
 * Separated from user profile info to break circular dependencies in Swagger schema generation.
 * Uses string literals for role values to avoid Prisma enum circular references.
 */
export class UserRolesDto {
  @ApiProperty({
    description: 'Primary user role',
    enum: ['student', 'moderator', 'instructor', 'admin'],
  })
  @IsEnum(RoleStrings)
  role!: string;

  @ApiProperty({
    description: 'All roles assigned to user',
    enum: ['student', 'moderator', 'instructor', 'admin'],
    isArray: true,
  })
  @IsArray()
  @IsEnum(RoleStrings, { each: true })
  roles!: string[];

  @ApiProperty({ description: 'User permissions', type: [String] })
  @IsArray()
  @IsString({ each: true })
  permissions!: string[];
}

// Define AuthUserDto SECOND (essential user info only, no roles/permissions)
/**
 * User information DTO for authentication responses.
 * Contains only profile information to avoid circular Swagger schema generation.
 * Roles and permissions are in a separate UserRolesDto when needed.
 */
export class AuthUserDto {
  @ApiProperty({ description: 'User ID' })
  id!: string;

  @ApiProperty({ description: 'User email address' })
  email!: string;

  @ApiProperty({ description: 'User first name' })
  firstName!: string | null;

  @ApiProperty({ description: 'User last name' })
  lastName!: string | null;

  @ApiProperty({ description: 'Username' })
  username!: string;

  @ApiProperty({ description: 'Is email verified' })
  isEmailVerified!: boolean;
}

// Define AuthResponse THIRD (depends on AuthUserDto with lazy type resolution)
export class AuthResponse {
  @ApiProperty({ description: 'Access token' })
  accessToken!: string;

  @ApiProperty({ description: 'Refresh token' })
  refreshToken!: string;

  @ApiProperty({ description: 'Token expiration date' })
  expiresAt!: Date;

  @ApiProperty({
    description: 'User profile information',
    type: () => AuthUserDto,
  })
  @Type(() => AuthUserDto)
  user!: AuthUserDto;

  @ApiProperty({
    description: 'User roles and permissions',
    type: () => UserRolesDto,
  })
  @Type(() => UserRolesDto)
  roles!: UserRolesDto;

  constructor(partial: Partial<AuthResponse>) {
    Object.assign(this, partial);
  }
}

// Define Login/Register DTOs LAST (no dependencies on auth response DTOs)
export class RegisterDto {
  @ApiProperty({ description: 'User first name', example: 'John' })
  @IsString({ message: 'First name must be a string' })
  @IsNotEmpty({ message: 'First name is required' })
  @Transform(({ value }: { value: string | undefined }) => value?.trim())
  firstName!: string;

  @ApiProperty({ description: 'User last name', example: 'Doe' })
  @IsString({ message: 'Last name must be a string' })
  @IsNotEmpty({ message: 'Last name is required' })
  @Transform(({ value }: { value: string }) => value?.trim())
  lastName!: string;

  @ApiProperty({
    description: 'User email address',
    example: 'john.doe@example.com',
  })
  @IsEmail({}, { message: 'Invalid email format' })
  @IsNotEmpty({ message: 'Email is required' })
  @Transform(({ value }: { value: string }) => value?.trim().toLowerCase())
  email!: string;

  @ApiProperty({ description: 'Username', example: 'johndoe' })
  @IsString({ message: 'Username must be a string' })
  @IsNotEmpty({ message: 'Username is required' })
  @Transform(({ value }) => value?.trim())
  username!: string;

  @ApiProperty({ description: 'User password', example: 'StrongP@ss123' })
  @IsString({ message: 'Password must be a string' })
  @IsNotEmpty({ message: 'Password is required' })
  @MinLength(8, {
    message: `Password must be at least 8 characters long`,
  })
  password!: string;

  @ApiProperty({
    description: 'Confirm user password',
    example: 'StrongP@ss123',
  })
  @IsString({ message: 'Password confirmation must be a string' })
  @IsNotEmpty({ message: 'Password confirmation is required' })
  @Validate(
    (value: string, args: ValidationArguments) =>
      value === (args.object as RegisterDto).password,
    { message: 'Passwords do not match' },
  )
  confirmPassword!: string;

  @ApiProperty({ description: 'Accept terms and conditions' })
  @IsBoolean()
  @Validate((value: boolean) => value === true, {
    message: 'You must accept the terms and conditions',
  })
  acceptTerms!: boolean;

  @ApiProperty({
    description: 'User role',
    enum: ['student', 'moderator', 'instructor', 'admin'],
    default: 'student',
    required: false,
  })
  @IsEnum(RoleStrings, { message: 'Invalid role' })
  @IsOptional()
  role?: RoleType = 'student' as RoleType;

  @ApiProperty({ description: 'Profile picture URL', required: false })
  @IsString()
  @IsOptional()
  profilePicture?: string;

  @ApiProperty({ description: 'Phone number', required: false })
  @IsString()
  @IsOptional()
  phoneNumber?: string;

  @ApiProperty({ description: 'Bio/short biography', required: false })
  @IsString()
  @IsOptional()
  @MaxLength(500, { message: 'Bio must not exceed 500 characters' })
  bio?: string;

  @ApiProperty({ description: 'Location (City, Country)', required: false })
  @IsString()
  @IsOptional()
  @MaxLength(100, { message: 'Location must not exceed 100 characters' })
  location?: string;

  @ApiProperty({
    description: 'Specialization/area of expertise',
    required: false,
  })
  @IsString()
  @IsOptional()
  @MaxLength(100, { message: 'Specialization must not exceed 100 characters' })
  specialization?: string;

  @ApiProperty({
    description: 'Years of professional experience',
    required: false,
  })
  @IsNumber()
  @IsOptional()
  @Min(0, { message: 'Years of experience must be at least 0' })
  @Max(70, { message: 'Years of experience must not exceed 70' })
  yearOfExperience?: number;

  @ApiProperty({ description: 'Device identifier', required: false })
  @IsString()
  @IsOptional()
  deviceId?: string;

  @ApiProperty({ description: 'Device information', required: false })
  @IsOptional()
  deviceInfo?:
    | {
        userAgent?: string;
        ipAddress?: string;
        platform?: string;
      }
    | undefined;
}

export class LoginDto {
  @ApiProperty({
    description: 'User email address',
    example: 'john.doe@example.com',
    required: false,
  })
  @ValidateIf((o: LoginDto) => !o.username)
  @IsEmail({}, { message: 'Invalid email format' })
  @IsNotEmpty({ message: 'Email is required when username is not provided' })
  @Transform(({ value }: { value: string | undefined }) =>
    value?.trim().toLowerCase(),
  )
  email?: string;

  @ApiProperty({
    description: 'Username',
    example: 'johndoe',
    required: false,
  })
  @ValidateIf((o: LoginDto) => !o.email)
  @IsString({ message: 'Username must be a string' })
  @IsNotEmpty({ message: 'Username is required when email is not provided' })
  @Transform(({ value }: { value: string | undefined }) => value?.trim())
  username?: string;

  @ApiProperty({ description: 'User password', example: 'StrongP@ss123' })
  @IsString({ message: 'Password must be a string' })
  @IsNotEmpty({ message: 'Password is required' })
  @MinLength(process.env.NODE_ENV === 'development' ? 4 : 8, {
    message: `Password must be at least ${process.env.NODE_ENV === 'development' ? 4 : 8} characters long`,
  })
  password!: string;

  @ApiProperty({ description: 'Device identifier', required: false })
  @IsString()
  @IsOptional()
  deviceId?: string;

  @ApiProperty({
    description: 'Two-factor authentication token',
    required: false,
  })
  @IsString()
  @IsOptional()
  twoFactorToken?: string;

  @ApiProperty({ description: 'Remember user session', required: false })
  @IsBoolean()
  @IsOptional()
  rememberMe?: boolean;

  @ApiProperty({ description: 'Device name', required: false })
  @IsString()
  @IsOptional()
  deviceName?: string;

  @ApiProperty({
    description: 'Device type (mobile, desktop, tablet)',
    required: false,
  })
  @IsString()
  @IsOptional()
  deviceType?: string;

  @ApiProperty({ description: 'Device operating system', required: false })
  @IsString()
  @IsOptional()
  deviceOs?: string;

  @ApiProperty({ description: 'Browser name', required: false })
  @IsString()
  @IsOptional()
  deviceBrowser?: string;

  @ApiProperty({ description: 'Browser version', required: false })
  @IsString()
  @IsOptional()
  deviceBrowserVersion?: string;

  @ApiProperty({
    description: 'Device push notification token',
    required: false,
  })
  @IsString()
  @IsOptional()
  deviceToken?: string;

  @ApiProperty({ description: 'Browser user agent string', required: false })
  @IsString()
  @IsOptional()
  userAgent?: string;

  @ApiProperty({ description: 'Client IP address', required: false })
  @IsString()
  @IsOptional()
  ipAddress?: string;
}

// ============================================================================
// DEVICE AND REQUEST INTERFACES
// ============================================================================

export interface DeviceInfo {
  name?: string;
  type?: string;
  os?: string;
  browser?: string;
  browserVersion?: string;
  token?: string;
  userAgent?: string;
  ipAddress?: string;
}

export interface LoginRequest {
  email?: string;
  username?: string;
  password: string;
  deviceId?: string;
  twoFactorToken?: string;
  deviceInfo?: DeviceInfo;
  rememberMe?: boolean;
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  username?: string;
  deviceId?: string;
  deviceInfo?: DeviceInfo;
  role?: string;
  acceptTerms?: boolean;
}
