import { apiService } from '@/features/auth/services/apiClient';
import { GetAuditLogsResponse } from '@/shared/types/systemInterface';

const getAuditLogs = async (
  page: number = 1,
  limit: number = 20
): Promise<GetAuditLogsResponse> => {
  const response = await apiService.get<GetAuditLogsResponse>('/auth/audit', {
    params: { page, limit },
  });
  return response.data;
};

export const securityAuditService = { getAuditLogs };
