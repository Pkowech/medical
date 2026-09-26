import { apiService } from '@/features/auth/services/apiClient';
import {
  User,
  UserResponse,
  UsersListResponse,
  GetRolesResponse,
} from '@/shared/types/authInterface';
import { RoleEntity } from '@/shared/types/systemInterface';
import { SystemAnalytics } from '@/shared/types/analyticsInterface';

export class AdminService {
  private readonly baseUrl = '/admin';

  async getUsers(page = 1, limit = 10): Promise<UsersListResponse['data']> {
    const response = await apiService.get<UsersListResponse>(
      `${this.baseUrl}/users?page=${page}&limit=${limit}`
    );
    return this.unwrapPayload<UsersListResponse['data']>(response.data);
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
    const response = await apiService.get<GetRolesResponse>(
      `${this.baseUrl}/roles?page=${page}&limit=${limit}`
    );

    const payload = this.unwrapPayload<unknown>(response.data);

    // Support multiple backend shapes: { roles: [...] } or { data: [...] } or direct array
    if (Array.isArray(payload)) {
      return payload as RoleEntity[];
    }

    if (payload && typeof payload === 'object') {
      const p = payload as Record<string, unknown>;
      if (Array.isArray(p.roles as unknown[])) return p.roles as unknown as RoleEntity[];
      if (Array.isArray(p.data as unknown[])) return p.data as unknown as RoleEntity[];
    }

    return [];
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
        activeUsers: analytics.users ?? 0,
        activeLearners: analytics.users ?? 0,
        totalCourses: analytics.courses ?? 0,
        completedCourses: analytics.courses ?? 0,
        totalEnrollments: 0,
        totalAssessments: analytics.quizzes ?? 0,
        totalPaths: analytics.courses ?? 0,
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
