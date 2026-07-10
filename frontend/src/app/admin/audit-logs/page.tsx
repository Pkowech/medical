// frontend/src/app/(app)/admin/audit-logs/page.tsx

'use client';

import React, { useState, useEffect } from 'react';
import { usePermissions } from '@/features/auth/hooks/usePermissions';
import AuditLogTable from '@/features/security/components/AuditLogTable';
import { securityAuditService } from '@/features/security/services/securityAuditService';
import { AuditLog } from '@/shared/types/systemInterface';
import { ScrollText } from 'lucide-react';
import { Role } from '@/shared/enums/role.enum';

export default function AdminAuditLogsPage() {
  const { allRoles } = usePermissions();
  const isAdmin = allRoles?.includes(Role.admin);

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAuditLogs = async () => {
    try {
      setLoading(true);
      const fetchedLogs = await securityAuditService.getAuditLogs();
      setAuditLogs(fetchedLogs);
    } catch (err) {
      setError('Failed to fetch audit logs.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditLogs();
  }, []);

  if (!isAdmin) {
    return (
      <div className="text-center py-8">
        <h2 className="text-2xl font-bold text-red-600 mb-2">Access Denied</h2>
        <p className="text-gray-600">You must be an administrator to access this page.</p>
      </div>
    );
  }

  if (loading) {
    return <div className="text-center py-8">Loading Audit Logs...</div>;
  }

  if (error) {
    return <div className="text-center py-8 text-red-500">Error: {error}</div>;
  }

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold flex items-center">
        <ScrollText className="mr-2" /> Audit Logs
      </h1>
      <AuditLogTable logs={auditLogs} />
    </div>
  );
}
