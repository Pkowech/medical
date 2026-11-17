'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/shared/components/ui/button';
import { LoadingSpinner } from '@/shared/components/ui/loading-spinner';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { usePermissions } from '@/features/auth/hooks/usePermissions';
import { usePageHeader } from '@/core/providers/HeaderContext';
import { InstructorCourseManager } from '@/features/courses/components/InstructorCourseManager';
import { Role } from '@/shared/enums/role.enum';

export default function InstructorContentPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAuth();
  const { allRoles } = usePermissions();
  const { setHeader } = usePageHeader();
  const canManageContent = allRoles.includes(Role.instructor) || allRoles.includes(Role.admin);

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) router.replace('/login');
    else if (!canManageContent) router.replace('/unauthorized');
  }, [canManageContent, isAuthenticated, isLoading, router]);

  useEffect(() => {
    setHeader({
      title: 'Course and topic authoring',
      description: 'Manage your courses, units, topics, and topic-level learning content.',
      actions: (
        <div className="flex gap-2">
          <Button asChild size="sm">
            <Link href="/instructor/content/create">Create course content</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href="/instructor/materials">Materials library</Link>
          </Button>
        </div>
      ),
    });
    return () => setHeader(null);
  }, [setHeader]);

  if (isLoading || !isAuthenticated || !canManageContent || !user?.id) {
    return <LoadingSpinner fullScreen />;
  }

  return <InstructorCourseManager instructorId={user.id} />;
}
