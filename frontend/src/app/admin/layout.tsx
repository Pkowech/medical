'use client';

import React, { ReactNode, useEffect } from 'react';
import { Role } from '@/shared/enums/role.enum';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/hooks/useAuth';
import AppErrorBoundary from '@/features/security/components/AppErrorBoundary';
import { LoadingSpinner } from '@/shared/components/ui/loading-spinner';
import { LayoutProvider } from '@/core/providers/LayoutContext';
import { useLayoutStore } from '@/core/stores/useLayoutStore';
import { usePathname } from 'next/navigation';
import adminNavigationConfig, {
  instructorAssessmentNavigationConfig,
} from '@/core/app/components/layout/adminNavigationConfig';
import { DashboardLayout } from '@/core/app/components/layout/DashboardLayout';

interface AdminLayoutProps {
  children: ReactNode;
}

const AdminLayoutContent: React.FC<AdminLayoutProps> = ({ children }) => {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { setSidebarOpen } = useLayoutStore();
  const pathname = usePathname();

  const isAdmin =
    user?.role === Role.admin || (user?.roles?.includes(Role.admin) ?? false);
  const isInstructor =
    user?.role === Role.instructor ||
    (user?.roles?.includes(Role.instructor) ?? false);
  const canAccessAuthoring =
    isInstructor && pathname.startsWith('/admin/assessment/quizzes');
  const canAccessAdminArea = isAdmin || canAccessAuthoring;

  // Check authentication and admin status
  useEffect(() => {
    // Only redirect after auth loading is complete
    if (!authLoading) {
      if (!isAuthenticated) {
        router.replace('/login');
      } else if (!canAccessAdminArea) {
        router.replace('/dashboard');
      }
    }
  }, [authLoading, isAuthenticated, canAccessAdminArea, router]);

  // Close mobile sidebar when the route/pathname changes
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

  if (!isAuthenticated || !canAccessAdminArea) {
    return null;
  }

  return (
    <AppErrorBoundary>
      <DashboardLayout
        navigationItems={
          isAdmin
            ? adminNavigationConfig
            : instructorAssessmentNavigationConfig
        }
        user={user ?? null}
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
      <AdminLayoutContent>{children}</AdminLayoutContent>
    </LayoutProvider>
  );
};

export default AdminLayout;
