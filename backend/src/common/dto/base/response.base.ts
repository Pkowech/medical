import {
  ApiProperty,
  ApiPropertyOptional,
  ApiHideProperty,
} from '@nestjs/swagger';

// Define role type locally to avoid circular Prisma imports in Swagger schema generation
type RoleType = 'student' | 'moderator' | 'instructor' | 'admin';

export class BaseResponseDto<T = any> {
  @ApiProperty({ description: 'Indicates if the request was successful' })
  success?: boolean;
  message?: string;
  data?: T;
  timestamp!: string;

  constructor(data?: T, message?: string, success: boolean = true) {
    this.success = success;
    this.data = data;
    this.message = message;
    this.timestamp = new Date().toISOString();
  }
}

export class BaseUserResponseDto {
  @ApiProperty({ description: 'Unique identifier of the user' })
  id?: string;

  @ApiPropertyOptional({ description: "User's email address" })
  email?: string;

  @ApiPropertyOptional({ description: "User's username" })
  username?: string;

  @ApiPropertyOptional({ description: "User's first name" })
  firstName?: string;

  @ApiPropertyOptional({ description: "User's last name" })
  lastName?: string;

  @ApiProperty({ description: 'Whether the user account is active' })
  isActive?: boolean;

  @ApiPropertyOptional({ description: "URL to the user's profile image" })
  profileImage?: string;

  @ApiPropertyOptional({ description: "User's phone number" })
  phoneNumber?: string;

  @ApiPropertyOptional({ description: 'Short biography of the user' })
  bio?: string;

  @ApiPropertyOptional({ description: "User's physical location" })
  location?: string;

  @ApiPropertyOptional({ description: 'Medical specialization' })
  specialization?: string;

  @ApiPropertyOptional({ description: 'Years of professional experience' })
  yearOfExperience?: number;

  @ApiProperty({
    description: "User's primary role",
    enum: ['student', 'moderator', 'instructor', 'admin'],
    example: 'student',
  })
  role?: RoleType;

  @ApiProperty({
    description: 'All user roles',
    type: [String],
    default: ['student'],
    items: { enum: ['student', 'moderator', 'instructor', 'admin'] },
  })
  roles?: RoleType[];

  @ApiProperty({ description: 'Whether the email is verified' })
  isEmailVerified?: boolean;

  @ApiProperty({ description: 'Whether 2FA is enabled' })
  twoFactorEnabled?: boolean;

  @ApiProperty({ description: 'User permissions', type: [String] })
  permissions?: string[];

  @ApiProperty({ description: 'Current learning streak in days' })
  streakDays?: number;

  @ApiPropertyOptional({ description: 'When the account was created' })
  createdAt?: string | Date;

  @ApiPropertyOptional({ description: 'When the account was last updated' })
  updatedAt?: string | Date;

  @ApiPropertyOptional({ description: 'When the user last logged in' })
  lastLogin?: string | Date;

  /**
   * Static method to map a Prisma user object to BaseUserResponseDto
   * Moved from UsersService to centralize mapping logic as requested.
   */
  static fromPrisma(user: any): BaseUserResponseDto {
    if (!user) {
      return {};
    }

    // Logic from UsersService.mapUserToDto
    const sortedRoles = (user.userRoles || [])
      .map((ur: any) => ur.role)
      .filter(Boolean)
      .sort(
        (a: any, b: any) => (b.hierarchyLevel || 0) - (a.hierarchyLevel || 0),
      );

    const primaryRole = sortedRoles[0];
    const userRole = (primaryRole?.name as RoleType) || 'student';

    const allPermissions = (user.userRoles || []).flatMap((ur: any) =>
      (ur.role?.permissions || []).map((p: any) => p.permission?.name),
    );
    const permissions = [...new Set(allPermissions)].filter(
      Boolean,
    ) as string[];

    return {
      id: user.id,
      email: user.email || undefined,
      username: user.username || undefined,
      firstName: user.firstName || undefined,
      lastName: user.lastName || undefined,
      isActive: user.isActive,
      isEmailVerified: user.securitySettings?.isEmailVerified || false,
      twoFactorEnabled: user.securitySettings?.twoFactorEnabled || false,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      lastLogin: user.lastLogin || undefined,
      profileImage: user.profileImage || undefined,
      phoneNumber: user.phoneNumber || undefined,
      bio: user.bio || undefined,
      location: user.location || undefined,
      specialization: user.specialization || undefined,
      yearOfExperience: user.yearOfExperience || undefined,
      streakDays: user.streakDays || 0,
      role: userRole,
      roles: sortedRoles.map((r: any) => r.name as RoleType),
      permissions,
    };
  }
}

export class ApiResponseDto<T = any> extends BaseResponseDto<T> {
  @ApiProperty()
  statusCode: number;

  @ApiHideProperty()
  errors?: Array<{
    field: string;
    message: string;
  }>;

  private constructor(
    data: T | null,
    message: string | undefined,
    success: boolean,
    statusCode: number,
    errors?: Array<{ field: string; message: string }>,
  ) {
    const normalizedData =
      data === undefined || data === null ? ({} as any) : data;
    super(normalizedData, message, success);
    this.statusCode = statusCode;
    this.errors = errors;
  }

  static success<T>(
    data: T,
    message?: string,
    statusCode: number = 200,
  ): ApiResponseDto<T> {
    const normalizedData =
      data === undefined || data === null ? ({} as any) : data;
    return new ApiResponseDto<T>(normalizedData, message, true, statusCode);
  }

  static created<T>(data: T, message?: string): ApiResponseDto<T> {
    return new ApiResponseDto<T>(data, message, true, 201);
  }

  static error(
    message: string,
    statusCode: number = 400,
    errors?: Array<{ field: string; message: string }>,
  ): ApiResponseDto<null> {
    return new ApiResponseDto<null>(null, message, false, statusCode, errors);
  }
}
