import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '#infrastructure/prisma/prisma.service';
import { RedisService } from '#infrastructure/redis/redis.service';
import { BaseAnalyticsService } from '#common/services/base-analytics.service';
import { CreateUserDto, UpdateUserDto } from '#common/dto';
import { getErrorMessage, getErrorStack } from '#common/utils/error.utils';

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
      const cacheKey = this.generateCacheKey('system-metrics');

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
        this.prisma.course.count(),
        this.prisma.unit.count(),
        this.prisma.question.count(),
      ]);

      const [users, quizzes, attempts, courses, units, questions] = metrics;
      const systemMetrics = {
        users,
        quizzes,
        attempts,
        courses,
        units,
        questions,
        quizCompletionRate: attempts > 0 ? attempts / quizzes : 0,
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

  async getUsers(page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;
    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          userRoles: {
            include: {
              role: true,
            },
          },
        },
      }),
      this.prisma.user.count(),
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
      include: {
        userRoles: {
          include: {
            role: true,
          },
        },
      },
    });
  }

  async createUser(userData: CreateUserDto) {
    return this.prisma.user.create({ data: userData });
  }

  async deleteUser(id: string) {
    return this.prisma.user.delete({ where: { id } });
  }

  async updateUser(id: string, userData: UpdateUserDto) {
    return this.prisma.user.update({
      where: { id },
      data: userData,
    });
  }

  // Role Management
  async getRoles(page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;
    const [roles, total] = await Promise.all([
      this.prisma.role.findMany({
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
      this.prisma.role.count(),
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

  async createRole(roleData: any) {
    return this.prisma.role.create({ data: roleData });
  }

  async updateRole(id: string, roleData: any) {
    return this.prisma.role.update({
      where: { id },
      data: roleData,
    });
  }

  async deleteRole(id: string) {
    return this.prisma.role.delete({ where: { id } });
  }
}
