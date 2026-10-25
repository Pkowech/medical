'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  BookOpen,
  Star,
  CheckCircle,
  AlertCircle,
  Search,
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
import { useAuth } from '@/features/auth/hooks/useAuth';
import { getInstructorDisplayName } from '@/lib/utils';
import {
  CourseFilter,
  Course,
} from '@/shared/types/courseInterface';
import { Progress } from '@/shared/components/ui/progress';
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
  stats: { total?: number };
  page: number;
  limit: number;
}

const displayString = (value: unknown, fallback = '') =>
  typeof value === 'string' || typeof value === 'number' ? String(value) : fallback;

export const CoursesDashboard = () => {
  const { setHeader } = usePageHeader();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'enrolled' | 'discover' | 'recommended'>(
    user?.id ? 'enrolled' : 'discover',
  );
  const [filters, setFilters] = useState<CourseFilter>({
    searchTerm: '',
    difficulty: '',
    category: '',
    status: user?.id ? 'enrolled' : 'all',
  });
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [courseToUnenroll, setCourseToUnenroll] = useState<Course | null>(null);
  const [isUnenrolling, setIsUnenrolling] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (user?.id) {
      setActiveTab(current => current === 'discover' ? current : 'enrolled');
      setFilters(current => ({
        ...current,
        status: current.status === 'all' ? 'enrolled' : current.status,
      }));
    }
  }, [user?.id]);

  const { data: progressDashboard } = useQuery({
    queryKey: ['course-progress-dashboard', user?.id],
    queryFn: () => courseService.getProgressDashboard(user!.id),
    enabled: Boolean(user?.id),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    meta: { persist: Boolean(user?.id) },
  });
  const {
    data: courseCategories = [],
    isLoading: categoriesLoading,
    isError: categoriesError,
    refetch: refetchCategories,
  } = useQuery({
    queryKey: ['course-categories'],
    queryFn: () => courseService.getCategories(),
    enabled: activeTab === 'discover',
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    meta: { persist: true },
  });
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
    refetch: refetchCourses,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
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
          id: displayString(unit.courseId),
          name: displayString(unit.courseTitle),
          title: displayString(unit.unitTitle),
          description: `Part of ${displayString(unit.courseTitle)}`,
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

  const loadedCourses = infiniteData?.pages.flatMap(page => page.courses) ?? [];
  const totalCourseCount = infiniteData?.pages[0]?.stats.total ?? loadedCourses.length;

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
    <div className="min-h-screen bg-[#f8f9fa] p-4 dark:bg-background md:p-8">
      <div className="mx-auto flex max-w-7xl flex-col space-y-6">
        
        {/* Search & Tabs Header */}
        <div className="flex flex-col justify-between gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm dark:border-border dark:bg-card sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-col gap-3">
            <h1 className="text-xl font-semibold tracking-tight text-foreground dark:text-foreground">Classes</h1>
            <div className="flex w-fit max-w-full items-center gap-1 overflow-x-auto rounded-full bg-muted p-1 dark:bg-card">
              {user && <TabButton
                active={activeTab === 'enrolled'} 
                onClick={() => {
                  setActiveTab('enrolled');
                  setFilters(prev => ({ ...prev, searchTerm: '' }));
                  setDebouncedSearchTerm('');
                }}
                label="My Classes"
                icon={BookOpen}
              />}
              <TabButton 
                active={activeTab === 'discover'} 
                onClick={() => { setActiveTab('discover'); }}
                label="Discover"
                icon={Search}
              />
              {user && <TabButton
                active={activeTab === 'recommended'} 
                onClick={() => {
                  setActiveTab('recommended');
                  setFilters(prev => ({ ...prev, searchTerm: '' }));
                  setDebouncedSearchTerm('');
                }}
                label="For You"
                icon={Star}
              />}
            </div>
            {activeTab === 'recommended' && (
              <p className="text-xs text-muted-foreground dark:text-muted-foreground ml-2 animate-in fade-in slide-in-from-left-2">
                Uses subjects from your active or completed classes, then ranks by rating and learner count. Without matching class history, it suggests popular or featured courses.
              </p>
            )}
          </div>

          <div className="flex w-full flex-col gap-2 sm:max-w-xl sm:flex-row">
            <form onSubmit={handleSearch} className="relative min-w-0 flex-1">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search classes"
                value={filters.searchTerm}
                onChange={e => setFilters({ ...filters, searchTerm: e.target.value })}
                className="w-full rounded-full border border-border bg-card py-2.5 pl-10 pr-4 text-sm text-foreground outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-border dark:bg-background dark:text-foreground dark:focus:ring-blue-950"
              />
            </form>
            {activeTab === 'discover' && (
              <div className="min-w-0 sm:w-52">
                <label className="sr-only" htmlFor="course-category-filter">Filter courses by category</label>
                <select
                  id="course-category-filter"
                  value={filters.category}
                  onChange={event => setFilters(current => ({ ...current, category: event.target.value }))}
                  disabled={categoriesLoading || categoriesError}
                  className="w-full rounded-full border border-border bg-card px-4 py-2.5 text-sm text-foreground outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-border dark:bg-background dark:text-foreground dark:focus:ring-blue-950"
                >
                  <option value="">
                    {categoriesLoading ? 'Loading categories...' : 'All categories'}
                  </option>
                  {courseCategories.map(category => (
                    <option key={category.id} value={category.id}>{category.name}</option>
                  ))}
                </select>
                {categoriesError && (
                  <p className="mt-1 flex items-center gap-1 px-3 text-xs text-destructive" role="alert">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    Categories could not be loaded.{' '}
                    <button type="button" className="underline" onClick={() => void refetchCategories()}>
                      Retry
                    </button>
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Content Grid */}
        {coursesError ? (
          <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">
            <p>
              Could not load courses: {coursesErrorDetails instanceof Error ? coursesErrorDetails.message : 'Please try again later.'}
            </p>
            <button
              type="button"
              onClick={() => void refetchCourses()}
              className="mt-3 rounded-md border border-rose-300 px-3 py-2 font-semibold hover:bg-rose-100 dark:border-rose-800 dark:hover:bg-rose-950"
            >
              Retry
            </button>
          </div>
        ) : coursesLoading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent" />
            <p className="mt-4 text-muted-foreground font-medium">Curating your courses...</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-muted-foreground dark:text-muted-foreground">
                {activeTab === 'enrolled' ? 'Enrolled classes' : activeTab === 'recommended' ? 'Recommended classes' : 'Explore classes'}
              </h2>
              <span className="text-sm text-muted-foreground dark:text-muted-foreground">
                {totalCourseCount}
              </span>
            </div>
            {!user && (
              <p className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-950 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-100">
                Browse the course catalog without an account. Sign in to enroll, access lessons, and track your progress.
              </p>
            )}
            {loadedCourses.length > 0 ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {loadedCourses.map(course => (
                  <CourseCard 
                    key={course.id}
                    course={activeTab === 'enrolled'
                      ? {
                          ...course,
                          progressPercentage: courseProgressById.get(course.id)?.progressPercentage
                            ?? course.progressPercentage
                            ?? 0,
                        }
                      : course}
                    enrolledView={activeTab === 'enrolled'}
                    onUnenrollCourse={requestCourseUnenrollment}
                    router={router}
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 bg-card dark:bg-card rounded-3xl border-2 border-dashed border-border dark:border-border">
                <div className="p-4 bg-background dark:bg-card rounded-full mb-4">
                  <AlertCircle className="w-10 h-10 text-muted-foreground" />
                </div>
                <h3 className="text-xl font-bold text-foreground dark:text-foreground">No courses found</h3>
                <p className="text-muted-foreground max-w-xs text-center mt-2">
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
                  type="button"
                  onClick={() => void fetchNextPage()}
                  disabled={isFetchingNextPage}
                  className="px-8 py-3 bg-card dark:bg-card border border-border dark:border-border rounded-2xl font-bold text-muted-foreground dark:text-muted-foreground hover:bg-background dark:hover:bg-secondary transition-all shadow-sm"
                >
                  {isFetchingNextPage ? 'Loading…' : 'Show More Courses'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      <Dialog
        open={Boolean(courseToUnenroll)}
        onOpenChange={open => {
          if (!open && !isUnenrolling) setCourseToUnenroll(null);
        }}
      >
        <DialogContent className="max-w-md rounded-2xl border-border bg-card p-6 dark:border-border dark:bg-card">
          <DialogHeader className="text-left">
            <DialogTitle className="text-lg text-foreground dark:text-foreground">Unenroll from this class?</DialogTitle>
            <DialogDescription className="pt-2 leading-relaxed text-muted-foreground dark:text-muted-foreground">
              You’ll be unenrolled from <span className="font-semibold text-foreground dark:text-foreground">{courseToUnenroll?.title || courseToUnenroll?.name}</span>.
              Your course progress will be kept, and you can enroll again later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-2 gap-2 sm:space-x-0">
            <button
              type="button"
              onClick={() => setCourseToUnenroll(null)}
              disabled={isUnenrolling}
              className="inline-flex h-10 items-center justify-center rounded-lg border border-border px-4 text-sm font-semibold text-muted-foreground transition hover:bg-background disabled:opacity-50 dark:border-border dark:text-muted-foreground dark:hover:bg-card"
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
        ? 'bg-card text-blue-700 shadow-sm dark:bg-secondary dark:text-blue-300'
        : 'text-muted-foreground hover:bg-card/70 hover:text-foreground dark:text-muted-foreground dark:hover:bg-secondary/70 dark:hover:text-foreground'
    }`}
  >
    <Icon className={`h-4 w-4 ${active ? 'text-blue-600 dark:text-blue-300' : 'text-muted-foreground'}`} />
    {label}
  </button>
);

interface CourseCardProps {
  course: Course;
  enrolledView?: boolean;
  onUnenrollCourse: (course: Course) => void;
  router: ReturnType<typeof useRouter>;
}

const CourseCard = ({
  course,
  enrolledView = false,
  onUnenrollCourse,
  router,
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

  const openCourse = () => router.push(`/courses/${encodeURIComponent(course.id)}`);

  return (
    <article className="group flex min-h-[21rem] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-shadow hover:shadow-md dark:border-border dark:bg-card">
      <div className={`relative flex h-36 flex-col justify-between overflow-hidden bg-linear-to-br ${bannerPalettes[paletteIndex]} px-5 py-4 text-white`}>
        <BookOpen className="absolute -bottom-8 -right-4 h-36 w-36 rotate-[-12deg] text-white/10" aria-hidden="true" />
        <div className="relative flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-2">
            <span className="shrink-0 rounded bg-black/15 px-2 py-1 text-xs font-medium tracking-wide text-white/90">
              {course.code || 'Course'}
            </span>
            {course.category?.name && (
              <span className="max-w-40 truncate rounded bg-black/15 px-2 py-1 text-xs font-medium text-white/90">
                {course.category.name}
              </span>
            )}
          </div>
          {isEnrolled && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label={`Class options for ${courseName}`}
                  onClick={event => event.stopPropagation()}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full text-white transition-colors hover:bg-card/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  <MoreVertical className="h-5 w-5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-48">
                <DropdownMenuItem
                  onSelect={openCourse}
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
            onClick={openCourse}
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
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground dark:bg-card dark:text-muted-foreground">
            <UserRound className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-muted-foreground dark:text-muted-foreground">{owner}</p>
            <p className="text-xs text-muted-foreground dark:text-muted-foreground">Instructor</p>
          </div>
        </div>

        {enrolledView && isEnrolled ? (
          <>
            {course.description && (
              <p className="line-clamp-2 min-h-10 text-sm leading-relaxed text-muted-foreground dark:text-muted-foreground">
                {course.description}
              </p>
            )}
            <div className="mt-auto space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground dark:text-muted-foreground">
                <span>Course progress</span>
                <span className="font-semibold">{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-1.5 bg-muted dark:bg-card" />
            </div>
          </>
        ) : (
          <>
            <p className="line-clamp-2 min-h-10 text-sm leading-relaxed text-muted-foreground dark:text-muted-foreground">
              {course.description || 'Explore course units and learning materials.'}
            </p>
            {course.recommendationReason && (
              <p className="line-clamp-2 rounded-lg bg-indigo-50 px-3 py-2 text-xs text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-200">
                {course.recommendationReason}
              </p>
            )}
          </>
        )}

        <div className="mt-auto flex items-center justify-between border-t border-border pt-3 text-xs text-muted-foreground dark:border-border dark:text-muted-foreground">
          <span>{course.estimatedHours ?? 0} study hours</span>
          <span>{course.enrollmentCount ?? 0} learners</span>
          <span className="inline-flex items-center gap-1">
            {course.rating?.toFixed(1) ?? '—'}
            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 border-t border-border px-4 py-3 dark:border-border">
        <button
          type="button"
          onClick={openCourse}
          className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
        >
          {isEnrolled ? 'Open class' : 'View class'}
          <ChevronRight className="h-4 w-4" />
        </button>
        {isEnrolled && (
          <button
            type="button"
            aria-label={`Open materials for ${courseName}`}
            title="Course materials"
            onClick={() => router.push(`/study-planner/materials?courseId=${encodeURIComponent(course.id)}&scope=enrolled`)}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-border dark:text-muted-foreground dark:hover:bg-card dark:hover:text-foreground"
          >
            <Layers className="h-4 w-4" />
          </button>
        )}
      </div>
    </article>
  );
};

export default CoursesDashboard;
