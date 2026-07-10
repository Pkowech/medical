import { apiService } from '@/features/auth/services/apiClient';
import { AuditLog } from '@/shared/types/systemInterface';
import { ApiResponse } from '@/shared/types/base-responseInterface';

interface AuditLogsResponse {
  data: AuditLog[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
  };
}

interface AuditLogFilter {
  userId?: string;
  action?: string;
  resource?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

class AuditLogService {
  private readonly baseUrl = '/admin/audit-logs';

  async getAuditLogs(filters?: AuditLogFilter): Promise<AuditLog[]> {
    const params = new URLSearchParams();
    if (filters) {
      if (filters.userId) params.append('userId', filters.userId);
      if (filters.action) params.append('action', filters.action);
      if (filters.resource) params.append('resource', filters.resource);
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      if (filters.page) params.append('page', filters.page.toString());
      if (filters.limit) params.append('limit', filters.limit.toString());
    }

    const url = params.toString() ? `${this.baseUrl}?${params.toString()}` : this.baseUrl;
    const response = await apiService.get<AuditLogsResponse>(url);
    return response.data.data;
  }

  async getAuditLog(id: string): Promise<AuditLog> {
    const response = await apiService.get<ApiResponse<AuditLog>>(`${this.baseUrl}/${id}`);
    return response.data.data;
  }

  async deleteAuditLogs(olderThanDays: number): Promise<{ deleted: number }> {
    const response = await apiService.post<ApiResponse<{ deleted: number }>>(
      `${this.baseUrl}/delete-old`,
      {
        olderThanDays,
      }
    );
    return response.data.data;
  }

  async exportAuditLogs(format: 'csv' | 'json', filters?: AuditLogFilter): Promise<Blob> {
    const params = new URLSearchParams();
    params.append('format', format);
    if (filters) {
      if (filters.userId) params.append('userId', filters.userId);
      if (filters.action) params.append('action', filters.action);
      if (filters.resource) params.append('resource', filters.resource);
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
    }

    // When requesting a blob response we bypass the ApiResponse wrapper and request a raw blob.
    // apiService is typed for JSON ApiResponse<T>, so we use type assertion to handle binary response.
    const response = await apiService.get(`${this.baseUrl}/export?${params.toString()}`, {
      // axios expects responseType to be set to 'blob' for binary responses.
      responseType: 'blob',
    } as Record<string, unknown>);
    // The underlying axios call will return a Blob for response.data; cast to Blob for the service API.
    return response.data as unknown as Blob;
  }
}

export const auditLogService = new AuditLogService();
