import { apiService } from '@/features/auth/services/apiClient';
import { GetAuditLogsResponse } from '@/shared/types/systemInterface';

interface BackendAuditLog {
  id: string;
  timestamp: string;
  userId?: string;
  action: string;
  resource: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  status?: string;
}

const getAuditLogs = async (
  page: number = 1,
  limit: number = 20
): Promise<GetAuditLogsResponse> => {
  const response = await apiService.get<BackendAuditLog[]>('/auth/audit', {
    params: { page, limit },
  });
  const logs = Array.isArray(response.data) ? response.data : [];
  return logs.map(log => {
    const email =
      typeof log.details?.userEmail === 'string' ? log.details.userEmail : undefined;
    return {
      id: log.id,
      userId: log.userId ?? '',
      user: {
        id: log.userId ?? '',
        name: email ?? 'System / Deleted User',
        email: email ?? '',
      },
      action: log.action,
      entity: log.resource,
      entityId:
        typeof log.details?.entityId === 'string'
          ? log.details.entityId
          : typeof log.details?.originalUserId === 'string'
            ? log.details.originalUserId
            : '',
      timestamp: log.timestamp,
      details: log.details ?? {},
    };
  });
};

export const securityAuditService = { getAuditLogs };
