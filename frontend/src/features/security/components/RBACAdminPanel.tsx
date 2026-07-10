'use client';

import React from 'react';
import { useRBAC } from '@/features/auth/hooks/useRBAC';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/shared/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table';
import { Badge } from '@/shared/components/ui/badge';
import { Loader2, AlertTriangle } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/shared/components/ui/alert';

export const RBACAdminPanel: React.FC = () => {
  const { data: roles, isLoading, error } = useRBAC();

  type PermissionItem = { id?: string; action?: string; subject?: string };
  type RoleItem = { id?: string; name?: string; permissions?: PermissionItem[] };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Roles and Permissions</CardTitle>
        <CardDescription>Manage user roles for the application.</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading && <Loader2 className="mx-auto my-8 h-8 w-8 animate-spin" />}
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>Failed to load roles.</AlertDescription>
          </Alert>
        )}
        {Array.isArray(roles) && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Role</TableHead>
                <TableHead>Permissions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {roles.map((role: RoleItem) => (
                <TableRow key={role?.id ?? Math.random()}>
                  <TableCell className="font-medium">{role?.name}</TableCell>
                  <TableCell className="flex flex-wrap gap-1">
                    {Array.isArray(role?.permissions) &&
                      role.permissions.map((p: PermissionItem) => (
                        <Badge key={p?.id ?? Math.random()} variant="outline">
                          {p?.action}: {p?.subject}
                        </Badge>
                      ))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};
