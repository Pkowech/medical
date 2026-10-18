'use client';

import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Settings, 
  BarChart3, 
  FileText, 
  Shield, 
  Clock, 
  AlertCircle,
  TrendingUp,
  UserCheck,
  BookOpen,
  ArrowUpRight,
  Plus,
  RefreshCcw
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { adminService } from '@/features/admin/services/adminService';
import { SystemAnalytics } from '@/shared/types/analyticsInterface';
import { Skeleton } from '@/shared/components/ui/skeleton';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function AdminDashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<SystemAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const data = await adminService.getSystemAnalytics();
      setStats(data);
    } catch (error) {
      console.error('Failed to fetch admin stats:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const adminActions = [
    {
      title: 'User Management',
      description: 'Manage user accounts, roles, and access levels.',
      icon: Users,
      href: '/admin/users',
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      title: 'Content Management',
      description: 'Create and organize courses, modules, and materials.',
      icon: FileText,
      href: '/admin/content',
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
    },
    {
      title: 'System Settings',
      description: 'Configure platform-wide settings and integrations.',
      icon: Settings,
      href: '/admin/settings',
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10',
    },
    {
      title: 'Analytics & Reports',
      description: 'Deep dive into system performance and user trends.',
      icon: BarChart3,
      href: '/admin/analytics',
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
    },
    {
      title: 'Roles & Permissions',
      description: 'Define fine-grained access control policies.',
      icon: Shield,
      href: '/admin/roles',
      color: 'text-red-500',
      bgColor: 'bg-red-500/10',
    },
    {
      title: 'Audit Logs',
      description: 'Monitor system changes and security events.',
      icon: Clock,
      href: '/admin/audit-logs',
      color: 'text-muted-foreground',
      bgColor: 'bg-slate-500/10',
    },
  ];

  interface StatCardProps {
    title: string;
    value: number | string | null | undefined;
    icon: React.ComponentType<{ className?: string }>;
    trend?: 'up' | 'down';
    subValue?: string | number;
  }

  const StatCard = ({ title, value, icon: Icon, trend, subValue }: StatCardProps) => (
    <Card className="overflow-hidden border-none shadow-md bg-card dark:bg-card/50 backdrop-blur-sm">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground dark:text-muted-foreground uppercase tracking-wider">{title}</p>
            <h3 className="text-3xl font-bold mt-1 text-foreground dark:text-foreground">
              {loading ? <Skeleton className="h-9 w-20" /> : (value === null || value === undefined ? '—' : value)}
            </h3>
            {subValue && (
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                {trend === 'up' ? <TrendingUp className="h-3 w-3 text-green-500" /> : null}
                {subValue}
              </p>
            )}
          </div>
          <div className="p-3 rounded-xl bg-blue-500/10">
            <Icon className="h-6 w-6 text-blue-500" />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="container mx-auto px-4 py-8 space-y-8 animate-in fade-in duration-700">
      {/* Header Section */}
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground dark:text-foreground tracking-tight">Admin Control Center</h1>
          <p className="text-muted-foreground dark:text-muted-foreground mt-1">Monitor and manage your medical education ecosystem.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={fetchStats} className="bg-card/50 dark:bg-card/50 backdrop-blur-sm">
            <RefreshCcw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh Data
          </Button>
          <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20" onClick={() => router.push('/admin/users')}>
            <Plus className="h-4 w-4 mr-2" />
            Add User
          </Button>
        </div>
      </div>

      {/* Analytics Service Unavailable Message */}
      {!loading && !stats && (
        <Card className="border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800/50">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-amber-900 dark:text-amber-200">System Analytics Unavailable</h3>
                <p className="text-sm text-amber-800 dark:text-amber-300 mt-1">
                  The analytics service is currently unavailable. This could be due to backend maintenance or connectivity issues. 
                  The management features below are still fully functional.
                </p>
                <div className="mt-3 flex gap-2">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={fetchStats}
                    className="bg-card dark:bg-card hover:bg-amber-100 dark:hover:bg-secondary"
                  >
                    <RefreshCcw className="h-3 w-3 mr-2" />
                    Try Again
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Grid */}
      {!loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard 
            title="Total Users" 
            value={stats?.totalUsers ?? null} 
            icon={Users} 
          />
          <StatCard 
            title="Active Learners" 
            value={stats?.activeLearners ?? stats?.activeUsers ?? null} 
            icon={UserCheck} 
            subValue={stats?.activeLearners !== undefined || stats?.activeUsers !== undefined ? 'Active in last 30 days' : undefined}
          />
          <StatCard 
            title="Total Courses" 
            value={stats?.totalCourses ?? null} 
            icon={BookOpen} 
            subValue={stats?.completedCourses !== undefined ? `${stats.completedCourses} completed` : undefined}
          />
          <StatCard 
            title="Learning Paths" 
            value={stats?.totalPaths ?? null} 
            icon={AlertCircle} 
            subValue={stats?.totalEnrollments !== undefined ? `${stats.totalEnrollments} total enrollments` : undefined}
          />
        </div>
      )}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <Skeleton className="h-32 rounded-lg" />
          <Skeleton className="h-32 rounded-lg" />
          <Skeleton className="h-32 rounded-lg" />
          <Skeleton className="h-32 rounded-lg" />
        </div>
      )}

      {/* Main Admin Actions */}
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-semibold text-foreground dark:text-foreground">Management Hub</h2>
          <div className="h-1 flex-1 bg-muted dark:bg-card rounded-full"></div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {adminActions.map((action) => (
            <Link
              key={action.title}
              href={action.href}
              className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            >
              <Card className="group cursor-pointer hover:border-blue-500/50 transition-all duration-300 shadow-sm hover:shadow-xl bg-card dark:bg-card/50 border-border dark:border-border/50">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className={`p-4 rounded-2xl ${action.bgColor} transition-transform group-hover:scale-110 duration-300`}>
                    <action.icon className={`h-6 w-6 ${action.color}`} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-lg text-foreground dark:text-foreground">{action.title}</h3>
                      <ArrowUpRight className="h-4 w-4 text-slate-300 group-hover:text-blue-500 transition-colors" />
                    </div>
                    <p className="text-sm text-muted-foreground dark:text-muted-foreground mt-1 leading-relaxed">
                      {action.description}
                    </p>
                  </div>
                </div>
              </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* Quick Status Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-4">
        <Card className="border-none shadow-md bg-linear-to-br from-blue-600 to-indigo-700 text-white">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Platform Growth
            </CardTitle>
            <CardDescription className="text-blue-100">User activity trends over the last 30 days.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-50 flex items-center justify-center border border-white/10 rounded-lg bg-card/5 backdrop-blur-sm">
              <p className="text-blue-100/80 text-sm text-center px-4">
                Activity trends are not available yet; live reporting is not configured.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-md bg-card dark:bg-card/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-blue-500" />
              System Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Live health checks are not configured. Service status cannot be confirmed here.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
