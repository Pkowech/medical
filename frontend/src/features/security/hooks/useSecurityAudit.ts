'use client';

import { useQuery } from '@tanstack/react-query';
import { securityAuditService } from '../services/securityAuditService';

export const useSecurityAudit = (page: number = 1, limit: number = 20) => {
  return useQuery({
    queryKey: ['auditLogs', page, limit],
    queryFn: () => securityAuditService.getAuditLogs(page, limit),
    placeholderData: previousData => previousData,
    retry: false,
  });
};
