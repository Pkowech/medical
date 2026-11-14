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
import { BookOpen, CheckCircle2, ChevronRight, ClipboardList, FileText, Layers3 } from 'lucide-react';
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
    <div className="space-y-6">
      <section aria-labelledby="instructor-tools" className="space-y-3">
        <div>
          <h2 id="instructor-tools" className="text-lg font-semibold text-foreground">Teaching tools</h2>
          <p className="text-sm text-muted-foreground">Create assessments and organize your teaching resources.</p>
        </div>
        <nav aria-label="Instructor tools" className="grid gap-3 sm:grid-cols-2">
          {[
            {
              href: '/instructor/quiz-authoring',
              label: 'Quiz authoring',
              description: 'Create and review assessments for your learners.',
              action: 'Open quiz authoring',
              icon: ClipboardList,
            },
            {
              href: '/instructor/materials',
              label: 'Teaching materials',
              description: 'Upload and manage course resources.',
              action: 'Browse materials',
              icon: FileText,
            },
          ].map(({ href, label, description, action, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="group flex min-h-36 flex-col rounded-xl border border-border bg-card/80 p-4 shadow-sm transition-colors hover:border-blue-300 hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:bg-card/70 dark:hover:border-blue-800 dark:hover:bg-card"
            >
              <span className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-300">
                <Icon aria-hidden="true" className="h-5 w-5" />
              </span>
              <span className="font-semibold text-foreground">{label}</span>
              <span className="mt-1 flex-1 text-sm text-muted-foreground">{description}</span>
              <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-blue-700 dark:text-blue-300">
                {action}
                <ChevronRight aria-hidden="true" className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          ))}
        </nav>
      </section>

      <section aria-labelledby="instructor-overview" className="space-y-3">
        <div>
          <h2 id="instructor-overview" className="text-lg font-semibold text-foreground">Teaching overview</h2>
          <p className="text-sm text-muted-foreground">A quick look at your courses, resources, and review queue.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {overviewCards.map(({ title, value, description, icon: Icon, tone, href }) => (
            <Link key={title} href={href} className="block">
              <Card className="h-full border-border bg-card/80 shadow-sm backdrop-blur-sm transition-colors hover:border-primary/40 dark:border-border/50 dark:bg-card/50">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
                    <div className={`rounded-lg bg-blue-50 p-2 ${tone} dark:bg-blue-950/50`}>
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
      </section>

      <InstructorCourseManager instructorId={user.id} />
    </div>
  );
}