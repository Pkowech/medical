'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  BookOpen,
  Clock,
  TrendingUp,
  BarChart3,
  Target,
  ChevronRight,
  Lightbulb,
  Brain,
  ArrowRight,
  XCircle,
  Users,
  Calendar,
  BookMarked,
  ClipboardList,
  Sparkles,
  AlertCircle,
  PlayCircle,
  X,
  GraduationCap,
  FileText,
  Star,
  ChevronLeft,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { usePageHeader } from '@/core/providers/HeaderContext';
import { useAuthStore } from '@/features/auth/store/useAuthStore';
import { Deadline, CourseDisplayDataExtended, StatCardProps } from '@/shared/types';
import { StatCard } from '@/shared/components/ui/StatCard';
import { Button } from '@/shared/components/ui/button';
import { StudySession } from '@/features/learning-management/study/components/study-session';
import { useStudy } from '@/features/learning-management/study/hooks/useStudy';
import { useProgress } from '@/shared/hooks/useProgress';
import { GoalsProgressWidget } from '@/features/learning-management/components/goals/goals-progress-widget';
import useSchedule from '@/features/learning-management/study/hooks/useSchedule';
import CalendarGrid from '@/features/learning-management/components/schedule/CalendarGrid';
import { Event } from '@/features/learning-management/study/services/scheduleService';

const MedicalEducationDashboard = () => {
  const { user } = useAuthStore();
  const { setHeader } = usePageHeader();
  const router = useRouter();
  const { getResumePoint } = useStudy();
  // REMOVED: counters, activeInsight state (NOISE REDUCTION)
  const [showQuickQuiz, setShowQuickQuiz] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showStudySession, setShowStudySession] = useState(false);
  const [selectedTrendMetric, setSelectedTrendMetric] = useState<'score' | 'hours'>('score');
  const [activeInsight, setActiveInsight] = useState(0);

  // Calendar Hook (reusing the one from Schedule)
  const {
    filteredEvents,
    isLoading: isCalendarLoading,
    currentDate,
    setCurrentDate,
    view: calendarView,
  } = useSchedule();

  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);

  const navigateDate = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1));
    setCurrentDate(newDate);
  };


  const insights = [
    { icon: Brain, text: "You're crushing it! Keep up the consistent study habits." },
    { icon: Lightbulb, text: "Focus on challenging topics to maximize your learning efficiency." },
    { icon: Sparkles, text: "Don't forget to review flashcards regularly for long-term retention." },
  ];


  useEffect(() => {
    const insightInterval = setInterval(() => {
      setActiveInsight(prev => (prev + 1) % insights.length);
    }, 5000);
    return () => clearInterval(insightInterval);
  }, []);

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
    streak: hookStreak 
  } = useProgress();

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
      <div className="min-h-screen bg-gray-50 dark:bg-slate-900 p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-slate-400 font-medium">Preparing your daily briefing...</p>
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

  // Use hook streak as priority
  if (typeof hookStreak === 'number' && hookStreak > 0) {
    stats.streak = hookStreak;
  }

  const counters = {
    courses: stats.coursesCompleted || 0,
    score: stats.averageScore ? Number(stats.averageScore.toFixed(1)) : 0,
    hours: stats.studyHours || (data as unknown as { studySessions?: Array<{ durationHours?: number }> }).studySessions
      ? Number(((data as unknown as { studySessions?: Array<{ durationHours?: number }> }).studySessions!.reduce((acc: number, session: { durationHours?: number }) => acc + (session.durationHours || 0), 0)).toFixed(1))
      : 0,
  };

  // Error state with retry capability
  if (error) {
    const errorMessage = (error as any) instanceof Error ? (error as any).message : 'An unexpected error occurred';
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-900 p-6 flex items-center justify-center">
        <div className="text-center max-w-md">
          <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Failed to load dashboard</h2>
          <p className="text-gray-600 dark:text-slate-400 mb-4">
            {errorMessage}
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
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-900 p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-slate-400 font-medium">Preparing your daily briefing...</p>
        </div>
      </div>
    );
  }

  // StatCard component reserved for future use - can be uncommented when needed
  // interface StatCardProps {
  //   icon: React.ElementType;
  //   title: string;
  //   value: string | number;
  //   subtitle: string;
  //   trend?: number;
  //   onClick?: () => void;
  // }

  const ProgressRing = ({ progress, size = 140 }: { progress: number; size?: number }) => {
    const radius = (size - 16) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (progress / 100) * circumference;

    return (
      <div className="relative">
        <svg className="transform -rotate-90" width={size} height={size}>
          <defs>
            <linearGradient id="progressGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#3b82f6" />
              <stop offset="100%" stopColor="#8b5cf6" />
            </linearGradient>
          </defs>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#e5e7eb"
            strokeWidth="10"
            fill="none"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="url(#progressGrad)"
            strokeWidth="10"
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={isNaN(offset) ? 0 : offset}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold text-gray-900 dark:text-white">{progress}%</span>
          <span className="text-xs text-gray-500 dark:text-slate-400">Complete</span>
        </div>
      </div>
    );
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

  // Quick Quiz Modal
  const QuickQuizModal = () => (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-gray-200 dark:border-slate-700">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Quick Quiz Launch</h3>
          <button
            onClick={() => setShowQuickQuiz(false)}
            className="p-2 hover:bg-gray-100 rounded-lg"
            title="Close"
            aria-label="Close Quick Quiz"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>
        <div className="space-y-4">
          {data.courseData?.slice(0, 3).map((course: CourseDisplayDataExtended) => (
            <button
              key={course.id}
              onClick={() => {
                setShowQuickQuiz(false);
                router.push(`/quiz/${course.id}`);
              }}
              className="w-full p-4 rounded-xl border-2 border-gray-100 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-500 hover:bg-blue-50 dark:hover:bg-indigo-500/10 transition-all text-left group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-12 h-12 rounded-lg bg-linear-to-br ${course.color} flex items-center justify-center`}
                  >
                    <BookOpen className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-white">{course.name}</h4>
                    <p className="text-sm text-gray-500 dark:text-slate-400">10 questions • 15 minutes</p>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all" />
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  // Calendar View Modal
  const CalendarModal = () => (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-5xl w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto border border-gray-200 dark:border-slate-700">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Study Calendar</h3>
              <p className="text-sm text-gray-500 dark:text-slate-400">
                Manage your academic schedule and deadlines
              </p>
            </div>
            
            <div className="flex items-center gap-2 bg-gray-100 dark:bg-slate-700/50 p-1 rounded-lg ml-4">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigateDate('prev')}>
                <ChevronLeft className="w-4 h-4 text-gray-600 dark:text-slate-400" />
              </Button>
              <span className="text-sm font-semibold min-w-[120px] text-center text-gray-900 dark:text-white">
                {currentDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
              </span>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigateDate('next')}>
                <ChevronRight className="w-4 h-4 text-gray-600 dark:text-slate-400" />
              </Button>
            </div>
          </div>
          
          <button
            onClick={() => setShowCalendar(false)}
            className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            title="Close"
            aria-label="Close Calendar"
          >
            <X className="w-5 h-5 dark:text-slate-400" aria-hidden="true" />
          </button>
        </div>

        {/* Reusing CalendarGrid from Schedule feature */}
        {isCalendarLoading ? (
          <div className="h-[400px] flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-gray-100 dark:border-slate-700">
            <CalendarGrid
              currentDate={currentDate}
              events={filteredEvents}
              onOpenAddForDay={(day) => {
                const year = currentDate.getFullYear();
                const month = currentDate.getMonth();
                const date = new Date(year, month, day);
                // For now, redirect to schedule for adding events to keep things simple
                router.push(`/study-planner/schedule?date=${date.toISOString()}`);
                setShowCalendar(false);
              }}
              onSelectEvent={(ev) => {
                setSelectedEvent(ev);
                // Optionally show details or just redirect
                router.push(`/study-planner/schedule?event=${ev.id}`);
                setShowCalendar(false);
              }}
            />
          </div>
        )}
        
        <div className="mt-6 flex justify-end">
          <Button 
            onClick={() => {
              router.push('/study-planner/schedule');
              setShowCalendar(false);
            }}
            variant="outline"
            className="gap-2"
          >
            <Calendar className="w-4 h-4" />
            Open Full Schedule
          </Button>
        </div>
      </div>
    </div>
  );

  // FeatureCard component reserved for future use - can be uncommented when needed
  // interface FeatureCardProps {
  //   icon: React.ElementType;
  //   title: string;
  //   subtitle: string;
  //   onClick: () => void;
  //   badge?: string;
  //   available?: boolean;
  // }

  // Note: Daily Flashcards widget now uses data.flashcards instead of a static question

  return (
    <div className="min-h-screen bg-linear-to-br from-gray-50 via-blue-50/30 to-purple-50/30 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* ═══════════════════════════════════════════════════════════════════
            HERO SECTION - Chess.com Inspired
            Purpose: Your Medical Learning Command Center
        ═══════════════════════════════════════════════════════════════════ */}

        {/* Top Stats Row - Refined for Academic Premium Aesthetic */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard
            icon={ClipboardList}
            title="Quizzes"
            value={stats.quizzesCompleted || 0}
            subtitle="Completed"
            colorClass="bg-slate-700"
            onClick={() => router.push('/quiz/history')}
          />
          <StatCard
            icon={Target}
            title="Avg Score"
            value={`${stats.averageScore || 0}%`}
            subtitle="Efficacy"
            colorClass="bg-emerald-500"
            onClick={() => router.push('/progress')}
          />
          <StatCard
            icon={BookOpen}
            title="Courses"
            value={`${stats.coursesCompleted || 0}/${stats.totalCourses || 0}`}
            subtitle="Progress"
            colorClass="bg-indigo-500"
            onClick={() => router.push('/courses')}
          />
          <StatCard
            icon={Clock}
            title="Study Time"
            value={`${stats.studyHours || 0}h`}
            subtitle="This Month"
            colorClass="bg-purple-500"
            onClick={() => router.push('/study-planner')}
          />
        </div>

        {/* Quick Actions + Daily Question Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content - Left Side (2 cols) */}
          <div className="lg:col-span-2 space-y-6">
            {/* Quick Actions - Like Chess.com's Play buttons */}
            <div className="bg-white/80 dark:bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-200 dark:border-slate-700/50 h-full">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-5 h-5 text-amber-500 dark:text-amber-400" />
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Quick Start</h3>
                <span className="text-xs bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full ml-2">Your Command Center</span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                {/* Start Quiz */}
                <button
                  onClick={() => setShowQuickQuiz(true)}
                  className="flex flex-col items-center justify-center p-4 bg-slate-700/30 dark:bg-slate-700/50 hover:bg-slate-700/50 dark:hover:bg-slate-600/50 rounded-xl border border-slate-600 transition-all group"
                >
                  <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <PlayCircle className="w-5 h-5 text-white" />
                  </div>
                  <p className="font-semibold text-gray-900 dark:text-white text-sm">Take Quiz</p>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">10 min session</p>
                </button>

                {/* Flashcards */}
                <button
                  onClick={() => router.push('/flashcards')}
                  className="flex flex-col items-center justify-center p-4 bg-slate-700/30 dark:bg-slate-700/50 hover:bg-slate-700/50 dark:hover:bg-slate-600/50 rounded-xl border border-slate-600 transition-all group"
                >
                  <div className="w-10 h-10 bg-indigo-500 rounded-lg flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <BookMarked className="w-5 h-5 text-white" />
                  </div>
                  <p className="font-semibold text-gray-900 dark:text-white text-sm">Flashcards</p>
                </button>

                 {/* Continue Course */}
                <button
                  onClick={async () => {
                    const firstCourse: any = data.courseData?.[0];
                    if (firstCourse?.id) {
                      try {
                          if (firstCourse.unitId) {
                              if (firstCourse.nextTopicId) {
                                  router.push(`/courses/${firstCourse.id}/units/${firstCourse.unitId}/topics/${firstCourse.nextTopicId}`);
                              } else {
                                  router.push(`/courses/${firstCourse.id}/units/${firstCourse.unitId}`);
                              }
                          } else {
                              const resumePoint = await getResumePoint(firstCourse.id);
                              if (resumePoint && resumePoint.id && resumePoint.type === 'topic') {
                                  if (resumePoint.unitId) {
                                      router.push(`/courses/${firstCourse.id}/units/${resumePoint.unitId}/topics/${resumePoint.id}`);
                                  } else {
                                      router.push(`/courses/${firstCourse.id}`); // Fallback if no unit
                                  }
                              } else {
                                  router.push(`/courses/${firstCourse.id}`);
                              }
                          }
                      } catch (e) {
                           console.error("Resume failed", e);
                           router.push(`/courses/${firstCourse.id}`);
                      }
                    } else {
                      router.push('/courses');
                    }
                  }}
                  className="group bg-linear-to-br from-purple-500/20 to-violet-600/20 hover:from-purple-500/30 hover:to-violet-600/30 border border-purple-500/30 rounded-xl p-4 text-left transition-all hover:scale-[1.02]"
                >
                  <div className="w-10 h-10 bg-purple-500 rounded-lg flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <GraduationCap className="w-5 h-5 text-white" />
                  </div>
                  <p className="font-semibold text-gray-900 dark:text-white text-sm">Continue</p>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">Resume learning</p>
                </button>

                {/* Focus Session */}
                <button
                  onClick={() => setShowStudySession(true)}
                  className="flex flex-col items-center justify-center p-4 bg-slate-700/30 dark:bg-slate-700/50 hover:bg-slate-700/50 dark:hover:bg-slate-600/50 rounded-xl border border-slate-600 transition-all group"
                >
                  <div className="w-10 h-10 bg-rose-500 rounded-lg flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <Clock className="w-5 h-5 text-white" />
                  </div>
                  <p className="font-semibold text-gray-900 dark:text-white text-sm">Focus Session</p>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">Focused study</p>
                </button>
              </div>

              {/* AI Insight - Compact */}
              <div className="mt-4 p-3 bg-linear-to-r from-indigo-100 dark:from-indigo-500/10 to-purple-100 dark:to-purple-500/10 border border-indigo-200 dark:border-indigo-500/20 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-200 dark:bg-indigo-500/20 rounded-lg">
                    {React.createElement(insights[activeInsight].icon, {
                      className: 'w-4 h-4 text-indigo-600 dark:text-indigo-400',
                    })}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-gray-900 dark:text-white">{insights[activeInsight].text}</p>
                  </div>
                  <div className="flex gap-1">
                    {insights.map((_, i) => (
                      <div
                        key={i}
                        className={`w-1.5 h-1.5 rounded-full transition-all ${i === activeInsight ? 'bg-indigo-500 dark:bg-indigo-400 w-3' : 'bg-gray-300 dark:bg-slate-600'}`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar - Right Side (1 col) */}
          <div className="lg:col-span-1 space-y-6">
            {/* Daily Flashcards Widget - Like Chess.com's Daily Puzzle */}
            <div className="bg-linear-to-br from-cyan-500 to-indigo-600 rounded-2xl p-6 shadow-lg text-white">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <BookMarked className="w-5 h-5" />
                  <h3 className="font-bold">Daily Flashcards</h3>
                </div>
                {(data.flashcards?.due || 0) > 0 && (
                  <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">{data.flashcards?.due} due</span>
                )}
              </div>

              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 mb-4">
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <p className="text-2xl font-bold">{data.flashcards?.due || 0}</p>
                    <p className="text-xs text-cyan-200">Due Today</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{data.flashcards?.mastered || 0}</p>
                    <p className="text-xs text-cyan-200">Mastered</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{data.flashcards?.learning || 0}</p>
                    <p className="text-xs text-cyan-200">Learning</p>
                  </div>
                </div>
              </div>

              <button 
                onClick={() => router.push('/flashcards')}
                className="w-full bg-white dark:bg-slate-700/50 text-indigo-600 dark:text-blue-400 font-semibold py-3 rounded-xl hover:bg-blue-50 dark:hover:bg-slate-600/50 transition-colors shadow-md"
              >
                Start Review →
              </button>
            </div>

            {/* Goals Progress Widget - Integrated for high visibility */}
            <div className="h-full">
               <GoalsProgressWidget />
            </div>
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
          
          <div className="flex items-center justify-between mb-8 relative z-10">
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                Performance Trends
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Monthly progress and engagement</p>
            </div>
            <div className="flex bg-slate-100 dark:bg-slate-900/50 p-1 rounded-xl border border-slate-200 dark:border-slate-700/50">
              <button
                onClick={() => setSelectedTrendMetric('score')}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${selectedTrendMetric === 'score'
                  ? 'bg-white dark:bg-indigo-500 text-indigo-600 dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
              >
                Avg. Score
              </button>
              <button
                onClick={() => setSelectedTrendMetric('hours')}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${selectedTrendMetric === 'hours'
                  ? 'bg-white dark:bg-indigo-500 text-indigo-600 dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
              >
                Study Hours
              </button>
            </div>
          </div>
          
          <div className="flex items-end justify-between gap-2 md:gap-4 h-64 px-2 relative z-10">
            {data.performanceTrends?.map((item: { score?: number; hours?: number; month?: string }, i: number) => {
              const value = (selectedTrendMetric === 'score' ? item.score : item.hours) ?? 0;
              const maxValue = selectedTrendMetric === 'score' ? 100 : 
                            Math.max(...(data.performanceTrends?.map((t: { hours?: number }) => t.hours || 0) || [10]));
              const height = Math.max(8, (value / maxValue) * 100);

              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-3 group h-full justify-end">
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
                        <div className="flex flex-col items-center">
                          <span>{value}{selectedTrendMetric === 'score' ? '%' : 'h'}</span>
                          <div className="w-1.5 h-1.5 bg-slate-900 dark:bg-slate-800 rotate-45 absolute -bottom-1 left-1/2 -translate-x-1/2 border-r border-b border-slate-700" />
                        </div>
                      </div>
                    </motion.div>
                  </div>
                  <span className="text-[10px] md:text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-tighter">{item.month}</span>
                </div>
              );
            })}
          </div>
          
          <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-700/50 flex flex-wrap items-center justify-between gap-4 text-sm relative z-10">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${selectedTrendMetric === 'score' ? 'bg-indigo-500' : 'bg-emerald-500'}`}></div>
                <span className="text-slate-600 dark:text-slate-400 font-medium">
                  {selectedTrendMetric === 'score' ? 'Assessment Average' : 'Study Engagement'}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 dark:bg-emerald-500/10 rounded-full border border-emerald-100 dark:border-emerald-500/20">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span className="text-emerald-600 dark:text-emerald-400 font-bold text-xs">
                +{selectedTrendMetric === 'score' ? '9.2' : '15.7'}% improved vs last period
              </span>
            </div>
          </div>
        </div>

        {/* Peer Comparison */}
        <div className="bg-linear-to-br from-violet-600 to-purple-700 dark:from-violet-900 dark:to-purple-950 rounded-2xl p-6 shadow-lg text-white">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Users className="w-6 h-6" />
              <h3 className="text-xl font-bold">Peer Comparison</h3>
            </div>
            <span className="text-xs bg-white/20 px-3 py-1 rounded-full">Your Cohort</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white/10 dark:bg-black/20 backdrop-blur-sm rounded-xl p-4 border border-white/20 dark:border-white/10">
              <p className="text-sm text-white/80 mb-1">Your Average</p>
              <p className="text-3xl font-bold">{data.peerComparison?.yourAverage}%</p>
              <div className="flex items-center gap-1 mt-2 text-xs">
                <TrendingUp className="w-3 h-3" />
                <span>+3% from cohort</span>
              </div>
            </div>

            <div className="bg-white/10 dark:bg-black/20 backdrop-blur-sm rounded-xl p-4 border border-white/20 dark:border-white/10">
              <p className="text-sm text-white/80 mb-1">Cohort Average</p>
              <p className="text-3xl font-bold">{data.peerComparison?.cohortAverage}%</p>
              <p className="text-xs text-white/60 mt-2">150 students</p>
            </div>

            <div className="bg-white/10 dark:bg-black/20 backdrop-blur-sm rounded-xl p-4 border border-white/20 dark:border-white/10">
              <p className="text-sm text-white/80 mb-1">Your Rank</p>
              <p className="text-3xl font-bold">#{data.peerComparison?.rank}</p>
              <p className="text-xs text-white/60 mt-2">Top 8%</p>
            </div>

            <div className="bg-white/10 dark:bg-black/20 backdrop-blur-sm rounded-xl p-4 border border-white/20 dark:border-white/10">
              <p className="text-sm text-white/80 mb-1">Top Performer</p>
              <p className="text-3xl font-bold">{data.peerComparison?.topPerformer}%</p>
              <p className="text-xs text-white/60 mt-2">Keep pushing!</p>
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
              onClick={() => setShowCalendar(true)}
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

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Overall Progress */}
          <div className="bg-white/80 dark:bg-slate-800/50 backdrop-blur-sm rounded-2xl p-8 border border-gray-200 dark:border-slate-700/50 flex flex-col items-center">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Overall Progress</h3>
            <ProgressRing progress={stats.overallProgress || 0} />
            <div className="mt-6 text-center">
              <p className="text-sm text-gray-600 dark:text-slate-400">Keep up the great work!</p>
              <div className="flex items-center justify-center gap-2 mt-2">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">On track for your goals</span>
              </div>
            </div>
          </div>

          {/* Weekly Study Pattern - Interactive */}
          <div className="lg:col-span-2 bg-white/80 dark:bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-200 dark:border-slate-700/50">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">This Week's Activity</h3>
              <button 
                onClick={() => router.push('/analytics')}
                className="text-sm font-medium text-cyan-600 dark:text-cyan-400 hover:text-cyan-500 dark:hover:text-cyan-300 flex items-center gap-1"
              >
                View Details <ArrowRight className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-end justify-between gap-2 h-48">
              {data.weeklyProgress?.map((day: { day?: string; hours?: number; target?: number }, i: number) => {
                const hours = day.hours ?? 0;
                const target = day.target ?? 4;
                const percentage = (hours / 6) * 100;
                const targetPercentage = (target / 6) * 100;
                const isAboveTarget = hours >= target;

                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-2 group">
                    <div className="relative w-full">
                      {/* Target line */}
                      <div
                        className="absolute w-full border-t-2 border-dashed border-gray-300 left-0 dynamic-bottom"
                        style={{ '--bottom': `${targetPercentage}%` } as React.CSSProperties}
                      />
                      {/* Actual bar */}
                      <div
                        className={`w-full rounded-t-lg transition-all hover:opacity-80 cursor-pointer dynamic-height ${isAboveTarget
                          ? 'bg-linear-to-t from-green-500 to-emerald-400'
                          : 'bg-linear-to-t from-indigo-500 to-cyan-400'
                        }`}
                        style={{ '--height': `${percentage}%` } as React.CSSProperties}
                      >
                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white px-2 py-1 rounded text-xs whitespace-nowrap border border-slate-700">
                          {hours}h / {target}h
                        </div>
                      </div>
                    </div>
                    <span className="text-xs font-medium text-slate-400">{day.day}</span>
                    <span className="text-xs text-slate-500">{hours}h</span>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 flex items-center justify-center gap-4 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-3 h-1 border-t-2 border-dashed border-slate-500"></div>
                <span className="text-slate-400">Target</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-emerald-500"></div>
                <span className="text-slate-400">Above target</span>
              </div>
            </div>
          </div>
        </div>

        {/* Featured Specializations */}
        {( (data as any).featuredSpecializations?.length || 0) > 0 && (
          <div className="bg-white/80 dark:bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-200 dark:border-slate-700/50">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Star className="w-5 h-5 text-amber-500" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Featured Specializations</h3>
              </div>
              <button 
                onClick={() => router.push('/learning-paths')}
                className="text-sm font-medium text-indigo-600 dark:text-blue-400 hover:text-indigo-700 dark:hover:text-blue-300 flex items-center gap-1"
              >
                View Catalog <ArrowRight className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {((data as any).featuredSpecializations)?.map((spec: any) => (
                <div
                  key={spec.id}
                  onClick={() => router.push(`/learning-paths?specialization=${spec.id}`)}
                  className={`bg-linear-to-br ${spec.color} rounded-xl p-5 text-white hover:scale-[1.02] transition-transform cursor-pointer shadow-lg`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center backdrop-blur-md">
                      {spec.icon === 'pill' ? <BookOpen className="w-5 h-5" /> : <Brain className="w-5 h-5" />}
                    </div>
                    <span className="px-2 py-1 bg-white/20 rounded-full text-xs font-semibold backdrop-blur-md">
                      {spec.courseCount} Courses
                    </span>
                  </div>
                  <h4 className="font-bold text-lg mb-2">{spec.title}</h4>
                  <p className="text-white/80 text-sm line-clamp-2">{spec.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Enrolled Units */}
        <div className="bg-white/80 dark:bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-200 dark:border-slate-700/50">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Enrolled Units</h3>
            <button 
              onClick={() => router.push('/courses')}
              className="text-sm font-medium text-indigo-600 dark:text-blue-400 hover:text-indigo-700 dark:hover:text-blue-300"
            >
              Browse Catalog
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.courseData?.map((course: { id?: string; unitId?: string; name?: string; progressPercentage?: number; color?: string; nextTopic?: string; timeLeft?: string; lastUpdated?: number }) => (
              <div
                key={course.id}
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

        {/* Recent Materials */}
        <div className="bg-white/80 dark:bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-200 dark:border-slate-700/50">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Materials</h3>
            <button 
              onClick={() => router.push('/study-planner/materials')}
              className="text-sm font-medium text-indigo-600 dark:text-blue-400 hover:text-indigo-700 dark:hover:text-blue-300"
            >
              Browse All Materials
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.recentActivity
              ?.filter((a: { type?: string }) => a.type === 'material')
              .map((material: { id?: string; title?: string; date?: string; description?: string }) => (
                <div
                  key={material.id}
                  onClick={() => router.push(`/study-planner/materials/${material.id}`)}
                  className="bg-gray-50/50 dark:bg-slate-700/50 rounded-xl p-5 border border-gray-200 dark:border-slate-600/50 hover:shadow-lg dark:hover:border-indigo-500/50 transition-all duration-300 group cursor-pointer"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div
                      className={`w-10 h-10 rounded-lg bg-linear-to-br from-gray-500 to-gray-600 flex items-center justify-center`}
                    >
                      <FileText className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-blue-400 transition-colors">{material.title}</h4>
                      <p className="text-xs text-gray-500 dark:text-slate-400">
                        {material.date ? new Date(material.date).toLocaleDateString() : 'Unknown date'}
                      </p>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-slate-400 line-clamp-2">{material.description}</p>
                </div>
              ))}
          </div>
        </div>

        {/* Note: Quick Access Tools are now in the hero Quick Start section above */}

        {/* Analytics Overview (Toggled) */}
        {showAnalytics && (
          <div className="bg-linear-to-br from-indigo-500 to-purple-600 rounded-2xl p-6 text-white shadow-xl">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-xl font-bold">Learning Analytics</h3>
                <p className="text-indigo-100 text-sm">Quick insights into your performance</p>
              </div>
              <button
                onClick={() => setShowAnalytics(false)}
                className="bg-white text-indigo-600 px-4 py-2 rounded-lg font-semibold hover:bg-indigo-50 transition-all"
              >
                Close
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white/10 rounded-xl p-4">
                <p className="text-sm text-white/80 mb-1">Completion Rate</p>
                <p className="text-2xl font-bold">
                  {Math.round(((stats.coursesCompleted || 0) / Math.max(1, (stats.totalCourses || 0))) * 100)}%
                </p>
              </div>
              <div className="bg-white/10 rounded-xl p-4">
                <p className="text-sm text-white/80 mb-1">Study Time</p>
                <p className="text-2xl font-bold">{counters.hours}h</p>
              </div>
              <div className="bg-white/10 rounded-xl p-4">
                <p className="text-sm text-white/80 mb-1">Avg Performance</p>
                <p className="text-2xl font-bold">{counters.score}%</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {showQuickQuiz && <QuickQuizModal />}
      {showCalendar && <CalendarModal />}
      
      {showStudySession && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-gray-200 dark:border-slate-700">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Study Session</h3>
              <button
                onClick={() => setShowStudySession(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                title="Close"
              >
                <X className="w-5 h-5 dark:text-slate-400" />
              </button>
            </div>
            <StudySession 
              topicId="general-study" 
              onSessionEnd={() => {
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
