'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Role } from '@/shared/enums/role.enum';
import { LoadingSpinner } from '@/shared/components/ui/loading-spinner';
import { InstructorCourseManager } from '@/features/courses/components/InstructorCourseManager';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { usePermissions } from '@/features/auth/hooks/usePermissions';

export default function InstructorDashboardPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAuth();
  const { allRoles } = usePermissions();
  const canManageCourses = allRoles.includes(Role.instructor) || allRoles.includes(Role.admin);

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.replace('/login');
    } else if (!canManageCourses) {
      router.replace('/unauthorized');
    }
  }, [canManageCourses, isAuthenticated, isLoading, router]);

  if (isLoading || !isAuthenticated || !canManageCourses || !user?.id) {
    return <LoadingSpinner fullScreen />;
  }

  return <InstructorCourseManager instructorId={user.id} />;
}