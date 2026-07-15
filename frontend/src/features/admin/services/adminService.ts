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
    return response.data.data;
  }

  async getUser(id: string): Promise<User> {
    const response = await apiService.get<UserResponse>(`${this.baseUrl}/users/${id}`);
    return response.data.data;
  }

  async createUser(userData: Partial<User>): Promise<User> {
    const response = await apiService.post<UserResponse>(`${this.baseUrl}/users`, userData);
    return response.data.data;
  }

  async updateUser(id: string, userData: Partial<User>): Promise<User> {
    const response = await apiService.put<UserResponse>(`${this.baseUrl}/users/${id}`, userData);
    return response.data.data;
  }

  async deleteUser(id: string): Promise<void> {
    await apiService.delete(`${this.baseUrl}/users/${id}`);
  }

  async getRoles(page = 1, limit = 10): Promise<RoleEntity[]> {
    const response = await apiService.get<GetRolesResponse>(
      `${this.baseUrl}/roles?page=${page}&limit=${limit}`
    );

    const payload = response.data as unknown;

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
    return response.data;
  }

  async createRole(roleData: Partial<RoleEntity>): Promise<RoleEntity> {
    const response = await apiService.post<RoleEntity>(`${this.baseUrl}/roles`, roleData);
    return response.data;
  }

  async updateRole(id: string, roleData: Partial<RoleEntity>): Promise<RoleEntity> {
    const response = await apiService.put<RoleEntity>(`${this.baseUrl}/roles/${id}`, roleData);
    return response.data;
  }

  async deleteRole(id: string): Promise<void> {
    await apiService.delete(`${this.baseUrl}/roles/${id}`);
  }

  async getSystemAnalytics(): Promise<SystemAnalytics | null> {
    try {
      const response = await apiService.get<SystemAnalytics | { data: SystemAnalytics }>(
        '/admin/system-overview/summary',
        {
          timeout: 5000,
        }
      );

      const analytics = this.normalizeSystemAnalytics(response.data);
      if (!analytics) {
        this.logger.warn('getSystemAnalytics: backend returned empty body', response.data);
        return null;
      }

      return analytics;
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

  private normalizeSystemAnalytics(
    payload: SystemAnalytics | { data: SystemAnalytics } | null | undefined,
  ): SystemAnalytics | null {
    if (!payload) {
      return null;
    }

    if (typeof payload === 'object' && 'data' in payload) {
      return (payload as { data: SystemAnalytics }).data;
    }

    return payload as SystemAnalytics;
  }

  private readonly logger = {
    warn: (msg: string, data?: unknown) => console.warn(`[AdminService] ${msg}`, data),
    error: (msg: string, data?: unknown) => console.error(`[AdminService] ${msg}`, data),
  };
}

export const adminService = new AdminService();
