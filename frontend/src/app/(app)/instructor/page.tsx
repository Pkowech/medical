'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Role } from '@/shared/enums/role.enum';
import { LoadingSpinner } from '@/shared/components/ui/loading-spinner';
import { InstructorCourseManager } from '@/features/courses/components/InstructorCourseManager';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { usePermissions } from '@/features/auth/hooks/usePermissions';
import { courseService } from '@/features/courses/services/courseService';
import { materialService } from '@/features/courses/services/materialService';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { BookOpen, CheckCircle2, ClipboardList, FileText, Layers3, PlusCircle, Upload } from 'lucide-react';
import Link from 'next/link';

export default function InstructorDashboardPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAuth();
  const { allRoles } = usePermissions();
  const canManageCourses = allRoles.includes(Role.instructor) || allRoles.includes(Role.admin);
  const [courseStats, setCourseStats] = useState({ total: 0, published: 0, draft: 0 });
  const [materialStats, setMaterialStats] = useState({ total: 0, reviewed: 0, pending: 0 });
  const [loadingOverview, setLoadingOverview] = useState(true);

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.replace('/login');
    } else if (!canManageCourses) {
      router.replace('/unauthorized');
    }
  }, [canManageCourses, isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (!user?.id || !canManageCourses) return;

    let cancelled = false;

    const loadOverview = async () => {
      try {
        setLoadingOverview(true);
        const courses = await courseService.getCourses({ page: 1, limit: 50, instructorId: user.id });
        const materials = await materialService.getMaterialsPaginated({
          page: 1,
          limit: 50,
          scope: 'all',
        });

        if (cancelled) return;

        const published = courses.items.filter(course => course.status === 'published').length;
        const draft = courses.items.filter(course => course.status !== 'published').length;
        const reviewed = materials.items.filter(material => material.courseId || material.userId).length;
        const pending = Math.max(0, materials.items.length - reviewed);

        setCourseStats({
          total: courses.total ?? courses.items.length,
          published,
          draft,
        });
        setMaterialStats({
          total: materials.total ?? materials.items.length,
          reviewed,
          pending,
        });
      } catch (error) {
        console.error('Failed to load instructor overview data', error);
      } finally {
        if (!cancelled) setLoadingOverview(false);
      }
    };

    void loadOverview();

    return () => {
      cancelled = true;
    };
  }, [canManageCourses, user?.id]);

  const overviewCards = useMemo(() => [
    {
      title: 'Courses',
      value: loadingOverview ? '—' : String(courseStats.total),
      description: 'Active course catalog',
      icon: BookOpen,
      tone: 'text-blue-600',
      href: '/instructor/content',
    },
    {
      title: 'Published',
      value: loadingOverview ? '—' : String(courseStats.published),
      description: 'Ready for learners',
      icon: CheckCircle2,
      tone: 'text-emerald-600',
      href: '/instructor/content',
    },
    {
      title: 'Question bank',
      value: loadingOverview ? '—' : 'Live',
      description: 'Author and review assessments',
      icon: ClipboardList,
      tone: 'text-indigo-600',
      href: '/instructor/quiz-authoring',
    },
    {
      title: 'Resources',
      value: loadingOverview ? '—' : String(materialStats.total),
      description: 'Uploaded and linked materials',
      icon: FileText,
      tone: 'text-violet-600',
      href: '/instructor/materials',
    },
    {
      title: 'Pending review',
      value: loadingOverview ? '—' : String(Math.max(0, materialStats.pending)),
      description: 'Awaiting moderation',
      icon: Layers3,
      tone: 'text-amber-600',
      href: '/moderator',
    },
  ], [courseStats, loadingOverview, materialStats]);

  if (isLoading || !isAuthenticated || !canManageCourses || !user?.id) {
    return <LoadingSpinner fullScreen />;
  }

  return (
    <div className="space-y-6 p-1">
      <div className="flex flex-col gap-4 rounded-xl border border-border bg-muted/30 p-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-medium text-primary">Instructor dashboard</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Content and curriculum governance</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/instructor/materials">
              <Upload className="mr-2 h-4 w-4" /> Upload material
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/instructor/quiz-authoring">
              <ClipboardList className="mr-2 h-4 w-4" /> Quiz authoring
            </Link>
          </Button>
          <Button asChild>
            <Link href="/instructor/content">
              <PlusCircle className="mr-2 h-4 w-4" /> Manage content
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {overviewCards.map(({ title, value, description, icon: Icon, tone, href }) => (
          <Link key={title} href={href} className="block">
            <Card className="h-full transition-colors hover:border-primary/40">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
                  <div className={`rounded-lg bg-muted p-2 ${tone}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold tracking-tight">{value}</div>
                <p className="mt-2 text-xs text-muted-foreground">{description}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <InstructorCourseManager instructorId={user.id} />
    </div>
  );
}