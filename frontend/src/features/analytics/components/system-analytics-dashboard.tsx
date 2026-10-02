'use client';

import { useQuery } from '@tanstack/react-query';
import { BookOpen, Brain, Target, Users } from 'lucide-react';
import { adminService } from '@/features/admin/services/adminService';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import type { SystemAnalytics } from '@/shared/types/analyticsInterface';

export default function SystemAnalyticsDashboard() {
  const {
    data: systemAnalytics,
    isLoading,
    error,
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
      <Card className="border-red-200 bg-red-50">
        <CardHeader>
          <CardTitle className="text-red-700">Failed to Load System Analytics</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-red-600">
            {error instanceof Error
              ? error.message
              : 'System analytics are currently unavailable.'}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{systemAnalytics?.totalUsers || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Courses</CardTitle>
            <BookOpen className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{systemAnalytics?.totalCourses || 0}</div>
            <p className="text-xs text-muted-foreground">All course records</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Quizzes</CardTitle>
            <Brain className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{systemAnalytics?.totalAssessments || 0}</div>
            <p className="text-xs text-muted-foreground">All quiz records</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Quiz Attempt Completion</CardTitle>
            <Target className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {systemAnalytics?.averageCompletionRate?.toFixed(1) || 0}%
            </div>
            <p className="text-xs text-muted-foreground">Completed attempts / all attempts</p>
          </CardContent>
        </Card>
      </div>

    </div>
  );
}