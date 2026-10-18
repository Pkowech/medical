'use client';

import { useSession } from 'next-auth/react';
import { Button } from '@/shared/components/ui/button';
import { Card } from '@/shared/components/ui/card';
import { useToast } from '@/shared/components/ui/use-toast';
import { useAuth } from '@/features/auth/hooks/useAuth';

export function SessionManager() {
  const { data: session, status } = useSession();
  const { toast } = useToast();
  const { logout } = useAuth();
  const loading = status === 'loading';

  const handleTerminateSession = async () => {
    try {
      await logout();
      toast({
        title: 'Signed Out',
        description: 'You have been successfully signed out.',
      });
    } catch {
      toast({
        variant: 'destructive',
        title: 'Sign Out Failed',
        description: 'An error occurred while signing out. Please try again.',
      });
    }
  };

  if (loading) {
    return <div className="flex justify-center py-8">Loading session...</div>;
  }

  if (!session) {
    return null;
  }

  const userName =
    session.user?.firstName || session.user?.lastName
      ? `${session.user.firstName || ''} ${session.user.lastName || ''}`.trim()
      : session.user?.username || 'Current Session';

  return (
    <div className="space-y-4">
      <Card className="p-6 bg-card/80 dark:bg-card/50 backdrop-blur-sm border-border dark:border-border/50">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-semibold text-foreground dark:text-foreground mb-1">{userName}</h3>
            <p className="text-sm text-muted-foreground dark:text-muted-foreground">
              <span className="font-medium text-muted-foreground uppercase text-[10px] tracking-wider mr-2">Email</span>
              {session.user?.email || 'Not available'}
            </p>
            <p className="text-sm text-muted-foreground dark:text-muted-foreground mt-1">
              <span className="font-medium text-muted-foreground uppercase text-[10px] tracking-wider mr-2">Expires</span>
              {new Date(session.expires).toLocaleString()}
            </p>
          </div>
          <Button variant="destructive" size="sm" onClick={handleTerminateSession} className="sm:self-center">
            Sign Out
          </Button>
        </div>
      </Card>
    </div>
  );
}
