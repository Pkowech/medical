'use client';

export const dynamic = 'force-dynamic';

import React, { ReactNode, useEffect } from 'react';
import { DashboardLayout } from '@/core/app/components/layout/DashboardLayout';
import { LayoutProvider } from '@/core/providers/LayoutContext';
import { HeaderProvider } from '@/core/providers/HeaderContext';
import AppErrorBoundary from '@/features/security/components/AppErrorBoundary';
import { LoadingSpinner } from '@/shared/components/ui/loading-spinner';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useContextAwareNavigation } from '@/features/auth/hooks/useContextAwareNavigation';
import { getDeadlines } from '@/core/app/services/dashboardService';
import { Permission } from '@/lib/auth/roles';
import type { User } from '@/shared/types/authInterface';
import { handleUnknownError } from '@/app/services/error.service';


interface AppLayoutProps {
  children: ReactNode;
}

const AppLayoutContent: React.FC<AppLayoutProps> = ({ children }) => {
  const { session, isLoading } = useAuth();
  const { contextAwareNavigation } = useContextAwareNavigation();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const user: User | null = session?.user
    ? ({
        // Ensure permissions are normalized to the canonical Permission[] type
        ...session.user,
        permissions: (session.user.permissions ?? []).map((p: unknown) => p as Permission),
      } as User)
    : null;

  // Fetch deadlines
  useEffect(() => {
    if (!session?.user) return;
    const fetchDeadlines = async () => {
      try {
        await getDeadlines(session.user!.id);
      } catch (err) {
        handleUnknownError(err, '/progress/dashboard/' + session.user!.id);
      }
    };
    fetchDeadlines();
  }, [session?.user]);

  if (!mounted || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <AppErrorBoundary>
      <DashboardLayout navigationItems={contextAwareNavigation} user={user}>
        {children}
      </DashboardLayout>
    </AppErrorBoundary>
  );
};

const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  return (
    <LayoutProvider>
      <HeaderProvider>
        <AppLayoutContent>{children}</AppLayoutContent>
      </HeaderProvider>
    </LayoutProvider>
  );
};

export default AppLayout;
