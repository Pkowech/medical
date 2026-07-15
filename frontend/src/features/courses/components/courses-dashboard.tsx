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
} from 'lucide-react';
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
  type QueryFunctionContext,
  type InfiniteData,
} from '@tanstack/react-query';
import { usePageHeader } from '@/core/providers/HeaderContext';
import { apiService } from '@/features/auth/services/apiClient';
import { courseService } from '@/features/courses/services/courseService';
import { toast } from 'sonner';
import { useStudy } from '@/features/learning-management/study/hooks/useStudy';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { handleUnknownError } from '@/app/services/error.service';
import {
  CourseFilter,
  CourseStatistics,
  FtsSearchResult,
  FtsSearchResponse,
  Course,
} from '@/shared/types/courseInterface';
import { Progress } from '@/shared/components/ui/progress';

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
  const router = useRouter();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const searchTerm = filters.searchTerm.trim();
    setDebouncedSearchTerm(searchTerm);
    if (searchTerm.length > 0 && activeTab === 'enrolled') {
      setActiveTab('discover'); // Switch to discover when searching if in enrolled tab
    }
  };

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
      
      const isSearching = debouncedSearchTerm.length >= 2;
      
      if (isSearching) {
        try {
          const response = await apiService.get<FtsSearchResponse>(
            `/search?query=${encodeURIComponent(debouncedSearchTerm)}&type=course&limit=100&page=1`
          );
          const ftsResults = response.data.results || [];
          const courses = (ftsResults as Array<Partial<FtsSearchResult & Course>>).map(
            partial =>
              ({
                id: partial.id || '',
                title: partial.title || '',
                description: partial.description || '',
                difficulty: (partial.difficulty as Course['difficulty']) || 'beginner',
                estimatedHours: partial.estimatedHours ?? 0,
                enrollmentCount: partial.enrollmentCount ?? 0,
                rating: partial.rating ?? 0,
                category: (partial.category as Course['category']) || undefined,
                code: partial.code || undefined,
                isEnrolled: partial.isEnrolled ?? false,
              }) as Course
          );

          let filtered = courses;
          if (filters.difficulty) {
            filtered = filtered.filter(c => c.difficulty === filters.difficulty);
          }

          return {
            courses: filtered,
            stats: { total: response.data.total },
            page: pageNum,
            limit: pageSize,
          };
        } catch (error) {
          console.warn('FTS search failed', error);
        }
      }

      if (filters.status === 'recommended') {
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
          difficulty: (filters.difficulty as "beginner" | "intermediate" | "advanced" | "expert") || undefined,
          categoryId: filters.category,
        });
      } else {
        raw = await courseService.getEnrolledUnits();
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

  const enrollInCourse = async (courseId: string) => {
    try {
      await courseService.enrollInCourse(courseId);
      toast.success('Successfully enrolled!');
      
      // Invalidate relevant queries to refresh data
      await queryClient.invalidateQueries({ queryKey: ['courses'] });
      await queryClient.invalidateQueries({ queryKey: ['courseStatistics'] });
      
      // Optional: Switch to enrolled tab to show the newly enrolled course
      setActiveTab('enrolled');
    } catch (error: unknown) {
      let message = 'Failed to enroll';
      if (typeof error === 'object' && error !== null && 'message' in error) {
        message = String((error as Record<string, unknown>).message);
      }
      handleUnknownError(error, `/courses/${courseId}/enroll`);
      toast.error(message);
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
            value={courseStatistics.totalEnrolled}
            gradient="from-blue-500 to-indigo-600"
            description="Active enrollments"
          />
          <StatCard
            icon={CheckCircle}
            title="Completed"
            value={courseStatistics.completed}
            gradient="from-emerald-500 to-teal-600"
            description="Course achievements"
          />
          <StatCard
            icon={TrendingUp}
            title="In Progress"
            value={courseStatistics.inProgress}
            gradient="from-amber-500 to-orange-600"
            description="Ongoing learning"
          />
          <StatCard
            icon={Award}
            title="Avg Score"
            value={`${courseStatistics.avgScore || 0}%`}
            gradient="from-rose-500 to-pink-600"
            description="Overall performance"
          />
        </div>

        {/* Search & Tabs Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-700">
          <div className="flex flex-col gap-4 flex-1">
            <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-900 rounded-2xl w-fit">
              <TabButton 
                active={activeTab === 'enrolled'} 
                onClick={() => { setActiveTab('enrolled'); setDebouncedSearchTerm(''); }}
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
                onClick={() => { setActiveTab('recommended'); setDebouncedSearchTerm(''); }}
                label="For You"
                icon={Star}
              />
            </div>
            {activeTab === 'recommended' && (
              <p className="text-xs text-slate-500 dark:text-slate-400 ml-2 animate-in fade-in slide-in-from-left-2">
                ✨ Curated courses based on your <span className="font-bold text-blue-600 dark:text-blue-400">{user?.specialization || 'Career Path'}</span> specialization and level.
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

        {/* Content Grid */}
        {coursesLoading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent" />
            <p className="mt-4 text-slate-500 font-medium">Curating your courses...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {(infiniteData as any)?.pages?.flatMap((p: any) => p.courses)?.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {(infiniteData as any).pages.flatMap((p: any) => p.courses).map((course: any) => (
                  <CourseCard 
                    key={course.id} 
                    course={course} 
                    onEnroll={enrollInCourse}
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
  onEnroll: (courseId: string) => Promise<void>;
  router: ReturnType<typeof useRouter>;
  getResumePoint: (courseId: string) => unknown;
}

const CourseCard = ({ course, onEnroll, router, getResumePoint }: CourseCardProps) => {
  const isEnrolled = course.isEnrolled;
  const progress = course.progressPercentage ?? 0;

  return (
    <div 
      onClick={() => {
        if (course.unitId) {
           router.push(`/courses/${course.id}/units/${course.unitId}`);
        } else {
           router.push(`/courses/${course.id}`);
        }
      }}
      className="group bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 overflow-hidden shadow-sm hover:shadow-2xl hover:-translate-y-1 transition-all cursor-pointer"
    >
      <div className={`h-40 bg-linear-to-br ${isEnrolled ? 'from-blue-600 to-indigo-700' : 'from-slate-700 to-slate-900'} p-6 flex flex-col justify-between relative`}>
        <div className="flex justify-between items-start">
          <span className="px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-white text-[10px] font-bold uppercase tracking-widest border border-white/20">
            {course.difficulty}
          </span>
          {isEnrolled && (
            <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center shadow-lg">
              <CheckCircle className="w-5 h-5 text-white" />
            </div>
          )}
        </div>
        <div>
          <h3 className="text-xl font-black text-white leading-tight line-clamp-2">{course.title}</h3>
          <p className="text-white/70 text-xs font-mono mt-1">{course.code}</p>
        </div>
      </div>

      <div className="p-6 space-y-4">
        <p className="text-slate-600 dark:text-slate-400 text-sm line-clamp-2 min-h-[40px]">
          {course.description}
        </p>

        {isEnrolled && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-bold text-slate-500">
              <span>Progress</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2 bg-slate-100 dark:bg-slate-900" />
          </div>
        )}

        <div className="flex items-center justify-between py-3 border-y border-slate-50 dark:border-slate-700/50">
          <div className="flex flex-col items-center">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Hours</span>
            <span className="text-sm font-black text-slate-700 dark:text-slate-200">{course.estimatedHours}h</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Students</span>
            <span className="text-sm font-black text-slate-700 dark:text-slate-200">{course.enrollmentCount}</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Rating</span>
            <span className="text-sm font-black text-slate-700 dark:text-slate-200 flex items-center gap-0.5">
              {course.rating?.toFixed(1)}
              <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
            </span>
          </div>
        </div>

        {!isEnrolled ? (
          <button
            onClick={(e) => { e.stopPropagation(); onEnroll(course.id); }}
            className="w-full py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl font-black text-sm hover:scale-105 transition-transform"
          >
            Enroll in Course
          </button>
        ) : (
          <button
            onClick={async (e) => {
              e.stopPropagation();
              if (course.unitId) {
                if (course.nextTopicId) {
                  router.push(`/courses/${course.id}/units/${course.unitId}/topics/${course.nextTopicId}`);
                } else {
                  // If no next topic, go to the unit overview page
                  router.push(`/courses/${course.id}/units/${course.unitId}`);
                }
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
            {progress === 0 ? 'Start Unit' : 'Continue Path'}
          </button>
        )}
      </div>
    </div>
  );
};

export default CoursesDashboard;
