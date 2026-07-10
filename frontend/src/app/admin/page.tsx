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
      color: 'text-slate-500',
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
    <Card className="overflow-hidden border-none shadow-md bg-white dark:bg-slate-800/50 backdrop-blur-sm">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">{title}</p>
            <h3 className="text-3xl font-bold mt-1 text-slate-900 dark:text-white">
              {loading ? <Skeleton className="h-9 w-20" /> : (value === null || value === undefined ? '—' : value)}
            </h3>
            {subValue && (
              <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
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
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Admin Control Center</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Monitor and manage your medical education ecosystem.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={fetchStats} className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm">
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
                    className="bg-white dark:bg-slate-800 hover:bg-amber-100 dark:hover:bg-slate-700"
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
            trend="up"
            subValue={stats ? '+12% from last month' : undefined}
          />
          <StatCard 
            title="Active Learners" 
            value={stats?.activeLearners ?? stats?.activeUsers ?? null} 
            icon={UserCheck} 
            subValue="Active in last 30 days"
          />
          <StatCard 
            title="Total Courses" 
            value={stats?.totalCourses ?? null} 
            icon={BookOpen} 
            subValue={stats ? `${stats?.completedCourses ?? 0} completed` : undefined}
          />
          <StatCard 
            title="Learning Paths" 
            value={stats?.totalPaths ?? null} 
            icon={AlertCircle} 
            subValue={stats ? `${stats?.totalEnrollments ?? 0} total enrollments` : undefined}
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
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Management Hub</h2>
          <div className="h-1 flex-1 bg-slate-100 dark:bg-slate-800 rounded-full"></div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {adminActions.map((action) => (
            <Card 
              key={action.title} 
              className="group cursor-pointer hover:border-blue-500/50 transition-all duration-300 shadow-sm hover:shadow-xl bg-white dark:bg-slate-800/50 border-slate-100 dark:border-slate-700/50"
              onClick={() => router.push(action.href)}
            >
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className={`p-4 rounded-2xl ${action.bgColor} transition-transform group-hover:scale-110 duration-300`}>
                    <action.icon className={`h-6 w-6 ${action.color}`} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-lg text-slate-900 dark:text-white">{action.title}</h3>
                      <ArrowUpRight className="h-4 w-4 text-slate-300 group-hover:text-blue-500 transition-colors" />
                    </div>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                      {action.description}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
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
            <div className="h-50 flex items-center justify-center border border-white/10 rounded-lg bg-white/5 backdrop-blur-sm">
              <p className="text-blue-100/50 text-sm italic">Activity chart visualization would render here</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-md bg-white dark:bg-slate-800/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-blue-500" />
              System Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50">
              <span className="text-sm font-medium">Database (PostgreSQL)</span>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
                <span className="text-xs text-green-500 font-bold uppercase">Online</span>
              </div>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50">
              <span className="text-sm font-medium">Storage (Cloudflare R2)</span>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
                <span className="text-xs text-green-500 font-bold uppercase">Online</span>
              </div>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50">
              <span className="text-sm font-medium">Caching (Redis)</span>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
                <span className="text-xs text-green-500 font-bold uppercase">Online</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
