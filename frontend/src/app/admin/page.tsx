'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Activity, ArrowUpRight, BookOpen, ClipboardList, FileText, RefreshCcw, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { adminService } from '@/features/admin/services/adminService';
import { SystemAnalytics } from '@/shared/types/analyticsInterface';
import { AuditLog } from '@/shared/types/systemInterface';
import { securityAuditService } from '@/features/security/services/securityAuditService';
import { Skeleton } from '@/shared/components/ui/skeleton';
import Link from 'next/link';
import { usePageHeader } from '@/core/providers/HeaderContext';

export default function AdminDashboardPage() {
  const { setHeader } = usePageHeader();
  const [stats, setStats] = useState<SystemAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [recentActivity, setRecentActivity] = useState<AuditLog[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);
  const [activityError, setActivityError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setStatsError(null);
    try {
      const data = await adminService.getSystemAnalytics();
      setStats(data);
      if (!data) setStatsError('System metrics could not be loaded.');
    } catch (error) {
      console.error('Failed to fetch admin stats:', error);
      setStatsError('System metrics could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchStats();
  }, [fetchStats]);

  const fetchRecentActivity = useCallback(async () => {
    setActivityLoading(true);
    setActivityError(null);
    try {
      setRecentActivity(await securityAuditService.getAuditLogs(1, 5));
    } catch (error) {
      console.error('Failed to fetch recent admin activity:', error);
      setActivityError('Recent activity could not be loaded.');
    } finally {
      setActivityLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchRecentActivity();
  }, [fetchRecentActivity]);

  const handleRefresh = useCallback(() => {
    void fetchStats();
    void fetchRecentActivity();
  }, [fetchRecentActivity, fetchStats]);

  const lastUpdated = stats?.lastUpdated
    ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(
        new Date(stats.lastUpdated),
      )
    : 'Not updated yet';

  useEffect(() => {
    setHeader({
      title: 'Admin Dashboard',
      description: 'Monitor key platform metrics and recent administrative activity.',
      actions: (
        <div className="flex items-center gap-2">
          <span className="hidden text-xs text-muted-foreground xl:inline">
            Updated {lastUpdated}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={loading || activityLoading}
            aria-label="Refresh dashboard data"
          >
            <RefreshCcw className={`h-4 w-4 sm:mr-2 ${loading || activityLoading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          <Button asChild size="sm">
            <Link href="/admin/users" aria-label="Manage users">
              <Users className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Manage users</span>
            </Link>
          </Button>
        </div>
      ),
    });
    return () => setHeader(null);
  }, [activityLoading, handleRefresh, lastUpdated, loading, setHeader]);

  const statCards = [
    { title: 'Total users', value: stats?.totalUsers, description: 'Registered accounts', href: '/admin/users', icon: Users },
    {
      title: 'Active learners',
      value: stats?.activeLearners ?? stats?.activeUsers,
      description: 'Active learner count reported by analytics',
      unavailableDescription: 'Active learner totals are not available from reporting.',
      href: '/admin/analytics',
      icon: Activity,
    },
    { title: 'Courses', value: stats?.totalCourses, description: 'Courses in the platform', href: '/admin/content', icon: BookOpen },
    { title: 'Assessments', value: stats?.totalAssessments, description: 'Quiz records', unavailableDescription: 'Assessment totals are not available from reporting.', href: '/admin/assessment/quizzes', icon: FileText },
    { title: 'Quiz attempts', value: stats?.totalAttempts, description: 'All recorded attempts', unavailableDescription: 'Attempt totals are not available from reporting.', href: '/admin/analytics', icon: ClipboardList },
  ];
  const hasReportedMetrics = statCards.some(card => typeof card.value === 'number');
  const metricsUnavailable = !loading && !hasReportedMetrics;

  return (
    <div className="container mx-auto space-y-6 px-4 py-6">
      {(statsError || metricsUnavailable) && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm" role="alert">
          <span>{statsError ?? 'No platform metrics are currently reported.'} Other dashboard sections remain available.</span>
          <Button variant="outline" size="sm" onClick={() => void fetchStats()}>
            Retry metrics
          </Button>
        </div>
      )}

      <section aria-label="Platform metrics" aria-busy={loading}>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-5">
          {loading
            ? statCards.map(card => <Skeleton key={card.title} className="h-28 rounded-lg" />)
            : hasReportedMetrics
              ? statCards.map(({ title, value, description, unavailableDescription, href, icon: Icon }) => (
                <Link
                  key={title}
                  href={href}
                  aria-label={`${title}: ${value === undefined ? 'not reported' : value}`}
                  className="group rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <Card className="h-full transition-colors group-hover:border-primary/40">
                    <CardContent className="flex items-start justify-between gap-2 p-3 sm:p-4">
                      <div className="min-w-0">
                        <p className="truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground sm:text-xs">
                          {title}
                        </p>
                        <p className="mt-1 text-xl font-semibold tabular-nums sm:text-2xl">
                          {value === undefined ? (stats ? 'Not reported' : 'Unavailable') : value.toLocaleString()}
                        </p>
                        <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground sm:text-xs">
                          {value === undefined ? unavailableDescription ?? 'Metrics could not be loaded.' : description}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 text-primary">
                        <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                        <ArrowUpRight className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))
              : null}
        </div>
      </section>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
          <div>
            <CardTitle className="text-base">Recent activity</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">Latest administrative and security events.</p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/audit-logs">View all</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {activityLoading ? (
            <div className="space-y-3" role="status" aria-label="Loading recent activity">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : activityError ? (
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm" role="alert">
              <p className="text-muted-foreground">{activityError}</p>
              <Button variant="outline" size="sm" onClick={() => void fetchRecentActivity()}>
                Retry
              </Button>
            </div>
          ) : recentActivity.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">No administrative activity has been recorded yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {recentActivity.map(log => {
                const timestamp = new Date(log.timestamp);
                const validTimestamp = Number.isFinite(timestamp.getTime());
                return (
                  <li key={log.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{log.action} · {log.entity}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {log.user?.name || 'System'}{log.entityId ? ` · ${log.entityId}` : ''}
                      </p>
                    </div>
                    <time
                      className="shrink-0 text-xs text-muted-foreground"
                      dateTime={validTimestamp ? timestamp.toISOString() : undefined}
                    >
                      {validTimestamp
                        ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(timestamp)
                        : 'Time unavailable'}
                    </time>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Badge variant="outline" className="mt-0.5 shrink-0">Not monitored</Badge>
          <div>
            <p className="text-sm font-medium">Live system health checks are not configured.</p>
            <p className="text-xs text-muted-foreground">
              API, database, and storage health cannot be confirmed. Historical growth trends are also not included in the current report.
            </p>
          </div>
        </div>
        <Button asChild variant="link" size="sm" className="shrink-0 self-start sm:self-center">
          <Link href="/admin/analytics">View available metrics</Link>
        </Button>
      </div>
    </div>
  );
}
