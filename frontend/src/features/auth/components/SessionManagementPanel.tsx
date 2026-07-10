'use client';

import React from 'react';
import { useSessionManagement } from '../hooks/useSessionManagement';
import { UserSessionData } from '@/shared/types/authInterface';
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
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { Loader2, AlertTriangle } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/shared/components/ui/alert';

export const SessionManagementPanel: React.FC = () => {
  const { sessions, isLoading, error, terminateSession } = useSessionManagement();

  const handleTerminate = (sessionId: string) => {
    if (window.confirm('Are you sure you want to terminate this session?')) {
      terminateSession(sessionId);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Active Sessions</CardTitle>
        <CardDescription>Manage devices logged into your account.</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading && <Loader2 className="mx-auto my-8 h-8 w-8 animate-spin" />}
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>Failed to load sessions.</AlertDescription>
          </Alert>
        )}
        {sessions && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Device</TableHead>
                <TableHead>IP Address</TableHead>
                <TableHead>Last Accessed</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions.map((session: UserSessionData) => (
                <TableRow key={session.id}>
                  <TableCell>
                    {session.userAgent} {session.isCurrent && <Badge>This device</Badge>}
                  </TableCell>
                  <TableCell>{session.ipAddress}</TableCell>
                  <TableCell>{new Date(session.lastAccessed).toLocaleString()}</TableCell>
                  <TableCell className="text-right">
                    {!session.isCurrent && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleTerminate(session.id)}
                      >
                        Terminate
                      </Button>
                    )}
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
