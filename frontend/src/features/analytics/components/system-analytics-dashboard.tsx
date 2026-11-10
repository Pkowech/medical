'use client';

import { useQuery } from '@tanstack/react-query';
import { Activity, BookOpen, Brain, ClipboardList, Route, Target, Users } from 'lucide-react';
import { adminService } from '@/features/admin/services/adminService';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import Link from 'next/link';
import type { SystemAnalytics } from '@/shared/types/analyticsInterface';

export default function SystemAnalyticsDashboard() {
  const {
    data: systemAnalytics,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useQuery<SystemAnalytics | null>({
    queryKey: ['systemAnalytics'],
    queryFn: () => adminService.getSystemAnalytics(),
    throwOnError: false,
  });

  if (isLoading) {
    return <p className="p-6 text-sm text-muted-foreground">Loading system analytics...</p>;
  }

  if (error || !systemAnalytics) {
    return (
      <Card className="border-destructive/30 bg-destructive/5">
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle className="text-destructive">System analytics unavailable</CardTitle>
          <Button variant="outline" size="sm" onClick={() => void refetch()} disabled={isFetching}>
            Retry
          </Button>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {error instanceof Error
              ? error.message
              : 'Metrics could not be loaded from the available reporting services.'}
          </p>
        </CardContent>
      </Card>
    );
  }

  const metrics = [
    { title: 'Total Users', value: systemAnalytics.totalUsers, icon: Users, href: '/admin/users', detail: 'Registered accounts' },
    { title: 'Active Learners', value: systemAnalytics.activeLearners, icon: Activity, href: '/admin/users', detail: 'Active learner count reported by analytics' },
    { title: 'Total Courses', value: systemAnalytics.totalCourses, icon: BookOpen, href: '/admin/content', detail: 'Course records' },
    { title: 'Learning Paths', value: systemAnalytics.totalPaths, icon: Route, href: '/admin/content', detail: systemAnalytics.totalEnrollments === undefined ? 'Path enrollment total not reported' : `${systemAnalytics.totalEnrollments.toLocaleString()} enrollments` },
    { title: 'Assessments', value: systemAnalytics.totalAssessments, icon: Brain, href: '/admin/assessment/quizzes', detail: 'Quiz records' },
    { title: 'Quiz Attempts', value: systemAnalytics.totalAttempts, icon: ClipboardList, href: '/admin/analytics', detail: 'All recorded attempts' },
  ];

  return (
    <div className="space-y-6" aria-busy={isFetching}>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {metrics.map(({ title, value, icon: Icon, href, detail }) => (
          <Link
            href={href}
            key={title}
            aria-label={`${title}: ${value === undefined ? 'not reported' : value}`}
            className="group rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <Card className="h-full transition-colors group-hover:border-primary/40">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
                <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold tabular-nums">
                  {value === undefined ? 'Not reported' : value.toLocaleString()}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {value === undefined ? `${title} data is not available from reporting.` : detail}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Quiz Attempt Completion</CardTitle>
            <Target className="h-4 w-4 text-primary" aria-hidden="true" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">
              {typeof systemAnalytics.averageCompletionRate === 'number'
                ? `${systemAnalytics.averageCompletionRate.toFixed(1)}%`
                : 'Not reported'}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {systemAnalytics.averageCompletionRate === undefined
                ? 'Completion rate is not available from reporting.'
                : 'Completed attempts / all attempts'}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}