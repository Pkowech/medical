import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '#infrastructure/prisma/prisma.service';
import { RedisService } from '#infrastructure/redis/redis.service';
import { BaseAnalyticsService } from '#common/services/base-analytics.service';
import { getErrorMessage, getErrorStack } from '#common/utils/error.utils';
import { Prisma, RoleName } from '@prisma/client';
import * as argon2 from 'argon2';
import { AdminCreateUserDto, AdminUpdateUserDto } from '../dto/admin-user.dto';
import { CreateRoleDto, UpdateRoleDto } from '#common/dto/roles.dto';

interface AdminUserFilters {
  search?: string;
  role?: string;
  status?: string;
}

@Injectable()
export class AdminService extends BaseAnalyticsService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    protected readonly prisma: PrismaService,
    protected readonly redis: RedisService,
  ) {
    super(prisma, redis);
  }

  async getSystemMetrics() {
    try {
      const cacheKey = this.generateCacheKey('system-metrics:v2');

      try {
        const cached = await this.getCachedAnalytics(cacheKey);
        if (cached) {
          return cached;
        }
      } catch (cacheError) {
        this.logger.warn(
          `Cache retrieval failed: ${getErrorMessage(cacheError)}`,
        );
        // Continue execution to fetch fresh data
      }

      const metrics = await this.prisma.$transaction([
        this.prisma.user.count(),
        this.prisma.quiz.count(),
        this.prisma.quizAttempt.count(),
        this.prisma.quizAttempt.count({ where: { completedAt: { not: null } } }),
        this.prisma.course.count(),
        this.prisma.unit.count(),
        this.prisma.question.count(),
      ]);

      const [users, quizzes, attempts, completedAttempts, courses, units, questions] = metrics;
      const systemMetrics = {
        users,
        quizzes,
        attempts,
        courses,
        units,
        questions,
        quizCompletionRate: attempts > 0 ? (completedAttempts / attempts) * 100 : 0,
      };

      // Attempt to cache but don't block on cache errors
      try {
        await this.cacheAnalytics(cacheKey, systemMetrics, 1800); // Cache for 30 minutes
      } catch (cacheError) {
        this.logger.warn(
          `Cache storage failed: ${getErrorMessage(cacheError)}`,
        );
      }

      return systemMetrics;
    } catch (error) {
      this.logger.error(
        `Error retrieving system metrics: ${getErrorMessage(error)}`,
        getErrorStack(error),
      );
      throw error; // Let the controller handle the error response
    }
  }

  async getUsers(
    page: number = 1,
    limit: number = 10,
    filters: AdminUserFilters = {},
  ) {
    const skip = (page - 1) * limit;
    const search = filters.search?.trim().slice(0, 100);
    const where: Prisma.UserWhereInput = {};

    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { username: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (filters.role && Object.values(RoleName).includes(filters.role as RoleName)) {
      where.userRoles = { some: { role: { name: filters.role as RoleName } } };
    }

    if (filters.status === 'active') {
      where.isActive = true;
      where.isLocked = false;
    } else if (filters.status === 'inactive') {
      where.isActive = false;
      where.isLocked = false;
    } else if (filters.status === 'suspended') {
      where.isLocked = true;
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          username: true,
          firstName: true,
          lastName: true,
          isActive: true,
          isLocked: true,
          createdAt: true,
          lastLogin: true,
          userRoles: {
            select: {
              role: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: users,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getAllUsers() {
    return this.prisma.user.findMany();
  }

  async getUserById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        isActive: true,
        isLocked: true,
        createdAt: true,
        lastLogin: true,
        userRoles: {
          select: {
            role: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });
  }

  async createUser(userData: AdminCreateUserDto) {
    const roleName = userData.role ?? RoleName.student;
    const role = await this.prisma.role.findUnique({ where: { name: roleName } });
    if (!role) {
      throw new NotFoundException(`Role '${roleName}' was not found.`);
    }

    const { email, password, username, firstName, lastName, acceptTerms } = userData;
    const status = userData.status ?? 'active';

    return this.prisma.user.create({
      data: {
        email,
        password: await argon2.hash(password),
        ...(username && { username }),
        ...(firstName && { firstName }),
        ...(lastName && { lastName }),
        ...(userData.phoneNumber !== undefined && { phoneNumber: userData.phoneNumber }),
        ...(userData.profileImage !== undefined && { profileImage: userData.profileImage }),
        ...(userData.bio !== undefined && { bio: userData.bio }),
        ...(userData.location !== undefined && { location: userData.location }),
        ...(userData.careerStage !== undefined && { careerStage: userData.careerStage }),
        ...(userData.healthcareField !== undefined && {
          healthcareField: userData.healthcareField,
        }),
        ...(userData.studyYear !== undefined && { studyYear: userData.studyYear }),
        ...(userData.yearOfExperience !== undefined && {
          yearOfExperience: userData.yearOfExperience,
        }),
        ...(userData.specialization !== undefined && {
          specialization: userData.specialization,
        }),
        ...(userData.preferences !== undefined && { preferences: userData.preferences }),
        isActive: status !== 'inactive',
        isLocked: status === 'suspended',
        securitySettings: { create: { acceptTerms } },
        userRoles: { create: { roleId: role.id } },
      },
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        isActive: true,
        isLocked: true,
        createdAt: true,
        lastLogin: true,
        userRoles: { select: { role: { select: { id: true, name: true } } } },
      },
    });
  }

  async deleteUser(id: string) {
    await this.prisma.user.delete({ where: { id } });
    return { id, deleted: true };
  }

  async updateUser(id: string, userData: AdminUpdateUserDto) {
    const { password, role: roleName, status, acceptTerms } = userData;
    const role = roleName
      ? await this.prisma.role.findUnique({ where: { name: roleName } })
      : null;

    if (roleName && !role) {
      throw new NotFoundException(`Role '${roleName}' was not found.`);
    }

    const data: Prisma.UserUpdateInput = {
      ...(userData.email !== undefined && { email: userData.email }),
      ...(userData.username !== undefined && { username: userData.username }),
      ...(userData.firstName !== undefined && { firstName: userData.firstName }),
      ...(userData.lastName !== undefined && { lastName: userData.lastName }),
      ...(userData.phoneNumber !== undefined && { phoneNumber: userData.phoneNumber }),
      ...(userData.profileImage !== undefined && { profileImage: userData.profileImage }),
      ...(userData.bio !== undefined && { bio: userData.bio }),
      ...(userData.location !== undefined && { location: userData.location }),
      ...(userData.careerStage !== undefined && { careerStage: userData.careerStage }),
      ...(userData.healthcareField !== undefined && {
        healthcareField: userData.healthcareField,
      }),
      ...(userData.studyYear !== undefined && { studyYear: userData.studyYear }),
      ...(userData.yearOfExperience !== undefined && {
        yearOfExperience: userData.yearOfExperience,
      }),
      ...(userData.specialization !== undefined && {
        specialization: userData.specialization,
      }),
      ...(userData.preferences !== undefined && { preferences: userData.preferences }),
      ...(password ? { password: await argon2.hash(password) } : {}),
      ...(status
        ? { isActive: status !== 'inactive', isLocked: status === 'suspended' }
        : {}),
      ...(acceptTerms !== undefined
        ? {
            securitySettings: {
              upsert: {
                create: { acceptTerms },
                update: { acceptTerms },
              },
            },
          }
        : {}),
      ...(role
        ? {
            userRoles: {
              deleteMany: {},
              create: { roleId: role.id },
            },
          }
        : {}),
    };

    return this.prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        isActive: true,
        isLocked: true,
        createdAt: true,
        lastLogin: true,
        userRoles: { select: { role: { select: { id: true, name: true } } } },
      },
    });
  }

  // Role Management
  async getRoles(page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;
    const activeRolesWhere = { isActive: true };
    const [roles, total] = await Promise.all([
      this.prisma.role.findMany({
        where: activeRolesWhere,
        skip,
        take: limit,
        orderBy: { hierarchyLevel: 'asc' },
        include: {
          permissions: {
            include: {
              permission: true,
            },
          },
        },
      }),
      this.prisma.role.count({ where: activeRolesWhere }),
    ]);

    // Flatten permissions for the frontend
    const mappedRoles = roles.map(role => ({
      ...role,
      permissions: role.permissions.map(rp => rp.permission),
    }));

    return {
      data: mappedRoles,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getRoleById(id: string) {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
      },
    });

    if (!role) return null;

    return {
      ...role,
      permissions: role.permissions.map(rp => rp.permission),
    };
  }

  async createRole(roleData: CreateRoleDto) {
    const { permissionNames = [], ...roleFields } = roleData;
    const permissions = await this.getPermissionsByName(permissionNames);

    return this.prisma.role.create({
      data: {
        ...roleFields,
        name: roleFields.name as RoleName,
        permissions: {
          create: permissions.map(permission => ({
            permission: { connect: { id: permission.id } },
          })),
        },
      },
      include: { permissions: { include: { permission: true } } },
    });
  }

  async updateRole(id: string, roleData: UpdateRoleDto) {
    const { permissionNames, ...roleFields } = roleData;
    const { name, ...otherRoleFields } = roleFields;
    const permissions =
      permissionNames === undefined ? undefined : await this.getPermissionsByName(permissionNames);
    const data: Prisma.RoleUpdateInput = {
      ...otherRoleFields,
      ...(name ? { name: name as RoleName } : {}),
      ...(permissions
        ? {
            permissions: {
              deleteMany: {},
              create: permissions.map(permission => ({
                permission: { connect: { id: permission.id } },
              })),
            },
          }
        : {}),
    };

    return this.prisma.role.update({
      where: { id },
      data,
      include: { permissions: { include: { permission: true } } },
    });
  }

  async deleteRole(id: string) {
    const role = await this.prisma.role.findUnique({ where: { id } });
    if (!role) throw new NotFoundException(`Role '${id}' was not found.`);
    if (role.isSystem) {
      throw new BadRequestException('System roles cannot be deactivated.');
    }
    return this.prisma.role.update({
      where: { id },
      data: { isActive: false },
    });
  }

  private async getPermissionsByName(names: string[]) {
    const uniqueNames = [...new Set(names.map(name => name.trim()).filter(Boolean))];
    const permissions = await this.prisma.permission.findMany({
      where: { name: { in: uniqueNames }, isActive: true },
      select: { id: true, name: true },
    });
    if (permissions.length !== uniqueNames.length) {
      const found = new Set(permissions.map(permission => permission.name));
      const missing = uniqueNames.filter(name => !found.has(name));
      throw new BadRequestException(`Unknown or inactive permissions: ${missing.join(', ')}`);
    }
    return permissions;
  }
}
