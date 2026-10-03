'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  BookOpen,
  Star,
  TrendingUp,
  CheckCircle,
  AlertCircle,
  Search,
  Award,
  X,
  type LucideIcon,
  Layers,
  ChevronRight,
  UserRound,
} from 'lucide-react';
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
  type QueryFunctionContext,
  type InfiniteData,
} from '@tanstack/react-query';
import { usePageHeader } from '@/core/providers/HeaderContext';
import { courseService } from '@/features/courses/services/courseService';
import { toast } from 'sonner';
import { useStudy } from '@/features/learning-management/study/hooks/useStudy';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { handleUnknownError } from '@/app/services/error.service';
import { getInstructorDisplayName } from '@/lib/utils';
import {
  CourseFilter,
  CourseStatistics,
  Course,
} from '@/shared/types/courseInterface';
import { Progress } from '@/shared/components/ui/progress';
import { UnitSelectionModal } from '@/features/courses/components/UnitSelectionModal';

interface CoursesPageData {
  courses: Course[];
  stats: CourseStatistics | { total?: number };
  page: number;
  limit: number;
}

export const CoursesDashboard = () => {
  const { setHeader } = usePageHeader();
  const { getResumePoint } = useStudy();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'enrolled' | 'discover' | 'recommended'>('enrolled');
  const [filters, setFilters] = useState<CourseFilter>({
    searchTerm: '',
    difficulty: '',
    category: '',
    status: 'enrolled', // Default to enrolled
  });
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [unitSelectionCourse, setUnitSelectionCourse] = useState<Course | null>(null);
  const router = useRouter();

  const { data: progressDashboard } = useQuery({
    queryKey: ['course-progress-dashboard', user?.id],
    queryFn: () => courseService.getProgressDashboard(user!.id),
    enabled: Boolean(user?.id),
    staleTime: 30_000,
  });
  const activeUnits = progressDashboard?.enrolledUnits ?? [];
  const courseProgressById = new Map(
    (progressDashboard?.courses ?? []).map(item => [item.courseId, item]),
  );

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const searchTerm = filters.searchTerm.trim();
    setDebouncedSearchTerm(searchTerm);
    if (searchTerm.length > 0 && activeTab === 'enrolled') {
      setActiveTab('discover'); // Switch to discover when searching if in enrolled tab
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const searchTerm = filters.searchTerm.trim();
      setDebouncedSearchTerm(searchTerm);
      if (searchTerm && activeTab !== 'discover') {
        setActiveTab('discover');
      }
    }, 350);
    return () => window.clearTimeout(timer);
  }, [filters.searchTerm, activeTab]);

  // Set page header
  useEffect(() => {
    setHeader({
      title: 'Courses',
      description: 'Manage your learning and discover new medical paths',
      icon: '📚',
    });

    return () => {
      setHeader(null);
    };
  }, []);

  // Sync tab with filters.status
  useEffect(() => {
    setFilters(prev => ({
      ...prev,
      status: activeTab === 'discover' ? 'all' : activeTab,
    }));
  }, [activeTab]);

  // Fetch all courses with filters
  const pageSize = 12;
  const {
    data: infiniteData,
    isLoading: coursesLoading,
    isError: coursesError,
    error: coursesErrorDetails,
    fetchNextPage,
    hasNextPage,
  } = useInfiniteQuery<CoursesPageData, Error, InfiniteData<CoursesPageData>>({
    queryKey: [
      'courses',
      filters.difficulty,
      filters.category,
      filters.status,
      debouncedSearchTerm,
    ],
    initialPageParam: 1,
    queryFn: async ({ pageParam }: QueryFunctionContext): Promise<CoursesPageData> => {
      const pageNum = typeof pageParam === 'number' ? pageParam : 1;
      
      if (filters.status === 'recommended' && !debouncedSearchTerm) {
        const recommended = await courseService.getRecommendedCourses(pageSize);
        return { 
          courses: recommended, 
          stats: { total: recommended.length }, 
          page: 1, 
          limit: pageSize 
        };
      }

      let endpoint = '/courses';

      if (filters.status === 'enrolled') {
        endpoint = '/courses/my-courses';
      } else {
        endpoint = '/courses';
      }

      let raw: unknown;
      if (endpoint === '/courses') {
        raw = await courseService.getCourses({
          page: pageNum,
          limit: pageSize,
          search: debouncedSearchTerm || undefined,
          difficulty: (filters.difficulty as "beginner" | "intermediate" | "advanced" | "expert") || undefined,
          categoryId: filters.category,
        });
      } else {
        raw = await courseService.getEnrolledCourses({
          status: 'active',
          page: pageNum,
          limit: pageSize,
        });
      }

      if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
        const rawObj = raw as Record<string, unknown>;
        const items = Array.isArray(rawObj.items) ? (rawObj.items as unknown[]) : [];
        const courses = items.map(item => {
          if (item && typeof item === 'object') {
            const itemObj = item as Record<string, unknown>;
            if (itemObj.course && typeof itemObj.course === 'object') {
              return {
                ...(itemObj.course as Course),
                isEnrolled: true,
                progressPercentage: (typeof itemObj.progressPercentage === 'number' ? itemObj.progressPercentage : 0),
              };
            }
          }
          return item as Course;
        });
        return {
          courses,
          stats: { total: typeof rawObj.total === 'number' ? rawObj.total : 0 },
          page: typeof rawObj.page === 'number' ? rawObj.page : 1,
          limit: typeof rawObj.pageSize === 'number' ? rawObj.pageSize : pageSize,
        };
      } else if (Array.isArray(raw)) {
        const unitItems = raw as Array<Record<string, unknown>>;
        const courses: Course[] = unitItems.map(unit => ({
          id: String(unit.courseId ?? ''),
          name: String(unit.courseTitle ?? ''),
          title: String(unit.unitTitle ?? ''),
          description: `Part of ${unit.courseTitle ?? ''}`,
          categoryId: '',
          status: 'published',
          price: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          estimatedHours: Math.round((Number(unit.totalTopics ?? 0)) * 0.5), // Estimate if not available
          enrollmentCount: 0,
          rating: 0,
          difficulty: 'intermediate',
          isEnrolled: true,
          progressPercentage: Number(unit.progressPercentage ?? 0),
          unitId: unit.unitId as string | undefined,
          nextTopicId: unit.nextTopicId as string | undefined,
        }));
        return { courses, stats: { total: unitItems.length }, page: 1, limit: unitItems.length };
      }

      return { courses: [], stats: {}, page: pageNum, limit: pageSize };
    },
    staleTime: 5 * 60 * 1000,
    getNextPageParam: (lastPage: CoursesPageData) => {
      const stats = lastPage.stats as Record<string, unknown> | undefined;
      const total = stats && typeof stats.total === 'number' ? stats.total : 0;
      const loaded = lastPage.page * lastPage.limit;
      return loaded < total ? lastPage.page + 1 : undefined;
    },
    meta: { persist: Boolean(user?.id) },
  });

  const { data: courseStatisticsData } = useQuery({
    queryKey: ['courseStatistics'],
    queryFn: () => courseService.getCourseStats().catch(() => ({
      totalEnrolled: 0,
      completed: 0,
      inProgress: 0,
      avgScore: 0,
    })),
  });

  const courseStatistics = (courseStatisticsData as CourseStatistics) || {
    totalEnrolled: 0,
    completed: 0,
    inProgress: 0,
    avgScore: 0,
  };
  const completedUnitCount = activeUnits.filter(
    unit => unit.isCompleted === true || unit.status === 'completed',
  ).length;
  const ongoingUnitCount = activeUnits.length - completedUnitCount;

  const openCourseUnits = async (course: Course) => {
    try {
      if (course.unitId) {
        router.push(`/courses/${course.id}/units/${course.unitId}`);
        return;
      }

      const resume = (await getResumePoint(course.id)) as
        | { type?: string; unitId?: string; id?: string }
        | null;

      if (resume && resume.type === 'topic' && resume.unitId) {
        router.push(`/courses/${course.id}/units/${resume.unitId}/topics/${resume.id}`);
        return;
      }

      if (resume && resume.unitId) {
        router.push(`/courses/${course.id}/units/${resume.unitId}`);
        return;
      }

      router.push(`/courses/${course.id}`);
    } catch (error: unknown) {
      handleUnknownError(error, `/courses/${course.id}`);
      router.push(`/courses/${course.id}`);
      toast.error('Could not open the course. Redirecting to the course page.');
    }
  };

  const handleUnitsStarted = async () => {
    setUnitSelectionCourse(null);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['courses'] }),
      queryClient.invalidateQueries({ queryKey: ['active-units'] }),
      queryClient.invalidateQueries({ queryKey: ['course-progress-dashboard'] }),
      queryClient.invalidateQueries({ queryKey: ['courseStatistics'] }),
    ]);
    setActiveTab('enrolled');
    toast.success('Units added to My Learning.');
  };

  const removeCourseFromLearning = async (course: Course) => {
    const courseName = course.title || course.name;
    if (!window.confirm(`Remove ${courseName} from My Learning? Your progress will be kept.`)) return;

    try {
      await courseService.unenrollFromCourse(course.id);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['courses'] }),
        queryClient.invalidateQueries({ queryKey: ['courseStatistics'] }),
        queryClient.invalidateQueries({ queryKey: ['active-units'] }),
        queryClient.invalidateQueries({ queryKey: ['course-progress-dashboard'] }),
      ]);
      toast.success(`${courseName} removed from My Learning. Your progress was kept.`);
    } catch (error) {
      console.error('Failed to remove course from My Learning:', error);
      toast.error('Could not remove this course from My Learning.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900/50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={BookOpen}
            title="My Units"
            value={activeUnits.length}
            gradient="from-blue-500 to-indigo-600"
            description="Enrolled units"
          />
          <StatCard
            icon={CheckCircle}
            title="Completed Units"
            value={completedUnitCount}
            gradient="from-emerald-500 to-teal-600"
            description="Units finished"
          />
          <StatCard
            icon={TrendingUp}
            title="In Progress"
            value={ongoingUnitCount}
            gradient="from-amber-500 to-orange-600"
            description="Ongoing learning"
          />
          <StatCard
            icon={Award}
            title="Avg Score"
            value={`${courseStatistics.avgScore || 0}%`}
            gradient="from-rose-500 to-pink-600"
            description="Average topic quiz score"
          />
        </div>

        {/* Search & Tabs Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-700">
          <div className="flex flex-col gap-4 flex-1">
            <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-900 rounded-2xl w-fit">
              <TabButton 
                active={activeTab === 'enrolled'} 
                onClick={() => {
                  setActiveTab('enrolled');
                  setFilters(prev => ({ ...prev, searchTerm: '' }));
                  setDebouncedSearchTerm('');
                }}
                label="My Learning"
                icon={BookOpen}
              />
              <TabButton 
                active={activeTab === 'discover'} 
                onClick={() => { setActiveTab('discover'); }}
                label="Discover"
                icon={Search}
              />
              <TabButton 
                active={activeTab === 'recommended'} 
                onClick={() => {
                  setActiveTab('recommended');
                  setFilters(prev => ({ ...prev, searchTerm: '' }));
                  setDebouncedSearchTerm('');
                }}
                label="For You"
                icon={Star}
              />
            </div>
            {activeTab === 'recommended' && (
              <p className="text-xs text-slate-500 dark:text-slate-400 ml-2 animate-in fade-in slide-in-from-left-2">
                Uses subjects from your active or completed classes, then ranks by rating and learner count. Without matching class history, it suggests popular or featured courses.
              </p>
            )}
          </div>

          <form onSubmit={handleSearch} className="flex-1 max-w-md relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search courses, topics, or specialties..."
              value={filters.searchTerm}
              onChange={e => setFilters({ ...filters, searchTerm: e.target.value })}
              className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
            />
          </form>
        </div>

        {activeTab === 'enrolled' && (
          <div className="space-y-8">
            {[
              {
                title: 'Ongoing Units',
                units: activeUnits.filter(unit => unit.isCompleted !== true && unit.status !== 'completed'),
                completed: false,
              },
              {
                title: 'Completed Units',
                units: activeUnits.filter(unit => unit.isCompleted === true || unit.status === 'completed'),
                completed: true,
              },
            ].map(section => (
              <section key={section.title} aria-label={section.title}>
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">{section.title}</h2>
                  <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">{section.units.length}</span>
                </div>
                {section.units.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-slate-300 p-5 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                    {section.completed ? 'No completed units yet.' : 'No ongoing units yet. Start a unit from a course.'}
                  </p>
                ) : (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {section.units.map(unit => {
                      const unitId = String(unit.unitId ?? '');
                      const courseId = String(unit.courseId ?? '');
                      const percentage = Math.min(100, Math.max(0, Number(unit.progressPercentage) || 0));
                      return (
                        <article key={unitId} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                          <p className="mb-1 text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">{String(unit.courseTitle ?? 'Course')}</p>
                          <h3 className="font-bold text-slate-900 dark:text-white">{String(unit.unitTitle ?? 'Unit')}</h3>
                          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                            {Number(unit.completedTopics) || 0} of {Number(unit.totalTopics) || 0} topics complete
                          </p>
                          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                            <div className={`h-full ${section.completed ? 'bg-emerald-500' : 'bg-blue-600'}`} style={{ width: `${percentage}%` }} />
                          </div>
                          <div className="mt-4 flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => router.push(`/courses/${courseId}/units/${unitId}`)}
                              className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                            >
                              {section.completed ? 'Review unit' : 'Continue unit'}
                              <ChevronRight className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => router.push(`/courses/${courseId}`)}
                              disabled={!courseId}
                              aria-label={`View all units in ${String(unit.courseTitle ?? 'course')}`}
                              className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
                            >
                              <BookOpen className="h-4 w-4" />
                              Course units
                            </button>
                            {section.completed && (
                              <button
                                type="button"
                                onClick={() => router.push(`/quiz/unit/${unitId}`)}
                                className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
                              >
                                Unit quiz
                                <ChevronRight className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>
            ))}
          </div>
        )}

        {/* Content Grid */}
        {coursesError ? (
          <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">
            Could not load courses: {coursesErrorDetails instanceof Error ? coursesErrorDetails.message : 'Please try again later.'}
          </div>
        ) : coursesLoading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent" />
            <p className="mt-4 text-slate-500 font-medium">Curating your courses...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {(infiniteData as any)?.pages?.flatMap((p: any) => p.courses)?.length > 0 ? (
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 md:gap-6 xl:grid-cols-3">
                {(infiniteData as any).pages.flatMap((p: any) => p.courses).map((course: any) => (
                  <CourseCard 
                    key={course.unitId || course.id} 
                    course={activeTab === 'enrolled'
                      ? {
                          ...course,
                          progressPercentage: courseProgressById.get(course.id)?.progressPercentage
                            ?? course.progressPercentage
                            ?? 0,
                        }
                      : course}
                    wide={activeTab === 'enrolled'}
                    onSelectCourse={openCourseUnits}

                    onRemoveCourse={removeCourseFromLearning}
                    router={router}
                    getResumePoint={getResumePoint}
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-slate-800 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-700">
                <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-full mb-4">
                  <AlertCircle className="w-10 h-10 text-slate-400" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">No courses found</h3>
                <p className="text-slate-500 max-w-xs text-center mt-2">
                  {activeTab === 'enrolled' 
                    ? "You haven't enrolled in any courses yet. Start exploring the catalog!"
                    : "We couldn't find any courses matching your search. Try different keywords."}
                </p>
                {activeTab === 'enrolled' && (
                  <button 
                    onClick={() => setActiveTab('discover')}
                    className="mt-6 px-6 py-2 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors"
                  >
                    Explore Catalog
                  </button>
                )}
              </div>
            )}

            {hasNextPage && (
              <div className="flex justify-center pt-8">
                <button
                  onClick={() => fetchNextPage()}
                  className="px-8 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm"
                >
                  Show More Courses
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      {unitSelectionCourse && (
        <UnitSelectionModal
          course={unitSelectionCourse}
          activeUnitIds={activeUnits.map(unit => String(unit.unitId || ''))}
          onClose={() => setUnitSelectionCourse(null)}
          onComplete={handleUnitsStarted}
        />
      )}
    </div>
  );
};

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  label: string;
  icon: LucideIcon;
}

const TabButton = ({ active, onClick, label, icon: Icon }: TabButtonProps) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-all ${
      active 
        ? 'bg-white dark:bg-slate-800 text-blue-600 shadow-md scale-105' 
        : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
    }`}
  >
    <Icon className={`w-4 h-4 ${active ? 'text-blue-600' : 'text-slate-400'}`} />
    {label}
  </button>
);

interface StatCardProps {
  icon: LucideIcon;
  title: string;
  value: string | number;
  gradient: string;
  description?: string;
}

const StatCard = ({ icon: Icon, title, value, gradient, description }: StatCardProps) => (
  <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm group hover:shadow-md transition-all">
    <div className={`w-12 h-12 rounded-2xl bg-linear-to-br ${gradient} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
      <Icon className="w-6 h-6 text-white" />
    </div>
    <p className="text-slate-500 dark:text-slate-400 text-sm font-semibold uppercase tracking-wider">{title}</p>
    <p className="text-3xl font-black text-slate-900 dark:text-white mt-1">{value}</p>
    {description && (
      <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold mt-2 uppercase tracking-tighter">{description}</p>
    )}
  </div>
);

interface CourseCardProps {
  course: Course;
  wide?: boolean;
  onSelectCourse: (course: Course) => void;
  onRemoveCourse: (course: Course) => void;
  router: ReturnType<typeof useRouter>;
  getResumePoint: (courseId: string) => unknown;
}

const CourseCard = ({ course, wide = false, onSelectCourse, onRemoveCourse, router, getResumePoint }: CourseCardProps) => {
  const isEnrolled = course.isEnrolled;
  const progress = course.progressPercentage ?? 0;
  const owner = getInstructorDisplayName(course.instructor ?? course.createdBy);
  const courseName = course.title || course.name;
  const bannerPalettes = [
    'from-sky-700 via-blue-700 to-indigo-800',
    'from-teal-700 via-cyan-700 to-blue-800',
    'from-violet-700 via-indigo-700 to-blue-800',
    'from-emerald-700 via-teal-700 to-cyan-800',
  ];
  const paletteIndex = Array.from(course.id).reduce((sum, character) => sum + character.charCodeAt(0), 0) % bannerPalettes.length;

  const openCourse = async () => {
    if (course.unitId) {
      router.push(`/courses/${course.id}/units/${course.unitId}`);
      return;
    }
    const resume = await getResumePoint(course.id) as { type?: string; unitId?: string; id?: string } | null;
    if (resume?.type === 'topic' && resume.unitId) {
      router.push(`/courses/${course.id}/units/${resume.unitId}/topics/${resume.id}`);
    } else {
      router.push(`/courses/${course.id}`);
    }
  };

  return (
    <div 
      onClick={() => {
        if (course.unitId) {
            router.push(`/courses/${course.id}/units/${course.unitId}`);
        } else {
            onSelectCourse(course);
        }
      }}
      className={`group bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm hover:-translate-y-1 hover:shadow-xl transition-all cursor-pointer ${wide ? 'min-h-[25rem]' : ''}`}
    >
      {wide ? (
        <>
          <div className={`relative flex h-44 flex-col justify-between overflow-hidden bg-linear-to-br ${bannerPalettes[paletteIndex]} p-5 text-white`}>
            <BookOpen className="absolute -right-3 -bottom-8 h-36 w-36 rotate-[-12deg] text-white/10" aria-hidden="true" />
            <div className="relative flex items-start justify-between gap-3">
              <span className="rounded-md bg-black/15 px-2.5 py-1 text-xs font-semibold tracking-wide text-white/90">
                {course.code || 'Course'}
              </span>
              {Math.round(progress) >= 100 && <CheckCircle className="h-6 w-6 text-emerald-300" aria-label="Course complete" />}
            </div>
            <div className="relative">
              <h3 className="line-clamp-2 text-2xl font-bold leading-tight">{courseName}</h3>
              {course.description && <p className="mt-1 line-clamp-1 text-sm text-white/75">{course.description}</p>}
            </div>
          </div>

          <div className="space-y-4 p-5">
            <div className="flex min-h-10 items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200">
                <UserRound className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Course instructor</p>
                <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{owner}</p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
                <span>Course progress</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-2 bg-slate-100 dark:bg-slate-700" />
            </div>

            <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
              <span>{course.estimatedHours ?? 0} study hours</span>
              <span>{course.enrollmentCount ?? 0} learners</span>
              <span className="inline-flex items-center gap-1">
                {course.rating?.toFixed(1) ?? '—'} <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={(event) => { event.stopPropagation(); void openCourse(); }}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2.5 text-sm font-bold text-white transition-colors hover:bg-blue-700"
              >
                {progress > 0 ? 'Continue class' : 'Open class'}
                <ChevronRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  router.push(`/study-planner/materials?courseId=${encodeURIComponent(course.id)}&scope=enrolled`);
                }}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                <Layers className="h-4 w-4" />
                Materials
              </button>
            </div>
            <button
              type="button"
              onClick={(event) => { event.stopPropagation(); void onRemoveCourse(course); }}
              className="inline-flex w-full items-center justify-center gap-1.5 text-xs font-medium text-slate-400 transition-colors hover:text-rose-600"
            >
              <X className="h-3.5 w-3.5" />
              Remove from My Learning
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="relative flex h-40 flex-col justify-between bg-linear-to-br from-slate-700 to-slate-900 p-6">
            <div className="text-xs font-semibold uppercase tracking-wider text-white/70">{course.code || 'Course'}</div>
            <div>
              <h3 className="line-clamp-2 text-xl font-black leading-tight text-white">{courseName}</h3>
            </div>
          </div>
          <div className="space-y-4 p-6">
            <p className="line-clamp-2 min-h-10 text-sm text-slate-600 dark:text-slate-400">{course.description}</p>
            {course.recommendationReason && (
              <p className="rounded-lg bg-indigo-50 px-3 py-2 text-xs text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-200">
                {course.recommendationReason}
              </p>
            )}
            <div className="flex items-center justify-between border-y border-slate-100 py-3 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
              <span>{course.estimatedHours ?? 0}h</span>
              <span>{course.enrollmentCount ?? 0} learners</span>
              <span className="inline-flex items-center gap-1">
                {course.rating?.toFixed(1) ?? '—'} <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
              </span>
            </div>
            {!course.unitId ? (
          <button
            onClick={(e) => { e.stopPropagation(); router.push(`/courses/${course.id}`); }}
            className="w-full py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl font-black text-sm hover:scale-105 transition-transform flex items-center justify-center gap-2"
          >
            <Layers className="h-4 w-4" /> View Units
          </button>
        ) : (
          <div className="space-y-2">
          <button
            onClick={async (e) => {
              e.stopPropagation();
              if (course.unitId) {
                router.push(`/courses/${course.id}/units/${course.unitId}`);
              } else {
                const resume = await getResumePoint(course.id) as { type?: string; unitId?: string; id?: string } | null;
                if (resume && resume.type === 'topic' && resume.unitId) {
                  router.push(`/courses/${course.id}/units/${resume.unitId}/topics/${resume.id}`);
                } else {
                  // If no resume point, go to the course overview page (which lists units)
                  router.push(`/courses/${course.id}`);
                }
              }
            }}
            className="w-full py-3 bg-blue-600 text-white rounded-2xl font-black text-sm hover:bg-blue-700 shadow-lg shadow-blue-200 dark:shadow-none"
          >
            {progress === 0 ? 'View course' : 'Continue learning'}
          </button>
          {isEnrolled && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                void onRemoveCourse(course);
              }}
              className="inline-flex w-full items-center justify-center gap-2 py-2 text-sm font-semibold text-rose-600 transition-colors hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300"
            >
              <X className="h-4 w-4" />
              Remove from My Learning
            </button>
          )}
          </div>
        )}
          </div>
        </>
      )}
    </div>
  );
};

export default CoursesDashboard;
