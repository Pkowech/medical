import { apiService } from '@/features/auth/services/apiClient';
import {
  User,
  UserResponse,
} from '@/shared/types/authInterface';
import { RoleEntity } from '@/shared/types/systemInterface';
import { SystemAnalytics } from '@/shared/types/analyticsInterface';

export interface AdminUsersPage {
  users: User[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface AdminUserFilters {
  search?: string;
  role?: string;
  status?: string;
}

export class AdminService {
  private readonly baseUrl = '/admin';

  async getUsers(
    page = 1,
    limit = 10,
    filters: AdminUserFilters = {},
  ): Promise<AdminUsersPage> {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (filters.search?.trim()) params.set('search', filters.search.trim());
    if (filters.role && filters.role !== 'all') params.set('role', filters.role);
    if (filters.status && filters.status !== 'all') params.set('status', filters.status);

    const response = await apiService.get<unknown>(`${this.baseUrl}/users?${params.toString()}`);
    let payload: unknown = response;
    let paginationValue: unknown;
    let usersValue: unknown[] | undefined;

    for (let depth = 0; depth < 5; depth += 1) {
      if (Array.isArray(payload)) {
        usersValue = payload;
        break;
      }
      if (!payload || typeof payload !== 'object') break;

      const record = payload as Record<string, unknown>;
      paginationValue ??= record.pagination ?? record.meta;
      if (Array.isArray(record.users)) {
        usersValue = record.users;
        break;
      }
      if (record.data === undefined || record.data === payload) break;
      payload = record.data;
    }

    if (!usersValue) {
      throw new Error('The admin users response did not contain a user list.');
    }

    const pagination =
      paginationValue && typeof paginationValue === 'object'
        ? (paginationValue as Record<string, unknown>)
        : {};

    const total = this.toNumber(pagination.total, usersValue.length);
    const currentPage = this.toNumber(pagination.page, page);
    const currentLimit = this.toNumber(pagination.limit, limit);

    return {
      users: usersValue.map(user => this.normalizeAdminUser(user)),
      pagination: {
        page: currentPage,
        limit: currentLimit,
        total,
        totalPages: this.toNumber(pagination.totalPages, Math.ceil(total / currentLimit)),
      },
    };
  }

  async getUser(id: string): Promise<User> {
    const response = await apiService.get<UserResponse>(`${this.baseUrl}/users/${id}`);
    return this.unwrapPayload<User>(response.data);
  }

  async createUser(userData: Partial<User>): Promise<User> {
    const response = await apiService.post<UserResponse>(`${this.baseUrl}/users`, userData);
    return this.unwrapPayload<User>(response.data);
  }

  async updateUser(id: string, userData: Partial<User>): Promise<User> {
    const response = await apiService.put<UserResponse>(`${this.baseUrl}/users/${id}`, userData);
    return this.unwrapPayload<User>(response.data);
  }

  async deleteUser(id: string): Promise<void> {
    await apiService.delete(`${this.baseUrl}/users/${id}`);
  }

  async getRoles(page = 1, limit = 10): Promise<RoleEntity[]> {
    const response = await apiService.get<unknown>(
      `${this.baseUrl}/roles?page=${page}&limit=${limit}`
    );

    let payload: unknown = response;
    for (let depth = 0; depth < 5; depth += 1) {
      if (Array.isArray(payload)) return payload as RoleEntity[];
      if (!payload || typeof payload !== 'object') break;

      const record = payload as Record<string, unknown>;
      if (Array.isArray(record.roles)) return record.roles as RoleEntity[];
      if (Array.isArray(record.data)) return record.data as RoleEntity[];
      if (record.data === undefined || record.data === payload) break;
      payload = record.data;
    }

    throw new Error('The admin roles response did not contain a role list.');
  }

  async getRole(id: string): Promise<RoleEntity> {
    const response = await apiService.get<RoleEntity>(`${this.baseUrl}/roles/${id}`);
    return this.unwrapPayload<RoleEntity>(response.data);
  }

  async createRole(roleData: Partial<RoleEntity>): Promise<RoleEntity> {
    const response = await apiService.post<RoleEntity>(`${this.baseUrl}/roles`, roleData);
    return this.unwrapPayload<RoleEntity>(response.data);
  }

  async updateRole(id: string, roleData: Partial<RoleEntity>): Promise<RoleEntity> {
    const response = await apiService.put<RoleEntity>(`${this.baseUrl}/roles/${id}`, roleData);
    return this.unwrapPayload<RoleEntity>(response.data);
  }

  async deleteRole(id: string): Promise<void> {
    await apiService.delete(`${this.baseUrl}/roles/${id}`);
  }

  async getSystemAnalytics(): Promise<SystemAnalytics | null> {
    try {
      const response = await apiService.get<
        | { users?: number; courses?: number; quizzes?: number; attempts?: number; units?: number; questions?: number; quizCompletionRate?: number }
        | { data: { users?: number; courses?: number; quizzes?: number; attempts?: number; units?: number; questions?: number; quizCompletionRate?: number } }>(
        '/admin/system-overview/data',
        {
          timeout: 15000,
        }
      );

      const analytics = this.normalizeSystemAnalytics(response.data);
      if (!analytics) {
        this.logger.warn('getSystemAnalytics: backend returned empty body', response.data);
        return null;
      }

      return {
        totalUsers: analytics.users ?? 0,
        totalCourses: analytics.courses ?? 0,
        totalAssessments: analytics.quizzes ?? 0,
        averageCompletionRate: analytics.quizCompletionRate ?? 0,
        overallCompletionRate: analytics.quizCompletionRate ?? 0,
        lastUpdated: Date.now(),
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : typeof error === 'string'
          ? error
          : JSON.stringify(error);

      this.logger.error('Error fetching system stats:', errorMessage);
      return null;
    }
  }

  private unwrapPayload<T>(payload: unknown): T {
    if (!payload || typeof payload !== 'object') {
      return payload as T;
    }

    const record = payload as Record<string, unknown>;
    if (record.data !== undefined) {
      return record.data as T;
    }

    return payload as T;
  }

  private toNumber(value: unknown, fallback: number): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  }

  private normalizeAdminUser(value: unknown): User {
    if (!value || typeof value !== 'object') {
      throw new Error('The admin users response contains an invalid user record.');
    }

    const user = value as Record<string, unknown>;
    if (typeof user.id !== 'string' || typeof user.email !== 'string') {
      throw new Error('The admin users response contains a user without an ID or email.');
    }

    const nestedRoles = Array.isArray(user.userRoles)
      ? user.userRoles
          .map(userRole =>
            userRole && typeof userRole === 'object'
              ? (userRole as { role?: { name?: unknown } }).role?.name
              : undefined
          )
          .filter((role): role is string => typeof role === 'string')
      : [];
    const roles = Array.isArray(user.roles)
      ? user.roles.filter((role): role is string => typeof role === 'string')
      : nestedRoles;
    const role = typeof user.role === 'string' ? user.role : roles[0] ?? 'student';
    const firstName = typeof user.firstName === 'string' ? user.firstName : '';
    const lastName = typeof user.lastName === 'string' ? user.lastName : '';
    const fullName =
      typeof user.fullName === 'string'
        ? user.fullName
        : `${firstName} ${lastName}`.trim() || user.email;
    const status =
      typeof user.status === 'string'
        ? user.status
        : user.isLocked === true
          ? 'suspended'
          : user.isActive === false
            ? 'inactive'
            : 'active';

    return {
      ...user,
      id: user.id,
      email: user.email,
      username: typeof user.username === 'string' ? user.username : '',
      firstName,
      lastName,
      fullName,
      role: role as User['role'],
      roles: roles as User['roles'],
      permissions: Array.isArray(user.permissions) ? user.permissions : [],
      isEmailVerified: user.isEmailVerified === true,
      isActive: user.isActive !== false,
      status: status as User['status'],
      createdAt: typeof user.createdAt === 'string' ? user.createdAt : '',
      lastLoginAt:
        typeof user.lastLoginAt === 'string'
          ? user.lastLoginAt
          : typeof user.lastLogin === 'string'
            ? user.lastLogin
            : undefined,
    };
  }

  private normalizeSystemAnalytics(
    payload: unknown | null | undefined,
  ): {
    users?: number;
    courses?: number;
    quizzes?: number;
    attempts?: number;
    units?: number;
    questions?: number;
    quizCompletionRate?: number;
  } | null {
    if (!payload) {
      return null;
    }

    const unwrapped = this.unwrapPayload<unknown>(payload);
    if (unwrapped && typeof unwrapped === 'object') {
      const nested = unwrapped as { data?: unknown };
      return nested.data && typeof nested.data === 'object'
        ? (nested.data as {
            users?: number;
            courses?: number;
            quizzes?: number;
            attempts?: number;
            units?: number;
            questions?: number;
            quizCompletionRate?: number;
          })
        : (unwrapped as {
            users?: number;
            courses?: number;
            quizzes?: number;
            attempts?: number;
            units?: number;
            questions?: number;
            quizCompletionRate?: number;
          });
    }

    return payload as {
      users?: number;
      courses?: number;
      quizzes?: number;
      attempts?: number;
      units?: number;
      questions?: number;
      quizCompletionRate?: number;
    };
  }

  private readonly logger = {
    warn: (msg: string, data?: unknown) => console.warn(`[AdminService] ${msg}`, data),
    error: (msg: string, data?: unknown) => console.error(`[AdminService] ${msg}`, data),
  };
}

export const adminService = new AdminService();
