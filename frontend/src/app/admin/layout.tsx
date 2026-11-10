'use client';

import React, { ReactNode, useEffect } from 'react';
import { getSafeRoles, Role } from '@/shared/enums/role.enum';
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
import { CourseStudySessionProvider } from '@/features/learning-management/study/components/CourseStudySessionProvider';

interface AdminLayoutProps {
  children: ReactNode;
}

const AdminLayoutContent: React.FC<AdminLayoutProps> = ({ children }) => {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { setSidebarOpen } = useLayoutStore();
  const pathname = usePathname();

  const userRoles = getSafeRoles(user?.roles ?? user?.role ?? [], [Role.guest]);
  const isAdmin = user?.role === Role.admin || userRoles.includes(Role.admin);
  const isInstructor =
    user?.role === Role.instructor || userRoles.includes(Role.instructor);
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
      <CourseStudySessionProvider>
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
      </CourseStudySessionProvider>
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
