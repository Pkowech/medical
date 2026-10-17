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
  type LucideIcon,
  Layers,
  ChevronRight,
  UserRound,
  MoreVertical,
  LogOut,
  FolderOpen,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';

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
  const [courseToUnenroll, setCourseToUnenroll] = useState<Course | null>(null);
  const [isUnenrolling, setIsUnenrolling] = useState(false);
  const router = useRouter();

  const { data: progressDashboard } = useQuery({
    queryKey: ['course-progress-dashboard', user?.id],
    queryFn: () => courseService.getProgressDashboard(user!.id),
    enabled: Boolean(user?.id),
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    meta: { persist: Boolean(user?.id) },
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
    queryKey: ['courseStatistics', user?.id],
    queryFn: () => courseService.getCourseStats().catch(() => ({
      totalEnrolled: 0,
      completed: 0,
      inProgress: 0,
      avgScore: 0,
    })),
    enabled: Boolean(user?.id),
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    meta: { persist: Boolean(user?.id) },
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

  const handleUnitsChanged = async (action: 'activated' | 'deactivated') => {
    setUnitSelectionCourse(null);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['courses'] }),
      queryClient.invalidateQueries({ queryKey: ['active-units'] }),
      queryClient.invalidateQueries({ queryKey: ['course-progress-dashboard'] }),
      queryClient.invalidateQueries({ queryKey: ['courseStatistics', user?.id] }),
    ]);
    setActiveTab('enrolled');
    toast.success(
      action === 'activated'
        ? 'Unit added to your active units.'
        : 'Unit removed from your active units. Your progress was kept.',
    );
  };

  const requestCourseUnenrollment = (course: Course) => {
    setCourseToUnenroll(course);
  };

  const unenrollFromCourse = async () => {
    if (!courseToUnenroll) return;
    const course = courseToUnenroll;
    const courseName = course.title || course.name;

    setIsUnenrolling(true);
    try {
      await courseService.unenrollFromCourse(course.id);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['courses'] }),
        queryClient.invalidateQueries({ queryKey: ['courseStatistics', user?.id] }),
        queryClient.invalidateQueries({ queryKey: ['active-units'] }),
        queryClient.invalidateQueries({ queryKey: ['course-progress-dashboard'] }),
      ]);
      toast.success(`You are unenrolled from ${courseName}. Your progress was kept.`);
      setCourseToUnenroll(null);
    } catch (error) {
      console.error('Failed to unenroll from course:', error);
      toast.error('Could not unenroll from this course.');
    } finally {
      setIsUnenrolling(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f9fa] p-4 dark:bg-slate-950 md:p-8">
      <div className="mx-auto flex max-w-7xl flex-col space-y-6">
        
        {/* Stats Grid */}
        <div className="order-1 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            icon={BookOpen}
            title="My Units"
            value={activeUnits.length}
            description="Enrolled units"
          />
          <StatCard
            icon={CheckCircle}
            title="Completed Units"
            value={completedUnitCount}
            description="Units finished"
          />
          <StatCard
            icon={TrendingUp}
            title="In Progress"
            value={ongoingUnitCount}
            description="Ongoing learning"
          />
          <StatCard
            icon={Award}
            title="Avg Score"
            value={`${courseStatistics.avgScore || 0}%`}
            description="Average topic quiz score"
          />
        </div>

        {/* Search & Tabs Header */}
        <div className="order-2 flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-col gap-3">
            <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white">Classes</h1>
            <div className="flex w-fit max-w-full items-center gap-1 overflow-x-auto rounded-full bg-slate-100 p-1 dark:bg-slate-800">
              <TabButton 
                active={activeTab === 'enrolled'} 
                onClick={() => {
                  setActiveTab('enrolled');
                  setFilters(prev => ({ ...prev, searchTerm: '' }));
                  setDebouncedSearchTerm('');
                }}
                label="My Classes"
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

          <form onSubmit={handleSearch} className="relative w-full sm:max-w-sm">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search classes"
              value={filters.searchTerm}
              onChange={e => setFilters({ ...filters, searchTerm: e.target.value })}
              className="w-full rounded-full border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-blue-950"
            />
          </form>
        </div>

        {activeTab === 'enrolled' && (
          <div className="order-4 space-y-8">
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
          <div role="alert" className="order-3 rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">
            Could not load courses: {coursesErrorDetails instanceof Error ? coursesErrorDetails.message : 'Please try again later.'}
          </div>
        ) : coursesLoading ? (
          <div className="order-3 flex flex-col items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent" />
            <p className="mt-4 text-slate-500 font-medium">Curating your courses...</p>
          </div>
        ) : (
          <div className="order-3 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
                {activeTab === 'enrolled' ? 'Enrolled classes' : activeTab === 'recommended' ? 'Recommended classes' : 'Explore classes'}
              </h2>
              <span className="text-sm text-slate-500 dark:text-slate-400">
                {(infiniteData as any)?.pages?.flatMap((page: any) => page.courses)?.length ?? 0}
              </span>
            </div>
            {(infiniteData as any)?.pages?.flatMap((p: any) => p.courses)?.length > 0 ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
                    enrolledView={activeTab === 'enrolled'}
                    onSelectCourse={openCourseUnits}

                    onUnenrollCourse={requestCourseUnenrollment}
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
          activeUnitIds={activeUnits.flatMap(unit =>
            typeof unit.unitId === 'string' && unit.isCompleted !== true
              ? [unit.unitId]
              : [],
          )}
          completedUnitIds={activeUnits.flatMap(unit =>
            typeof unit.unitId === 'string' && unit.isCompleted === true
              ? [unit.unitId]
              : [],
          )}
          onClose={() => setUnitSelectionCourse(null)}
          onComplete={handleUnitsChanged}
        />
      )}
      <Dialog
        open={Boolean(courseToUnenroll)}
        onOpenChange={open => {
          if (!open && !isUnenrolling) setCourseToUnenroll(null);
        }}
      >
        <DialogContent className="max-w-md rounded-2xl border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
          <DialogHeader className="text-left">
            <DialogTitle className="text-lg text-slate-900 dark:text-white">Unenroll from this class?</DialogTitle>
            <DialogDescription className="pt-2 leading-relaxed text-slate-600 dark:text-slate-300">
              You’ll be unenrolled from <span className="font-semibold text-slate-900 dark:text-white">{courseToUnenroll?.title || courseToUnenroll?.name}</span>.
              Your course progress will be kept, and you can enroll again later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-2 gap-2 sm:space-x-0">
            <button
              type="button"
              onClick={() => setCourseToUnenroll(null)}
              disabled={isUnenrolling}
              className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void unenrollFromCourse()}
              disabled={isUnenrolling}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-rose-600 px-4 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <LogOut className="h-4 w-4" />
              {isUnenrolling ? 'Unenrolling…' : 'Unenroll'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
    type="button"
    onClick={onClick}
    aria-pressed={active}
    className={`flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
      active
        ? 'bg-white text-blue-700 shadow-sm dark:bg-slate-700 dark:text-blue-300'
        : 'text-slate-600 hover:bg-white/70 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-700/70 dark:hover:text-white'
    }`}
  >
    <Icon className={`h-4 w-4 ${active ? 'text-blue-600 dark:text-blue-300' : 'text-slate-400'}`} />
    {label}
  </button>
);

interface StatCardProps {
  icon: LucideIcon;
  title: string;
  value: string | number;
  description?: string;
}

const StatCard = ({ icon: Icon, title, value, description }: StatCardProps) => (
  <div className="flex min-w-0 items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:px-4">
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
      <Icon className="h-4 w-4" />
    </span>
    <div className="min-w-0">
      <p className="truncate text-xs font-medium text-slate-500 dark:text-slate-400">{title}</p>
      <div className="flex items-baseline gap-2">
        <p className="text-lg font-semibold leading-tight text-slate-900 dark:text-white">{value}</p>
        {description && <p className="hidden truncate text-[11px] text-slate-500 dark:text-slate-400 sm:block">{description}</p>}
      </div>
    </div>
  </div>
);

interface CourseCardProps {
  course: Course;
  enrolledView?: boolean;
  onSelectCourse: (course: Course) => void;
  onUnenrollCourse: (course: Course) => void;
  router: ReturnType<typeof useRouter>;
  getResumePoint: (courseId: string) => unknown;
}

const CourseCard = ({
  course,
  enrolledView = false,
  onSelectCourse,
  onUnenrollCourse,
  router,
  getResumePoint,
}: CourseCardProps) => {
  const isEnrolled = Boolean(course.isEnrolled);
  const progress = Math.min(100, Math.max(0, Number(course.progressPercentage) || 0));
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

  const handleTitleClick = () => {
    if (course.unitId) {
      router.push(`/courses/${course.id}/units/${course.unitId}`);
    } else if (enrolledView) {
      onSelectCourse(course);
    } else {
      router.push(`/courses/${course.id}`);
    }
  };

  return (
    <article className="group flex min-h-[21rem] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
      <div className={`relative flex h-36 flex-col justify-between overflow-hidden bg-linear-to-br ${bannerPalettes[paletteIndex]} px-5 py-4 text-white`}>
        <BookOpen className="absolute -bottom-8 -right-4 h-36 w-36 rotate-[-12deg] text-white/10" aria-hidden="true" />
        <div className="relative flex items-start justify-between gap-3">
          <span className="rounded bg-black/15 px-2 py-1 text-xs font-medium tracking-wide text-white/90">
            {course.code || 'Course'}
          </span>
          {isEnrolled && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label={`Class options for ${courseName}`}
                  onClick={event => event.stopPropagation()}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full text-white transition-colors hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  <MoreVertical className="h-5 w-5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-48">
                <DropdownMenuItem
                  onSelect={() => void openCourse()}
                  className="cursor-pointer"
                >
                  <FolderOpen className="mr-2 h-4 w-4" />
                  Open class
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={() => onUnenrollCourse(course)}
                  className="cursor-pointer text-rose-600 focus:text-rose-700 dark:text-rose-400 dark:focus:text-rose-300"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Unenroll from class
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        <div className="relative min-w-0">
          <button
            type="button"
            onClick={handleTitleClick}
            className="block max-w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <h3 className="line-clamp-2 text-xl font-semibold leading-tight">{courseName}</h3>
          </button>
          {Math.round(progress) >= 100 && isEnrolled && (
            <span className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-emerald-100">
              <CheckCircle className="h-3.5 w-3.5" />
              Completed
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-4 p-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            <UserRound className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">{owner}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Instructor</p>
          </div>
        </div>

        {enrolledView && isEnrolled ? (
          <>
            {course.description && (
              <p className="line-clamp-2 min-h-10 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                {course.description}
              </p>
            )}
            <div className="mt-auto space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
                <span>Course progress</span>
                <span className="font-semibold">{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-1.5 bg-slate-100 dark:bg-slate-800" />
            </div>
          </>
        ) : (
          <>
            <p className="line-clamp-2 min-h-10 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              {course.description || 'Explore course units and learning materials.'}
            </p>
            {course.recommendationReason && (
              <p className="line-clamp-2 rounded-lg bg-indigo-50 px-3 py-2 text-xs text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-200">
                {course.recommendationReason}
              </p>
            )}
          </>
        )}

        <div className="mt-auto flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
          <span>{course.estimatedHours ?? 0} study hours</span>
          <span>{course.enrollmentCount ?? 0} learners</span>
          <span className="inline-flex items-center gap-1">
            {course.rating?.toFixed(1) ?? '—'}
            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 border-t border-slate-100 px-4 py-3 dark:border-slate-800">
        <button
          type="button"
          onClick={() => void openCourse()}
          className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
        >
          {isEnrolled && progress > 0 ? 'Continue learning' : isEnrolled ? 'Open class' : 'View class'}
          <ChevronRight className="h-4 w-4" />
        </button>
        {isEnrolled && (
          <button
            type="button"
            aria-label={`Open materials for ${courseName}`}
            title="Course materials"
            onClick={() => router.push(`/study-planner/materials?courseId=${encodeURIComponent(course.id)}&scope=enrolled`)}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
          >
            <Layers className="h-4 w-4" />
          </button>
        )}
      </div>
    </article>
  );
};

export default CoursesDashboard;
