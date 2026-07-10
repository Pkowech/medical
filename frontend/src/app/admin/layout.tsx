'use client';

import React, { ReactNode, useEffect } from 'react';
import { Role } from '@/shared/enums/role.enum';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/hooks/useAuth';
import AppErrorBoundary from '@/features/security/components/AppErrorBoundary';
import { LoadingSpinner } from '@/shared/components/ui/loading-spinner';
import { LayoutProvider } from '@/core/providers/LayoutContext';
import { HeaderProvider } from '@/core/providers/HeaderContext';
import { useLayoutStore } from '@/core/stores/useLayoutStore';
import { usePathname } from 'next/navigation';
import adminNavigationConfig from '@/core/app/components/layout/adminNavigationConfig';
import { DashboardLayout } from '@/core/app/components/layout/DashboardLayout';

interface AdminLayoutProps {
  children: ReactNode;
}

const AdminLayoutContent: React.FC<AdminLayoutProps> = ({ children }) => {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { setSidebarOpen } = useLayoutStore();

  // Check authentication and admin status
  useEffect(() => {
    // Only redirect after auth loading is complete
    if (!authLoading) {
      if (!isAuthenticated) {
        router.push('/login');
      } else if (user?.role !== Role.admin) {
        router.push('/dashboard');
      }
    }
  }, [authLoading, isAuthenticated, user?.role, router]);

  // Close mobile sidebar when the route/pathname changes
  const pathname = usePathname();
  useEffect(() => {
    // Close mobile sidebar when navigating — don't depend on `sidebarOpen`.
    setSidebarOpen(false);
  }, [pathname, setSidebarOpen]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!isAuthenticated || user?.role !== Role.admin) {
    return null;
  }

  return (
    <AppErrorBoundary>
      <DashboardLayout
        navigationItems={adminNavigationConfig}
        user={user}
        isLoading={authLoading}
      >
        {children}
      </DashboardLayout>
    </AppErrorBoundary>
  );
};

const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  return (
    <LayoutProvider>
      <HeaderProvider>
        <AdminLayoutContent>{children}</AdminLayoutContent>
      </HeaderProvider>
    </LayoutProvider>
  );
};

export default AdminLayout;
