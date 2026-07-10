'use client';

import React from 'react';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/shared/components/ui/table';
import { AuditLog } from '@/shared/types/systemInterface';

interface AuditLogTableProps {
  logs: AuditLog[];
}

const AuditLogTable: React.FC<AuditLogTableProps> = ({ logs }) => {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Actor</TableHead>
          <TableHead>Action</TableHead>
          <TableHead>Entity</TableHead>
          <TableHead>Entity ID</TableHead>
          <TableHead>Timestamp</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {logs.map(log => (
          <TableRow key={log.id}>
            <TableCell>{log.user?.name || 'System / Deleted User'}</TableCell>
            <TableCell>{log.action}</TableCell>
            <TableCell>{log.entity}</TableCell>
            <TableCell>{log.entityId}</TableCell>
            <TableCell>{new Date(log.timestamp).toLocaleString()}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};

export default AuditLogTable;
