// frontend/src/app/(app)/admin/audit-logs/page.tsx

'use client';

import React, { useState, useEffect } from 'react';
import { usePermissions } from '@/features/auth/hooks/usePermissions';
import AuditLogTable from '@/features/security/components/AuditLogTable';
import { securityAuditService } from '@/features/security/services/securityAuditService';
import { AuditLog } from '@/shared/types/systemInterface';
import { ScrollText } from 'lucide-react';
import { Role } from '@/shared/enums/role.enum';
import { Button } from '@/shared/components/ui/button';

export default function AdminAuditLogsPage() {
  const { allRoles } = usePermissions();
  const isAdmin = allRoles?.includes(Role.admin);

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const pageSize = 20;

  useEffect(() => {
    let current = true;
    setLoading(true);
    setError(null);
    void securityAuditService
      .getAuditLogs(page, pageSize)
      .then(logs => {
        if (current) setAuditLogs(logs);
      })
      .catch((err: unknown) => {
        if (current) {
          setError(err instanceof Error ? err.message : 'Failed to fetch audit logs.');
        }
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [page, refreshVersion]);

  if (!isAdmin) {
    return (
      <div className="text-center py-8">
        <h2 className="text-2xl font-bold text-red-600 mb-2">Access Denied</h2>
        <p className="text-muted-foreground">You must be an administrator to access this page.</p>
      </div>
    );
  }

  if (loading) {
    return <div className="text-center py-8">Loading Audit Logs...</div>;
  }

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold flex items-center">
        <ScrollText className="mr-2" /> Audit Logs
      </h1>
      {error && (
        <div className="flex items-center justify-between gap-4 rounded-md border border-destructive/30 p-3 text-sm text-destructive" role="alert">
          <span>{error}</span>
          <Button variant="outline" size="sm" onClick={() => setRefreshVersion(value => value + 1)}>
            Retry
          </Button>
        </div>
      )}
      {loading ? (
        <p className="py-4 text-center" role="status">Loading audit logs...</p>
      ) : (
        <>
          <AuditLogTable logs={auditLogs} />
          <div className="flex items-center justify-end gap-3">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || loading}
              onClick={() => setPage(currentPage => currentPage - 1)}
            >
              Previous
            </Button>
            <span aria-live="polite">Page {page}</span>
            <Button
              variant="outline"
              size="sm"
              disabled={auditLogs.length < pageSize || loading}
              onClick={() => setPage(currentPage => currentPage + 1)}
            >
              Next
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
