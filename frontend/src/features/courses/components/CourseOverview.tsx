'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, CheckCircle, ChevronRight, Circle, CircleCheck, Clock, PlayCircle, Plus, Sparkles } from 'lucide-react';
import { apiService } from '@/features/auth/services/apiClient';
import { toast } from 'sonner';
import { courseService } from '@/features/courses/services/courseService';
import type { Course } from '@/shared/types/courseInterface';
import type { TopicProgress } from '@/shared/types/progressInterface';
import { UnitSelectionModal } from './UnitSelectionModal';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { usePageHeader } from '@/core/providers/HeaderContext';

type CourseProgress = {
  topicProgress?: Array<TopicProgress & { topicId?: string }>;
};

const UNIT_HEADER_COLORS = [
  'bg-[#536f7b]',
  'bg-[#3568c4]',
  'bg-[#39766e]',
  'bg-[#765c4d]',
];

export function CourseOverview() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { courseId } = useParams<{ courseId: string }>();
  const { user } = useAuth();
  const { setHeader } = usePageHeader();
  const [showEnrollment, setShowEnrollment] = useState(false);

  const { data: course, isLoading: courseLoading, error: courseError } = useQuery<Course>({
    queryKey: ['course-overview', courseId],
    queryFn: () => courseService.getCourseById(courseId),
    enabled: Boolean(courseId),
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    meta: { persist: Boolean(user?.id) },
  });
  const { data: progress } = useQuery<CourseProgress>({
    queryKey: ['course-overview-progress', courseId, user?.id],
    queryFn: () => courseService.getDetailedCourseProgress(courseId),
    enabled: Boolean(course && !courseError && user?.id),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    meta: { persist: Boolean(user?.id) },
  });
  const { data: connectedPaths = [] } = useQuery<Array<{ id: string; title: string; specialization?: string; pathType?: string }>>({
    queryKey: ['course-connected-paths', courseId],
    queryFn: async () => {
      try {
        const response = await apiService.get<any>(`/learning-paths/by-course/${courseId}`);
        const d = response.data?.data || response.data || [];
        return Array.isArray(d) ? d : [];
      } catch {
        return [];
      }
    },
    enabled: Boolean(courseId),
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    meta: { persist: Boolean(user?.id) },
  });

  const { data: activeUnits = [] } = useQuery<Array<Record<string, unknown>>>({
    queryKey: ['course-overview-active-units', courseId, user?.id],
    queryFn: () => courseService.getEnrolledUnits(),
    enabled: Boolean(courseId && user?.id),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    meta: { persist: Boolean(user?.id) },
  });

  useEffect(() => {
    if (!course) return;
    setHeader({ title: course.title || course.name, presentation: 'compact' });
    return () => setHeader(null);
  }, [course, setHeader]);

  if (courseLoading) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading course units...</div>;
  }

  if (courseError || !course) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 text-center text-red-600">
        <p>Unable to load this course.</p>
        <Link href="/courses" className="text-sm font-medium text-blue-700 hover:underline dark:text-blue-300">
          Back to all courses
        </Link>
      </main>
    );
  }

  const topicProgress = new Map(
    (progress?.topicProgress || []).map(item => [String(item.topicId), item]),
  );
  const activeUnitIds = new Set(activeUnits.flatMap(unit =>
    (typeof unit.unitId === 'string' || typeof unit.unitId === 'number')
      && unit.isCompleted !== true
      ? [String(unit.unitId)]
      : [],
  ));
  const completedUnitIds = activeUnits.flatMap(unit =>
    (typeof unit.unitId === 'string' || typeof unit.unitId === 'number')
      && unit.isCompleted === true
      ? [String(unit.unitId)]
      : [],
  );
  const completedUnitIdSet = new Set(completedUnitIds);
  const enrolledUnitIds = new Set([...activeUnitIds, ...completedUnitIdSet]);
  const nextTopicByUnitId = new Map(activeUnits.flatMap(unit =>
    (typeof unit.unitId === 'string' || typeof unit.unitId === 'number')
      && (typeof unit.nextTopicId === 'string' || typeof unit.nextTopicId === 'number')
      ? [[String(unit.unitId), String(unit.nextTopicId)]]
      : [],
  ));
  const units = course.units || [];
  const allUnitsEnrolled = Boolean(
    user && units.length > 0 && units.every(unit => enrolledUnitIds.has(String(unit.id))),
  );

  return (
    <main className="min-h-full bg-[#f5f7fa] px-4 py-6 dark:bg-background md:px-8 md:py-9">
      <div className="mx-auto max-w-7xl space-y-8">
        {!allUnitsEnrolled && (
          <header className="flex flex-col gap-5 border-b border-border pb-6 dark:border-border sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <h1 className="mt-2 text-3xl font-semibold text-foreground dark:text-foreground">{course.title || course.name}</h1>
              {course.description && <p className="mt-2 max-w-3xl text-sm leading-6 text-foreground/75 dark:text-foreground/75">{course.description}</p>}
              {connectedPaths.length > 0 && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                    <Sparkles className="h-3.5 w-3.5 text-blue-500" /> Part of Curricula:
                  </span>
                  {connectedPaths.map((p) => (
                    <Link
                      key={p.id}
                      href={`/learning-paths/${p.id}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors"
                    >
                      <BookOpen className="h-3 w-3" />
                      <span>{p.title}</span>
                      <ChevronRight className="h-3 w-3 opacity-60" />
                    </Link>
                  ))}
                </div>
              )}
            </div>
            {user ? (
              <button
                type="button"
                onClick={() => setShowEnrollment(true)}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
              >
                <Plus className="h-4 w-4" />
                Choose units
              </button>
            ) : (
              <Link
                href={`/login?callbackUrl=${encodeURIComponent(`/courses/${courseId}`)}`}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
              >
                Sign in to enroll
              </Link>
            )}
          </header>
        )}

        <section className="space-y-5" aria-label="Course units">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-xl font-semibold text-foreground dark:text-foreground">Learning roadmap</h2>
              <p className="mt-1 text-sm text-muted-foreground dark:text-muted-foreground">{units.length} learning units</p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {units.map((unit, index) => {
            const topics = unit.topics || [];
            const completedTopics = topics.filter(topic => {
              const item = topicProgress.get(String(topic.id));
              return Boolean(item?.isCompleted || item?.status === 'completed' || topic.isCompleted);
            }).length;
            const percentage = topics.length ? Math.round((completedTopics / topics.length) * 100) : 0;
            const isActive = activeUnitIds.has(String(unit.id));
            const isCompleted = completedUnitIdSet.has(String(unit.id)) ||
              (topics.length > 0 && completedTopics === topics.length);
            const isInProgress = isActive && !isCompleted;
            const statusLabel = isCompleted ? 'Completed' : isInProgress ? 'Ongoing' : 'Not enrolled';
            const StatusIcon = isCompleted ? CircleCheck : isInProgress ? PlayCircle : Circle;
            const isEnrolled = enrolledUnitIds.has(String(unit.id)) || isCompleted;
            const matchesCourse = String(unit.courseId) === String(courseId);
            const estimatedMinutes = unit.estimatedMinutes;
            const estimatedTimeLabel = estimatedMinutes == null || estimatedMinutes <= 0
              ? null
              : estimatedMinutes >= 60
                ? `${Number((estimatedMinutes / 60).toFixed(1))} hrs`
                : `${estimatedMinutes} min`;

            return (
              <details
                key={unit.id}
                open={Boolean(matchesCourse || isEnrolled || isActive || isCompleted)}
                className="group block min-h-80 overflow-hidden rounded-lg border border-border bg-card text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-border dark:bg-card"
              >
                <summary className="hidden" aria-label={`${unit.title || unit.name}, ${statusLabel}, ${completedTopics} of ${topics.length} topics complete`} />
                <button
                  type="button"
                  aria-label={`${unit.title || unit.name}, ${statusLabel}, ${completedTopics} of ${topics.length} topics complete`}
                  onClick={() => {
                    if (!user) {
                      router.push(`/login?callbackUrl=${encodeURIComponent(`/courses/${courseId}`)}`);
                    } else if (isEnrolled) {
                      router.push(`/courses/${courseId}/units/${unit.id}`);
                    } else {
                      setShowEnrollment(true);
                    }
                  }}
                  className="flex min-h-80 w-full flex-col overflow-hidden text-left"
                >
                <span className={`relative flex flex-col gap-3 overflow-hidden p-5 text-white ${UNIT_HEADER_COLORS[index % UNIT_HEADER_COLORS.length]}`}>
                  <span className="relative flex items-center justify-between gap-3">
                    <span className="text-sm font-bold uppercase text-white/90">Unit {String(index + 1).padStart(2, '0')}</span>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-black/15 px-2.5 py-1 text-xs font-medium text-white" aria-label={`Unit status: ${statusLabel}`}>
                      <StatusIcon aria-hidden="true" className="h-3.5 w-3.5" />
                      {statusLabel}
                    </span>
                  </span>
                  <span className="relative block pr-8">
                    <span className="block text-xl font-semibold leading-7 line-clamp-2">
                      {unit.title || unit.name}
                    </span>
                    <span className="mt-2 block text-sm leading-5 text-white/80 line-clamp-3">
                      {unit.description || 'Continue through the topics and resources in this unit.'}
                    </span>
                  </span>
                </span>
                <span className="flex flex-1 flex-col p-5">
                  <span className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground dark:text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <BookOpen className="h-4 w-4" /> {topics.length} topics
                    </span>
                    {estimatedTimeLabel && (
                      <span className="inline-flex items-center gap-1.5">
                        <Clock className="h-4 w-4" /> {estimatedTimeLabel}
                      </span>
                    )}
                  </span>
                  <span className="mt-auto pt-6">
                    <span className="flex items-center justify-between gap-3 text-xs text-muted-foreground dark:text-muted-foreground">
                      <span className="font-medium">
                        {user ? `${completedTopics}/${topics.length} topics` : `${topics.length} topics`}
                      </span>
                      {user && isCompleted && <CheckCircle aria-hidden="true" className="h-4 w-4 text-emerald-600" />}
                    </span>
                    <span
                      className="mt-2 block h-2 overflow-hidden rounded-full bg-muted dark:bg-card"
                      role="progressbar"
                      aria-label={`${unit.title || unit.name} progress`}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={percentage}
                    >
                      <span className="block h-full rounded-full bg-blue-600 transition-[width]" style={{ width: `${percentage}%` }} />
                    </span>
                    <span className="mt-4 flex items-center justify-between border-t border-border pt-3 text-sm font-semibold text-blue-700 dark:border-border dark:text-blue-300">
                      <span>
                        {!user
                          ? 'Sign in to access'
                          : isCompleted
                            ? 'Review unit'
                            : isActive
                              ? 'Continue unit'
                              : 'Choose unit'}
                      </span>
                      <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </span>
                </span>
                </button>
              </details>
            );
          })}
          </div>
        </section>
      </div>
      {showEnrollment && (
        <UnitSelectionModal
          course={course}
          activeUnitIds={Array.from(activeUnitIds)}
          completedUnitIds={completedUnitIds}
          onClose={() => setShowEnrollment(false)}
          onComplete={(action) => {
            setShowEnrollment(false);
            void Promise.all([
              queryClient.invalidateQueries({ queryKey: ['course-overview-active-units', courseId] }),
              queryClient.invalidateQueries({ queryKey: ['active-units'] }),
              queryClient.invalidateQueries({ queryKey: ['course-progress-dashboard'] }),
              queryClient.invalidateQueries({ queryKey: ['courseStatistics', user?.id] }),
              queryClient.invalidateQueries({ queryKey: ['courses'] }),
            ]);
            toast.success(
              action === 'activated'
                ? 'Unit added to your active units.'
                : 'Unit removed from your active units. Your progress was kept.',
            );
          }}
        />
      )}
    </main>
  );
}