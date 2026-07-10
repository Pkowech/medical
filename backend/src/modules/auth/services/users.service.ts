import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { getErrorMessage } from '#common/utils/error.utils';
import { PrismaService } from '#infrastructure/prisma/prisma.service';
import { RedisService } from '#infrastructure/redis/redis.service';
import { UserAnalyticsService } from '#modules/ai-analytics/services/user-analytics.service';
import { GlobalSearchSyncService } from '#infrastructure/search/services/global-search-sync.service';
import { CreateUserDto, UpdateUserDto } from '#common/dto/user.dto';
import { BaseUserResponseDto } from '#common/dto/base-response.dto';
import { UserProfileResponseDto, UserListResponseDto } from '#common/dto';
import { PaginationDto } from '#common/dto/pagination.dto';
import * as argon2 from 'argon2';
import { Prisma, User } from '@prisma/client';
import { Role } from '#modules/auth/constants/role.constants';
import {
  FILE_STORAGE,
  IFileStorage,
} from '#infrastructure/storage/file-storage.interface';
import sharp from 'sharp';

// Define the Prisma select structure for fetching user data
const userSelect = {
  id: true,
  email: true,
  username: true,
  firstName: true,
  lastName: true,
  password: true,
  phoneNumber: true,
  profileImage: true,
  bio: true,
  location: true,
  yearOfExperience: true,
  streakDays: true,
  preferences: true,
  isActive: true,
  isLocked: true,
  lockedUntil: true,
  failedLoginAttempts: true,
  points: true,
  rewards: true,
  specialization: true,
  createdAt: true,
  updatedAt: true,
  lastLogin: true,
  securitySettings: {
    select: {
      isEmailVerified: true,
      twoFactorEnabled: true,
    },
  },
  userRoles: {
    select: {
      role: {
        select: {
          name: true,
          hierarchyLevel: true,
          permissions: {
            select: {
              permission: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      },
    },
  },
} as const;

// Define a type that represents the User object with its selected relations
export type UserWithRelations = Prisma.UserGetPayload<{
  select: typeof userSelect;
}>;

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);
  private readonly CACHE_PREFIX = 'user';
  private readonly CACHE_TTL = 3600;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    @Inject(forwardRef(() => UserAnalyticsService))
    private readonly userAnalyticsService: UserAnalyticsService,
    @Inject(FILE_STORAGE) private readonly fileStorage: IFileStorage,
    @Inject(forwardRef(() => GlobalSearchSyncService))
    private readonly searchSync: GlobalSearchSyncService,
  ) {}

  private generateKey(field: string, value: string): string {
    return `${this.CACHE_PREFIX}:${field}:${value}`;
  }

  // Helper to flatten Prisma user object into BaseUserResponseDto
  public async mapUserToDto(
    user: UserWithRelations,
  ): Promise<BaseUserResponseDto> {
    const dto = BaseUserResponseDto.fromPrisma(user);

    // If profileImage is a storage key (starts with 'profiles/'), resolve to signed URL
    if (dto.profileImage && (dto.profileImage.startsWith('profiles/') || dto.profileImage.startsWith('profiles\\'))) {
      try {
        dto.profileImage = await this.fileStorage.getPresignedDownloadUrl(
          dto.profileImage.replace(/\\/g, '/'),
        );
      } catch (error) {
        this.logger.error(
          `Failed to resolve profile image URL for key ${dto.profileImage}`,
          error,
        );
        // Fallback to original key or undefined if resolution fails
      }
    }

    return dto;
  }

  async create(createUserDto: CreateUserDto): Promise<BaseUserResponseDto> {
    const {
      email,
      password,
      username,
      firstName,
      lastName,
      acceptTerms,
      role: providedRole,
      bio,
      location,
      specialization,
      yearOfExperience,
      phoneNumber,
      profileImage,
    } = createUserDto;
    const logContext = { email, username };

    // Log optional profile fields for debugging
    this.logger.debug('Creating user with optional fields:', {
      bio: bio || 'undefined',
      location: location || 'undefined',
      specialization: specialization || 'undefined',
      yearOfExperience: yearOfExperience || 'undefined',
      phoneNumber: phoneNumber || 'undefined',
      profileImage: profileImage || 'undefined',
    });

    try {
      const existingByEmail = await this.findByEmail(email);
      if (existingByEmail) {
        throw new ConflictException('User with this email already exists');
      }

      if (username) {
        const existingByUsername = await this.findByUsername(username);
        if (existingByUsername) {
          throw new ConflictException('User with this username already exists');
        }
      }

      const finalUsername =
        username || (await this.generateUniqueUsername(email));
      const hashedPassword = await argon2.hash(password);

      const roleName = providedRole || Role.student; // Ensure default
      // Fetch role by name
      const role = await this.prisma.role.findUnique({
        where: { name: roleName },
      });
      if (!role) {
        throw new NotFoundException(`Role '${roleName}' not found`);
      }

      const user = (await this.prisma.user.create({
        data: {
          email,
          username: finalUsername,
          password: hashedPassword,
          firstName,
          lastName,
          // Optional profile fields - include only if provided
          ...(bio && { bio }),
          ...(location && { location }),
          ...(specialization && { specialization }),
          ...(yearOfExperience !== undefined && { yearOfExperience }),
          ...(phoneNumber && { phoneNumber }),
          ...(profileImage && { profileImage }),
          createdAt: new Date(),
          updatedAt: new Date(),
          securitySettings: {
            create: { acceptTerms: Boolean(acceptTerms) },
          },
          ...(createUserDto.preferences && {
            preferences: createUserDto.preferences,
          }),
          userRoles: {
            create: {
              roleId: role.id,
              assignedAt: new Date(),
              assignedBy: null,
            },
          },
        },
        select: userSelect,
      })) as UserWithRelations;

      // Log what was saved to database
      this.logger.debug('User created with saved profile data:', {
        id: user.id,
        bio: user.bio || 'null',
        location: user.location || 'null',
        specialization: user.specialization || 'null',
        yearOfExperience: user.yearOfExperience || 'null',
        phoneNumber: user.phoneNumber || 'null',
        profileImage: user.profileImage || 'null',
      });

      await this.setCache(user);
      
      // Sync to global search index
      await this.searchSync.syncEntity('user', user.id);

      return await this.mapUserToDto(user);
    } catch (error) {
      this.logger.error('User creation error:', {
        ...logContext,
        error: getErrorMessage(error),
      });
      throw error;
    }
  }

  async findAll(pagination: PaginationDto): Promise<UserListResponseDto> {
    const { page = 1, limit = 10 } = pagination;
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: userSelect,
      }),
      this.prisma.user.count(),
    ]);

    return {
      users: await Promise.all(
        users.map((u) => this.mapUserToDto(u as UserWithRelations)),
      ),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    };
  }

  async findOne(id: string): Promise<UserWithRelations | null> {
    const key = this.generateKey('id', id);
    const cached = await this.redisService.get<UserWithRelations>(key);
    if (cached) {
      this.logger.debug(`User cache hit for ID: ${id}`);
      return cached;
    }

    this.logger.debug(`User cache miss for ID: ${id}, querying database...`);

    const user = await this.prisma.user.findUnique({
      where: { id },
      select: userSelect,
    });

    if (user) {
      this.logger.debug(`User found in database: ${id}, caching for ${this.CACHE_TTL}s`);
      await this.redisService.set(key, user, this.CACHE_TTL);
    } else {
      this.logger.warn(`User NOT found in database for ID: ${id}`);
    }
    return user as UserWithRelations | null;
  }

  async findByEmail(email: string): Promise<UserWithRelations | null> {
    const cachedUser = await this.redisService.get<UserWithRelations>(
      this.generateKey('email', email),
    );
    if (cachedUser) {
      return cachedUser;
    }

    const user = await this.prisma.user.findUnique({
      where: { email },
      select: userSelect,
    });

    if (!user) {
      return null;
    }

    await this.setCache(user);
    return user as UserWithRelations;
  }

  async findByUsername(username: string): Promise<UserWithRelations | null> {
    const cachedUser = await this.redisService.get<UserWithRelations>(
      this.generateKey('username', username),
    );
    if (cachedUser) {
      return cachedUser;
    }

    const user = await this.prisma.user.findUnique({
      where: { username },
      select: userSelect,
    });

    if (!user) {
      return null;
    }

    await this.setCache(user);
    return user as UserWithRelations;
  }

  async getUserProfile(userId: string): Promise<UserProfileResponseDto> {
    console.log(`[UsersService] getUserProfile starting for ${userId}`);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: userSelect,
    });

    if (!user) {
      console.warn(`[UsersService] User ${userId} not found`);
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    console.log(`[UsersService] User found, fetching analytics for ${userId}`);
    const analytics =
      await this.userAnalyticsService.getUserProfileStats(userId);

    console.log(
      `[UsersService] Analytics fetched, mapping response for ${userId}`,
    );
    const userDto = await this.mapUserToDto(user as UserWithRelations);
    const profileData: UserProfileResponseDto = {
      ...userDto,
      totalCourses: analytics.coursesEnrolled,
      stats: {
        coursesEnrolled: analytics.coursesEnrolled,
        coursesCompleted: analytics.coursesCompleted,
        totalStudyTime: analytics.totalStudyTime,
        averageScore: analytics.averageScore,
        badges: analytics.badges,
        points: analytics.points,
        level: analytics.level,
        currentStreak: analytics.currentStreak,
      },
      recentActivity: (analytics.recentActivity || []).map((a: any) => ({
        id: a.id,
        type: a.type ?? '',
        description: a.description ?? '',
        createdAt: a.createdAt,
      })),
    };

    console.log(`[UsersService] getUserProfile complete for ${userId}`);
    return profileData;
  }

  public async updateProfile(
    userId: string,
    updateUserDto: UpdateUserDto,
  ): Promise<BaseUserResponseDto> {
    console.log(`[UsersService] updateProfile starting for ${userId}`);
    const existingUser = await this.prisma.user.findUnique({
      where: { id: userId },
      select: userSelect,
    });
    if (!existingUser) {
      console.warn(`[UsersService] User ${userId} not found`);
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    const prismaData: Prisma.UserUpdateInput = {
      updatedAt: new Date(),
    };

    if (updateUserDto.firstName !== undefined) {
      prismaData.firstName = updateUserDto.firstName;
    }
    if (updateUserDto.lastName !== undefined) {
      prismaData.lastName = updateUserDto.lastName;
    }
    if (updateUserDto.email !== undefined) {
      prismaData.email = updateUserDto.email;
    }
    if (updateUserDto.username !== undefined) {
      prismaData.username = updateUserDto.username;
    }
    if (updateUserDto.phoneNumber !== undefined) {
      prismaData.phoneNumber = updateUserDto.phoneNumber;
    }
    if (updateUserDto.specialization !== undefined) {
      prismaData.specialization = updateUserDto.specialization;
    }
    if (updateUserDto.profileImage !== undefined) {
      prismaData.profileImage = updateUserDto.profileImage;
    }
    if (updateUserDto.bio !== undefined) {
      prismaData.bio = updateUserDto.bio;
    }
    if (updateUserDto.location !== undefined) {
      prismaData.location = updateUserDto.location;
    }
    if (updateUserDto.yearOfExperience !== undefined) {
      prismaData.yearOfExperience = updateUserDto.yearOfExperience;
    }

    // Merge preferences
    if (updateUserDto.preferences) {
      const currentPrefs =
        (existingUser.preferences as Record<string, any>) || {};
      prismaData.preferences = {
        ...currentPrefs,
        ...updateUserDto.preferences,
      };
    }

    console.log(
      `[UsersService] prismaData prepared, updating database for ${userId}`,
    );
    try {
      const updatedUser = await this.prisma.user.update({
        where: { id: userId },
        data: prismaData,
        select: userSelect,
      });

      console.log(
        `[UsersService] Database updated, clearing cache for ${userId}`,
      );
      await this.clearCache(existingUser as UserWithRelations);
      await this.setCache(updatedUser as UserWithRelations);

      // Sync to global search index
      await this.searchSync.syncEntity('user', updatedUser.id);

      console.log(`[UsersService] updateProfile complete for ${userId}`);
      return await this.mapUserToDto(updatedUser as UserWithRelations);
    } catch (error) {
      console.error(
        `[UsersService] Database update error for ${userId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Uploads, optimises (400×400 WebP) and stores a profile image in R2.
   * Returns the signed download URL so the client can display it immediately.
   */
  async uploadProfileImage(
    userId: string,
    file: Express.Multer.File,
  ): Promise<{ url: string; key: string }> {
    const allowedMimeTypes = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
    ];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        'Only JPEG, PNG, WebP or GIF images are accepted.',
      );
    }
    const maxSize = 5 * 1024 * 1024; // 5 MB
    if (file.size > maxSize) {
      throw new BadRequestException('Image must be smaller than 5 MB.');
    }

    // Optimise: resize to 400×400 (cover crop) and convert to WebP
    const optimised = await sharp(file.buffer)
      .resize(400, 400, { fit: 'cover', position: 'centre' })
      .webp({ quality: 80 })
      .toBuffer();

    const timestamp = Date.now();
    const key = `profiles/${userId}/${timestamp}.webp`;

    await this.fileStorage.uploadBuffer(key, optimised, 'image/webp', {
      'user-id': userId,
      'upload-date': new Date().toISOString(),
    });

    // Persist R2 key in the user row
    await this.prisma.user.update({
      where: { id: userId },
      data: { profileImage: key },
    });

    // Clear user cache so subsequent profile fetches get the new image
    const existing = await this.prisma.user.findUnique({
      where: { id: userId },
      select: userSelect,
    });
    if (existing) {
      await this.clearCache(existing as UserWithRelations);
    }

    // Return a fresh signed URL (1 hour validity)
    const url = await this.fileStorage.getPresignedDownloadUrl(key, {
      filename: key.split('/').pop(),
      contentType: 'application/octet-stream',
      inline: true,
    });
    this.logger.log(`Profile image uploaded for user ${userId}: ${key}`);
    return { url, key };
  }

  async updatePassword(
    id: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    const valid = await argon2.verify(user.password, currentPassword);
    if (!valid) {
      throw new UnauthorizedException('Invalid current password');
    }

    const hash = await argon2.hash(newPassword);
    await this.prisma.user.update({
      where: { id },
      data: { password: hash, updatedAt: new Date() },
    });

    await this.clearCache(user);
  }

  public async resetPassword(email: string): Promise<void> {
    const user = await this.findByEmail(email);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const tempPassword = Math.random().toString(36).slice(-8);
    const hash = await argon2.hash(tempPassword);
    await this.prisma.user.update({
      where: { email },
      data: { password: hash, updatedAt: new Date() },
    });

    await this.clearCache(user);
    // TODO: send tempPassword via email
  }

  public async validateUser(
    emailOrUsername: string,
    password: string,
  ): Promise<UserWithRelations | null> {
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: emailOrUsername }, { username: emailOrUsername }],
      },
      select: userSelect,
    });

    if (!user) {
      return null;
    }

    const valid = await argon2.verify(user.password, password);
    if (!valid) {
      return null;
    }

    return user as UserWithRelations;
  }

  public async remove(id: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    await this.prisma.user.delete({ where: { id } });
    await this.clearCache(user);
  }

  public async updateRole(
    id: string,
    roleName: Role,
  ): Promise<BaseUserResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: userSelect,
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    const role = await this.prisma.role.findUnique({
      where: { name: roleName },
    });

    if (!role) {
      throw new NotFoundException(`Role ${roleName} not found`);
    }

    await this.prisma.userRole.deleteMany({
      where: { userId: id },
    });

    await this.prisma.userRole.create({
      data: {
        userId: id,
        roleId: role.id,
        assignedBy: null,
        assignedAt: new Date(),
      },
    });

    const updatedUser = await this.prisma.user.findUnique({
      where: { id },
      select: userSelect,
    });

    if (!updatedUser) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    await this.clearCache(user as UserWithRelations);
    await this.setCache(updatedUser as UserWithRelations);
    return await this.mapUserToDto(updatedUser as UserWithRelations);
  }

  private async setCache(user: UserWithRelations): Promise<void> {
    await this.redisService.set(
      this.generateKey('id', user.id),
      user,
      this.CACHE_TTL,
    );
    await this.redisService.set(
      this.generateKey('email', user.email),
      user,
      this.CACHE_TTL,
    );
    if (user.username) {
      await this.redisService.set(
        this.generateKey('username', user.username),
        user,
        this.CACHE_TTL,
      );
    }
  }

  private async clearCache(user: User | UserWithRelations): Promise<void> {
    const keys = [
      this.generateKey('id', user.id),
      this.generateKey('email', user.email),
      user.username && this.generateKey('username', user.username),
    ].filter(Boolean) as string[];
    await Promise.all(keys.map((k) => this.redisService.del(k)));
  }

  private async generateUniqueUsername(email: string): Promise<string> {
    const base = email
      .split('@')[0]
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
    let username = base;
    let counter = 1;
    while (await this.findByUsername(username)) {
      username = `${base}${counter++}`;
    }
    return username;
  }
}
