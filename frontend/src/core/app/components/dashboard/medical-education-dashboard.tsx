'use client';

import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Clock,
  TrendingUp,
  BarChart3,
  Target,
  ChevronRight,
  ArrowRight,
  XCircle,
  Calendar,
  BookMarked,
  ClipboardList,
  AlertCircle,
  PlayCircle,
  X,
  GraduationCap,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { usePageHeader } from '@/core/providers/HeaderContext';
import { useAuthStore } from '@/features/auth/store/useAuthStore';
import type { Deadline } from '@/shared/types';
import { StatCard } from '@/shared/components/ui/StatCard';
import { StudySession } from '@/features/learning-management/study/components/study-session';
import { useStudy } from '@/features/learning-management/study/hooks/useStudy';
import { useProgress } from '@/shared/hooks/useProgress';
import { GoalsProgressWidget } from '@/features/learning-management/components/goals/goals-progress-widget';
import apiService from '@/features/auth/services/apiClient';
import type { PerformanceData } from '@/shared/types/analyticsInterface';

const MedicalEducationDashboard = () => {
  const { user } = useAuthStore();
  const { setHeader } = usePageHeader();
  const router = useRouter();
  const { getResumePoint } = useStudy();
  const [showStudySession, setShowStudySession] = useState(false);
  const [studySessionStarted, setStudySessionStarted] = useState(false);
  const [selectedStudyCourseId, setSelectedStudyCourseId] = useState<string | null>(null);
  const [selectedTrendMetric, setSelectedTrendMetric] = useState<'score' | 'hours'>('score');

  // Set page header for dashboard
  useEffect(() => {
    setHeader({
      title: `Welcome back, ${user?.firstName || 'User'}!`,
      description: 'Your Daily Briefing',
    });

    return () => {
      // Clear header when component unmounts
      setHeader(null);
    };
  }, [setHeader, user?.firstName]);

  // TanStack Query integration for fetching progress data
  const { 
    progressData: rawData, 
    isLoading, 
    error, 
    refetch,
  } = useProgress();
  const {
    data: performanceSummary,
    isLoading: isPerformanceSummaryLoading,
    error: performanceSummaryError,
  } = useQuery<PerformanceData>({
    queryKey: ['dashboardAssessmentSummary', user?.id],
    queryFn: async () => {
      const response = await apiService.get<PerformanceData>('/assessment-progress/summary');
      return response.data;
    },
    enabled: !!user?.id,
    staleTime: 60_000,
    gcTime: 10 * 60 * 1000,
    meta: { persist: Boolean(user?.id) },
    throwOnError: false,
  });

  // Use real data from backend
  const data = rawData || null;

  // Manual refetch handler for user-initiated refresh
  const handleRefetch = () => {
    refetch();
  };

  // Error state with retry capability
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-900 p-6 flex items-center justify-center">
        <div className="text-center max-w-md">
          <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Failed to load dashboard</h2>
          <p className="text-gray-600 dark:text-slate-400 mb-4">
            {error instanceof Error ? error.message : 'An unexpected error occurred'}
          </p>
          <button
            onClick={handleRefetch}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Retry Loading
          </button>
        </div>
      </div>
    );
  }

  // Loading state with better UX
  if (isLoading || !data) {
    return (
      <div className="min-h-screen bg-slate-50 p-4 dark:bg-slate-950 sm:p-6" aria-label="Loading student dashboard">
        <div className="mx-auto max-w-screen-2xl space-y-6">
          <div className="grid gap-4 lg:grid-cols-12">
            <div className="h-64 animate-pulse rounded-3xl bg-slate-200 dark:bg-slate-800 lg:col-span-8" />
            <div className="h-64 animate-pulse rounded-3xl bg-slate-200 dark:bg-slate-800 lg:col-span-4" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="h-28 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="h-20 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Narrow `data.stats` (which may be `unknown`) into a known shape for safe access
  type StatsShape = {
    overallProgress?: number;
    coursesCompleted?: number;
    totalCourses?: number;
    averageScore?: number;
    streak?: number;
    quizzesCompleted?: number;
    studyHours?: number;
    totalStudyTime?: number;
    studyHoursChange?: number;
    lastActivity?: string | null;
  };

  const stats: StatsShape = ((data.stats as StatsShape) || {
    overallProgress: 0,
    coursesCompleted: 0,
    totalCourses: 0,
    averageScore: 0,
    streak: 0,
    quizzesCompleted: 0,
    studyHours: 0,
    studyHoursChange: 0,
    lastActivity: null,
  });

  const assessmentScoresByMonth = (performanceSummary?.learningTrends || []).reduce<
    Record<string, { year: number; month: number; total: number; count: number }>
  >((monthlyScores, trend) => {
    const date = new Date(trend.date);
    if (!Number.isFinite(date.getTime()) || !Number.isFinite(trend.score)) return monthlyScores;
    const key = `${date.getFullYear()}-${date.getMonth()}`;
    const current = monthlyScores[key] || {
      year: date.getFullYear(),
      month: date.getMonth(),
      total: 0,
      count: 0,
    };
    monthlyScores[key] = { ...current, total: current.total + trend.score, count: current.count + 1 };
    return monthlyScores;
  }, {});
  const assessmentTrends = Object.values(assessmentScoresByMonth)
    .sort((left, right) => left.year - right.year || left.month - right.month)
    .slice(-6)
    .map(month => ({
      label: new Date(month.year, month.month, 1).toLocaleString('default', { month: 'short' }),
      value: Math.round(month.total / month.count),
    }));
  const trendPoints = selectedTrendMetric === 'score'
    ? assessmentTrends
    : (data.weeklyProgress || []).map(point => ({ label: point.day, value: point.hours }));
  const hasTrendData = selectedTrendMetric === 'score'
    ? trendPoints.length > 0
    : trendPoints.some(point => point.value > 0);
  const activeCourse = data.courseData?.find(course => course.progressPercentage < 100);
  const firstCourse = data.courseData?.[0];
  const displayCourse = activeCourse ?? firstCourse;
  const selectedStudyCourse = selectedStudyCourseId === null
    ? displayCourse
    : data.courseData?.find(course => course.id === selectedStudyCourseId);

  const handleContinueLearning = async () => {
    if (!displayCourse?.id) {
      router.push('/courses');
      return;
    }

    try {
      const resumePoint = await getResumePoint(displayCourse.id);
      if (resumePoint && 'id' in resumePoint && resumePoint.unitId) {
        router.push(`/courses/${displayCourse.id}/units/${resumePoint.unitId}/topics/${resumePoint.id}`);
        return;
      }
      if (resumePoint && 'unitId' in resumePoint && resumePoint.unitId) {
        router.push(`/courses/${displayCourse.id}/units/${resumePoint.unitId}`);
        return;
      }
    } catch (resumeError) {
      console.error('Failed to resume course from dashboard:', resumeError);
    }

    router.push(`/courses/${displayCourse.id}`);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-500/10';
      case 'medium':
        return 'border-yellow-200 dark:border-yellow-900/50 bg-yellow-50 dark:bg-yellow-500/10';
      default:
        return 'border-blue-200 dark:border-indigo-900/50 bg-blue-50 dark:bg-indigo-500/10';
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400';
      case 'medium':
        return 'bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-400';
      default:
        return 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-blue-400';
    }
  };

  // Format lastUpdated timestamp for display
  const formatLastUpdated = (timestamp?: number): string => {
    if (!timestamp) return 'Not synced';
    const now = Date.now();
    const diffMs = now - timestamp;
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  return (
    <div className="min-h-[calc(100dvh-4rem)] w-full min-w-0 bg-slate-50 dark:bg-slate-950 p-3 sm:p-4 md:p-6">
      <div className="mx-auto w-full max-w-screen-2xl min-w-0 space-y-4 sm:space-y-6">
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-12" aria-label="Study overview">
          <div className="relative isolate overflow-hidden rounded-3xl border border-slate-800 bg-slate-950 p-6 text-white shadow-sm sm:p-8 lg:col-span-8">
            <div className="pointer-events-none absolute -right-16 -top-24 -z-10 h-72 w-72 rounded-full bg-indigo-500/20 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-32 right-1/4 -z-10 h-64 w-64 rounded-full bg-cyan-400/10 blur-3xl" />
            <div className="flex h-full flex-col justify-between gap-8">
              <div>
                <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-slate-300">
                  <GraduationCap className="h-4 w-4 text-cyan-300" />
                  My learning
                </div>
                <h2 className="max-w-xl text-2xl font-semibold tracking-tight sm:text-3xl">
                  {activeCourse
                    ? 'Continue where you left off'
                    : firstCourse
                      ? 'Your courses are ready to review'
                      : 'Build your next study habit'}
                </h2>
                <p className="mt-2 max-w-xl text-sm leading-6 text-slate-300 sm:text-base">
                  {activeCourse
                    ? 'Pick up your course progress and keep moving through the next lesson.'
                    : firstCourse
                      ? 'Revisit a completed course or choose a new path to keep learning.'
                      : 'Explore your courses and choose a lesson to get started.'}
                </p>
              </div>

              <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    {activeCourse ? 'Up next in your learning' : firstCourse ? 'Ready to review' : 'Your course library'}
                  </p>
                  <p className="mt-1 truncate text-lg font-semibold text-white">
                    {displayCourse?.name || 'Browse available courses'}
                  </p>
                  {displayCourse && (
                    <div className="mt-4 flex items-center gap-3">
                      <div
                        className="h-2 w-48 max-w-[55vw] overflow-hidden rounded-full bg-white/15"
                        role="progressbar"
                        aria-label={`${displayCourse.name} progress`}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={Math.min(100, Math.max(0, displayCourse.progressPercentage))}
                      >
                        <div
                          className="h-full rounded-full bg-cyan-300 transition-[width]"
                          style={{ width: `${Math.min(100, Math.max(0, displayCourse.progressPercentage))}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium text-slate-300">
                        {Math.round(displayCourse.progressPercentage)}% complete
                      </span>
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleContinueLearning}
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950 transition-colors hover:bg-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                >
                  {activeCourse ? 'Continue learning' : firstCourse ? 'Review a course' : 'Explore courses'}
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-col justify-between gap-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:col-span-4">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-500 dark:text-slate-400">
                <Target className="h-4 w-4 text-indigo-500" />
                Your study rhythm
              </div>
              <div className="mt-5 grid grid-cols-2 divide-x divide-slate-200 dark:divide-slate-800">
                <div className="pr-4">
                  <p className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">
                    {stats.streak || 0}
                    <span className="ml-1 text-sm font-medium text-slate-500 dark:text-slate-400">days</span>
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Current streak</p>
                </div>
                <div className="pl-4">
                  <p className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">
                    {stats.studyHours || 0}
                    <span className="ml-1 text-sm font-medium text-slate-500 dark:text-slate-400">hrs</span>
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Study time</p>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setSelectedStudyCourseId(null);
                setStudySessionStarted(false);
                setShowStudySession(true);
              }}
              className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-left transition-colors hover:border-indigo-200 hover:bg-indigo-50 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-indigo-900 dark:hover:bg-indigo-950/30"
            >
              <span>
                <span className="block text-sm font-semibold text-slate-900 dark:text-white">Start a focus session</span>
                <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">Track time spent studying</span>
              </span>
              <Clock className="h-5 w-5 text-indigo-500" />
            </button>
          </div>
        </section>

        {/* Recent learning outcomes */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <StatCard
            icon={ClipboardList}
            title="Quizzes"
            value={isPerformanceSummaryLoading
              ? '…'
              : performanceSummaryError
                ? '—'
                : performanceSummary?.totalAttempts ?? 0}
            subtitle={performanceSummaryError ? 'Unavailable' : 'Completed'}
            colorClass="bg-slate-700"
            onClick={() => router.push('/quiz/history')}
          />
          <StatCard
            icon={Target}
            title="Avg Score"
            value={isPerformanceSummaryLoading
              ? 'Loading…'
              : performanceSummaryError
                ? 'Unavailable'
                : performanceSummary?.totalAttempts
                  ? `${performanceSummary.overallScore.toFixed(1)}%`
                  : '—'}
            subtitle={performanceSummaryError
              ? 'Unavailable'
              : performanceSummary?.totalAttempts
                ? `${performanceSummary.totalAttempts} assessments`
                : 'No scores yet'}
            colorClass="bg-emerald-500"
            onClick={() => router.push('/progress')}
          />
        </div>

        <section aria-label="Focused study activities">
          <div className="mb-3 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white">Choose a study activity</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Take a short, focused step that supports your learning.</p>
            </div>
            <button
              type="button"
              onClick={() => router.push('/study-planner')}
              className="hidden items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 sm:inline-flex"
            >
              Open study planner <ArrowRight className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => router.push('/quiz')}
              className="group flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-emerald-900"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
                <PlayCircle className="h-5 w-5" />
              </span>
              <span>
                <span className="block text-sm font-semibold text-slate-900 dark:text-white">Practice a quiz</span>
                <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">Strengthen recall and check understanding</span>
              </span>
              <ChevronRight className="ml-auto h-4 w-4 text-slate-400 transition group-hover:translate-x-0.5" />
            </button>
            <button
              type="button"
              onClick={() => router.push('/study-planner')}
              className="group flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-cyan-200 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-cyan-900"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cyan-50 text-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-400">
                <Calendar className="h-5 w-5" />
              </span>
              <span>
                <span className="block text-sm font-semibold text-slate-900 dark:text-white">Plan your next session</span>
                <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">Set a realistic study goal</span>
              </span>
              <ChevronRight className="ml-auto h-4 w-4 text-slate-400 transition group-hover:translate-x-0.5" />
            </button>
          </div>
        </section>

        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            {/* Daily Flashcards */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BookMarked className="h-5 w-5 text-indigo-500" />
                  <h3 className="font-semibold text-slate-900 dark:text-white">Daily flashcards</h3>
                </div>
                {(data.flashcards?.due || 0) > 0 && (
                  <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">
                    {data.flashcards?.due} due
                  </span>
                )}
              </div>
              <div className="grid grid-cols-3 divide-x divide-slate-200 rounded-xl bg-slate-50 py-4 text-center dark:divide-slate-800 dark:bg-slate-950">
                <div>
                  <p className="text-xl font-semibold text-slate-900 dark:text-white">{data.flashcards?.due || 0}</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Due today</p>
                </div>
                <div>
                  <p className="text-xl font-semibold text-slate-900 dark:text-white">{data.flashcards?.mastered || 0}</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Mastered</p>
                </div>
                <div>
                  <p className="text-xl font-semibold text-slate-900 dark:text-white">{data.flashcards?.learning || 0}</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">In progress</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => router.push('/flashcards')}
                className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
              >
                Start review <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="h-full">
            <GoalsProgressWidget />
          </div>
        </div>

        {/* Recommended Study Sessions - Improved empty state */}
        {(data.recommendedStudy?.length || 0) > 0 ? (
          <div className="bg-white/80 dark:bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-200 dark:border-slate-700/50">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Target className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Recommended For You</h3>
              </div>
              <span className="text-xs bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 px-3 py-1 rounded-full">Smart Analytics</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {data.recommendedStudy?.map((item: { id?: string; priority?: 'high' | 'medium' | 'low'; title?: string; reason?: string; estimatedTime?: string; specializationMatch?: boolean }) => (
                <div
                  key={item.id}
                  onClick={() => {
                    if (item.id) {
                      router.push(`/learning-paths/${item.id}`);
                    }
                  }}
                  className={`bg-gray-50 dark:bg-slate-700/50 rounded-xl p-4 border transition-all cursor-pointer group ${
                    item.specializationMatch 
                      ? 'border-amber-400 dark:border-amber-500/50 shadow-sm shadow-amber-500/10' 
                      : 'border-gray-200 dark:border-slate-600/50 hover:border-emerald-400 dark:hover:border-emerald-500/50'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex gap-2 flex-wrap">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          item.priority === 'high'
                            ? 'bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400'
                            : item.priority === 'medium'
                            ? 'bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-400'
                            : 'bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-400'
                        }`}
                      >
                        {item.priority === 'high' ? '🔴 Priority' : item.priority === 'medium' ? '🟡 Moderate' : '🟢 Recommended'}
                      </span>
                      {item.specializationMatch && (
                        <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 rounded text-[10px] font-bold border border-amber-200 dark:border-amber-500/30">
                          🎯 SPECIALIZATION MATCH
                        </span>
                      )}
                    </div>
                    <Clock className="w-4 h-4 text-gray-400 dark:text-slate-500" />
                  </div>
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-1 text-sm line-clamp-1">{item.title}</h4>
                  <p className="text-xs text-gray-600 dark:text-slate-400 mb-3 line-clamp-2">{item.reason}</p>
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-gray-500 dark:text-slate-500">{item.estimatedTime}</span>
                    <span className={`${item.priority === 'high' ? 'text-red-600 font-bold' : 'text-emerald-600'} dark:text-emerald-400 group-hover:translate-x-1 transition-transform`}>
                      {item.priority === 'high' ? 'Review Now →' : 'Start →'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-white/80 dark:bg-slate-800/50 backdrop-blur-sm rounded-2xl p-8 border border-gray-200 dark:border-slate-700/50 text-center">
            <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Target className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Start Your Learning Journey</h3>
            <p className="text-gray-600 dark:text-slate-400 mb-6 max-w-md mx-auto">
              Complete a few lessons and our Smart Analytics will recommend personalized study sessions just for you.
            </p>
            <button 
              onClick={() => router.push('/courses')}
              className="bg-linear-to-r from-emerald-500 to-teal-600 text-white font-semibold px-6 py-3 rounded-xl hover:opacity-90 transition-opacity"
            >
              Browse Courses →
            </button>
          </div>
        )}

        {/* Note: Stats are now in the hero section above */}

        {/* Performance Trends Over Time */}
        <div className="bg-white/80 dark:bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-200 dark:border-slate-700/50 shadow-sm relative overflow-hidden">
          {/* Subtle Background Grid Line */}
          <div className="absolute inset-x-0 top-32 border-t border-slate-100 dark:border-slate-700/30 z-0" />
          <div className="absolute inset-x-0 top-44 border-t border-slate-100 dark:border-slate-700/30 z-0" />
          <div className="absolute inset-x-0 top-56 border-t border-slate-100 dark:border-slate-700/30 z-0" />
          
          <div className="relative z-10 mb-6 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                Performance Trends
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Recorded assessment scores and study hours</p>
            </div>
            <div className="flex w-fit max-w-full bg-slate-100 dark:bg-slate-900/50 p-1 rounded-xl border border-slate-200 dark:border-slate-700/50">
              <button
                onClick={() => setSelectedTrendMetric('score')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 sm:px-4 ${selectedTrendMetric === 'score'
                  ? 'bg-white dark:bg-indigo-500 text-indigo-600 dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
              >
                Avg. Score
              </button>
              <button
                onClick={() => setSelectedTrendMetric('hours')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 sm:px-4 ${selectedTrendMetric === 'hours'
                  ? 'bg-white dark:bg-indigo-500 text-indigo-600 dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
              >
                Study Hours
              </button>
            </div>
          </div>
          
          {hasTrendData ? (
            <div className="flex items-end justify-between gap-2 md:gap-4 h-64 px-2 relative z-10">
              {trendPoints.map((point, index) => {
                const maxValue = Math.max(
                  selectedTrendMetric === 'score' ? 100 : 0,
                  ...trendPoints.map(trend => trend.value),
                  1,
                );
                const height = (point.value / maxValue) * 100;

                return (
                  <div key={`${point.label}-${index}`} className="flex-1 flex flex-col items-center gap-3 group h-full justify-end">
                    <div className="relative w-full h-48 flex items-end justify-center px-1 md:px-2">
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: `${height}%` }}
                        transition={{ type: 'spring', damping: 15, stiffness: 100 }}
                        className={`w-full max-w-10 rounded-t-lg transition-colors cursor-pointer relative ${
                          selectedTrendMetric === 'score'
                            ? 'bg-linear-to-t from-indigo-500 to-violet-400 hover:from-indigo-400 hover:to-violet-300'
                            : 'bg-linear-to-t from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300'
                        }`}
                      >
                        <div className="absolute -top-10 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all transform scale-90 group-hover:scale-100 bg-slate-900 dark:bg-slate-800 text-white px-2.5 py-1.5 rounded-lg text-[10px] font-bold whitespace-nowrap border border-slate-700 shadow-xl z-20">
                          {point.value}{selectedTrendMetric === 'score' ? '%' : 'h'}
                        </div>
                      </motion.div>
                    </div>
                    <span className="text-[10px] md:text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-tighter">{point.label}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="h-64 flex flex-col items-center justify-center gap-2 text-center text-slate-500 dark:text-slate-400">
              <BarChart3 className="h-8 w-8 text-slate-300 dark:text-slate-600" />
              <p className="text-sm font-medium">
                {selectedTrendMetric === 'score'
                  ? performanceSummaryError
                    ? 'Assessment trends are currently unavailable.'
                    : 'Assessment trends will appear after you complete a quiz.'
                  : 'Study-hour trends will appear after you log study time.'}
              </p>
            </div>
          )}
          
          <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-700/50 flex flex-wrap items-center justify-between gap-4 text-sm relative z-10">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${selectedTrendMetric === 'score' ? 'bg-indigo-500' : 'bg-emerald-500'}`}></div>
                <span className="text-slate-600 dark:text-slate-400 font-medium">
                  {selectedTrendMetric === 'score' ? 'Assessment Average' : 'Study Engagement'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Upcoming Deadlines */}
        <div className="bg-white/80 dark:bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-200 dark:border-slate-700/50">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-orange-500" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Upcoming Deadlines</h3>
            </div>
            <button
              onClick={() => router.push('/study-planner/schedule')}
              className="text-sm font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
            >
              <Calendar className="w-4 h-4" />
              View Calendar
            </button>
          </div>
          <div className="space-y-3">
            {data.upcomingDeadlines && data.upcomingDeadlines.length > 0 ? (
              data.upcomingDeadlines.map((deadline: Deadline) => (
                <div
                  key={deadline.id}
                  onClick={() => {
                    if (deadline.type === 'quiz') {
                      router.push(`/quiz/${deadline.id}`);
                    } else if (deadline.courseId) {
                      router.push(`/courses/${deadline.courseId}`);
                    } else if (deadline.type === 'goal') {
                      router.push('/learning-paths');
                    } else {
                      router.push('/study-planner/schedule');
                    }
                  }}
                  className={`p-4 rounded-xl border-2 ${getPriorityColor(deadline.priority)} hover:shadow-md transition-all cursor-pointer`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold text-gray-900 dark:text-white">{deadline.title}</h4>
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-bold ${getPriorityBadge(deadline.priority)}`}
                        >
                          {deadline.priority}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-slate-400">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {deadline.daysLeft} days left
                        </span>
                        <span className="capitalize">{deadline.type}</span>
                        <span className="text-gray-400">•</span>
                        <span>{deadline.course}</span>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">No upcoming deadlines</p>
                <p className="text-xs text-slate-500 max-w-[200px] mx-auto mt-1">You're all caught up! Enjoy your free time or start ahead.</p>
              </div>
            )}
          </div>
        </div>

        {/* Enrolled Units */}
        <div className="bg-white/80 dark:bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-200 dark:border-slate-700/50">
          <div className="mb-5 flex flex-col items-start gap-2 sm:mb-6 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Enrolled Units</h3>
            <button 
              onClick={() => router.push('/courses')}
              className="text-sm font-medium text-indigo-600 dark:text-blue-400 hover:text-indigo-700 dark:hover:text-blue-300"
            >
              Browse Catalog
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.courseData
              ?.filter((course: { progressPercentage?: number }) => (course.progressPercentage ?? 0) < 100)
              .map((course: { id?: string; unitId?: string; name?: string; progressPercentage?: number; color?: string; nextTopic?: string; timeLeft?: string; lastUpdated?: number }, index) => (
              <div
                key={`${course.id ?? 'course'}-${course.unitId ?? index}`}
                onClick={() => {
                  if (course.unitId && !course.unitId.startsWith('placeholder-')) {
                    router.push(`/courses/${course.id}/units/${course.unitId}`);
                  } else {
                    router.push(`/courses/${course.id}`);
                  }
                }}
                className="bg-gray-50/50 dark:bg-slate-700/50 rounded-xl p-5 border border-gray-200 dark:border-slate-600/50 hover:shadow-lg dark:hover:border-indigo-500/50 transition-all duration-300 group cursor-pointer"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h4 className="font-bold text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-blue-400 transition-colors">
                      {course.name}
                    </h4>
                    <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">Next: {course.nextTopic}</p>
                  </div>
                  <button
                    className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-indigo-500/30 transition-colors"
                    title="Play Course"
                    aria-label="Play Course"
                  >
                    <PlayCircle className="w-5 h-5" aria-hidden="true" />
                  </button>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-slate-400">Progress</span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {course.progressPercentage ?? 0}%
                    </span>
                  </div>
                    <div className="h-2 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full bg-linear-to-r ${course.color} rounded-full transition-all duration-1000 ease-out dynamic-width`}
                        style={{ '--width': `${course.progressPercentage ?? 0}%` } as React.CSSProperties}
                      />
                    </div>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-gray-500 dark:text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {course.timeLeft} left
                    </p>
                    {(course.progressPercentage ?? 0) >= 75 && (
                      <span className="text-xs bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full font-medium">
                        Almost done!
                      </span>
                    )}
                  </div>
                  {/* Last Synced Timestamp */}
                  <div className="mt-2 pt-2 border-t border-gray-200 dark:border-slate-700/50">
                    <p className="text-xs text-gray-400">Last synced: {formatLastUpdated(course.lastUpdated)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
      
      {showStudySession && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-gray-200 dark:border-slate-700">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Study Session</h3>
              {!studySessionStarted && (
                <button
                  onClick={() => setShowStudySession(false)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                  title="Close"
                  aria-label="Close study session setup"
                >
                  <X className="w-5 h-5 dark:text-slate-400" />
                </button>
              )}
            </div>
            <div className="mb-5">
              <label htmlFor="study-course-context" className="mb-2 block text-sm font-medium text-gray-700 dark:text-slate-300">
                Study context
              </label>
              <select
                id="study-course-context"
                value={selectedStudyCourse?.id ?? ''}
                onChange={event => setSelectedStudyCourseId(event.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              >
                <option value="">General study (not linked to a course)</option>
                {(data.courseData ?? []).map(course => (
                  <option key={course.id} value={course.id}>{course.name}</option>
                ))}
              </select>
              <p className="mt-2 text-xs text-gray-500 dark:text-slate-400">
                Linking a course session associates the time with its next incomplete topic.
              </p>
            </div>
            <StudySession
              context={selectedStudyCourse ? { type: 'course', id: selectedStudyCourse.id } : undefined}
              contextLabel={selectedStudyCourse?.name}
              onSessionStarted={() => setStudySessionStarted(true)}
              onSessionEnd={() => {
                setStudySessionStarted(false);
                setShowStudySession(false);
                handleRefetch();
              }} 
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default MedicalEducationDashboard;
