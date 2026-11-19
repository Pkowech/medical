'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, CalendarClock, ChevronRight, Circle, CircleCheck, Clock, PlayCircle, Plus, Sparkles, Target } from 'lucide-react';
import { apiService } from '@/features/auth/services/apiClient';
import { toast } from 'sonner';
import { courseService } from '@/features/courses/services/courseService';
import scheduleService from '@/features/learning-management/study/services/scheduleService';
import { GoalCreationWizard } from '@/features/learning-management/components/goals/goal-creation-wizard';
import type { Course } from '@/shared/types/courseInterface';
import type { TopicProgress } from '@/shared/types/progressInterface';
import { UnitSelectionModal } from './UnitSelectionModal';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { usePageHeader } from '@/core/providers/HeaderContext';
import { Button } from '@/shared/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';

const localDateTimeValue = (date: Date) => {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 16);
};

type CourseProgress = {
  topicProgress?: Array<TopicProgress & { topicId?: string }>;
};

export function CourseOverview() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { courseId } = useParams<{ courseId: string }>();
  const { user } = useAuth();
  const { setHeader } = usePageHeader();
  const [showEnrollment, setShowEnrollment] = useState(false);
  const [showGoalWizard, setShowGoalWizard] = useState(false);
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [isScheduling, setIsScheduling] = useState(false);
  const [scheduledStart, setScheduledStart] = useState(() => {
    const nextHour = new Date();
    nextHour.setMinutes(0, 0, 0);
    nextHour.setHours(nextHour.getHours() + 1);
    if (nextHour.getHours() >= 22) {
      nextHour.setDate(nextHour.getDate() + 1);
      nextHour.setHours(9);
    }
    return localDateTimeValue(nextHour);
  });

  const {
    data: course,
    isLoading: courseLoading,
    isFetching: courseFetching,
    error: courseError,
    refetch: refetchCourse,
  } = useQuery<Course>({
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
  const {
    data: connectedPaths = [],
    isError: connectedPathsError,
    refetch: refetchConnectedPaths,
  } = useQuery<Array<{ id: string; title: string; specialization?: string; pathType?: string }>>({
    queryKey: ['course-connected-paths', courseId],
    queryFn: async () => {
      const response = await apiService.get<unknown>(`/learning-paths/by-course/${courseId}`);
      let payload: unknown = response.data;
      for (let depth = 0; depth < 3; depth += 1) {
        if (Array.isArray(payload)) return payload as Array<{ id: string; title: string; specialization?: string; pathType?: string }>;
        if (!payload || typeof payload !== 'object' || !('data' in payload)) break;
        payload = payload.data;
      }
      if (!Array.isArray(payload)) {
        throw new Error('The course learning paths response was invalid.');
      }
      return payload as Array<{ id: string; title: string; specialization?: string; pathType?: string }>;
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
    return <div role="status" className="flex min-h-screen items-center justify-center text-muted-foreground">Loading course details...</div>;
  }

  if (courseError || !course) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 text-center">
        <p role="alert" className="text-red-600">Unable to load this course.</p>
        <Button
          type="button"
          variant="outline"
          onClick={() => void refetchCourse()}
          disabled={!courseId || courseFetching}
        >
          {courseFetching ? 'Retrying...' : 'Try again'}
        </Button>
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
  const continueUnit = units.find(unit => activeUnitIds.has(String(unit.id)));
  const completedUnit = units.find(unit => completedUnitIdSet.has(String(unit.id)));
  const allUnitsCompleted = units.length > 0
    && units.every(unit => completedUnitIdSet.has(String(unit.id)));
  const continueTopicId = continueUnit
    ? nextTopicByUnitId.get(String(continueUnit.id))
    : undefined;
  const openUnit = (unitId: string | number, topicId?: string) => {
    const topicQuery = topicId ? `?topicId=${encodeURIComponent(topicId)}` : '';
    router.push(`/courses/${encodeURIComponent(courseId)}/units/${encodeURIComponent(String(unitId))}${topicQuery}`);
  };
  const scheduleCourseStudy = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const startDate = new Date(scheduledStart);
    if (Number.isNaN(startDate.getTime()) || startDate <= new Date()) {
      toast.error('Choose a future date and time for this study session.');
      return;
    }
    setIsScheduling(true);
    try {
      await scheduleService.createEvent({
        title: `Study: ${course.title || course.name}`,
        description: `Study session for ${course.title || course.name}. [courseId:${course.id}]`,
        date: startDate,
        endDate: new Date(startDate.getTime() + 45 * 60 * 1000),
        type: 'study',
        location: 'Study Planner',
      });
      await queryClient.invalidateQueries({ queryKey: ['course-roadmap-schedule', user?.id, course.id] });
      toast.success('Study session added to your schedule.');
      setShowScheduleDialog(false);
    } catch (error) {
      console.error('Could not schedule course study session:', error);
      toast.error(error instanceof Error ? error.message : 'Could not add this session to your schedule.');
    } finally {
      setIsScheduling(false);
    }
  };

  return (
    <main className="min-h-full bg-[#f5f7fa] px-4 py-6 dark:bg-background md:px-8 md:py-9">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="flex flex-col gap-5 border-b border-border pb-6 dark:border-border sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h1 className="mt-2 text-3xl font-semibold text-foreground dark:text-foreground">{course.title || course.name}</h1>
            {course.description && <p className="mt-2 max-w-3xl text-sm leading-6 text-foreground/75 dark:text-foreground/75">{course.description}</p>}
            {connectedPathsError ? (
              <p role="alert" className="mt-3 text-sm text-rose-700 dark:text-rose-300">
                Course learning paths could not be loaded.{' '}
                <button type="button" className="font-medium underline" onClick={() => void refetchConnectedPaths()}>
                  Retry
                </button>
              </p>
            ) : connectedPaths.length > 0 && (
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
          {units.length > 0 && (
            <div className="flex shrink-0 flex-wrap gap-2">
              {user ? (
                <>
                  {continueUnit ? (
                    <Button type="button" onClick={() => openUnit(continueUnit.id, continueTopicId)}>
                      <PlayCircle aria-hidden="true" className="mr-2 h-4 w-4" />
                      Continue studying
                    </Button>
                  ) : allUnitsCompleted && completedUnit ? (
                    <Button type="button" onClick={() => openUnit(completedUnit.id)}>
                      <BookOpen aria-hidden="true" className="mr-2 h-4 w-4" />
                      Review course
                    </Button>
                  ) : (
                    <Button type="button" onClick={() => setShowEnrollment(true)}>
                      <PlayCircle aria-hidden="true" className="mr-2 h-4 w-4" />
                      Start studying
                    </Button>
                  )}
                  <Button type="button" variant="outline" onClick={() => setShowEnrollment(true)}>
                    <Plus aria-hidden="true" className="mr-2 h-4 w-4" />
                    {allUnitsEnrolled ? 'Manage units' : 'Choose units'}
                  </Button>
                </>
              ) : (
                <Link
                  href={`/login?callbackUrl=${encodeURIComponent(`/courses/${courseId}`)}`}
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
                >
                  <PlayCircle aria-hidden="true" className="h-4 w-4" />
                  Sign in to start learning
                </Link>
              )}
            </div>
          )}
        </header>

        <section className="space-y-5" aria-label="Course units">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-xl font-semibold text-foreground dark:text-foreground">Learning roadmap</h2>
              <p className="mt-1 text-sm text-muted-foreground dark:text-muted-foreground">{units.length} learning units</p>
            </div>
          </div>
          {units.length === 0 ? (
            <div role="status" className="rounded-xl border border-dashed border-border bg-card px-5 py-10 text-center dark:border-border dark:bg-card">
              <h3 className="font-semibold text-foreground">No learning units available</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                There are no learning units in this course yet. Check back later or browse other courses.
              </p>
              <Link href="/courses" className="mt-4 inline-block text-sm font-medium text-blue-700 hover:underline dark:text-blue-300">
                Browse courses
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {units.map((unit, index) => {
            const topics = unit.topics || [];
            const completedTopics = topics.filter(topic => {
              const item = topicProgress.get(String(topic.id));
              return item?.masteryUnlocked === true;
            }).length;
            const percentage = topics.length ? Math.round((completedTopics / topics.length) * 100) : 0;
            const isActive = activeUnitIds.has(String(unit.id));
            const isCompleted = topics.length > 0
              ? completedTopics === topics.length
              : completedUnitIdSet.has(String(unit.id));
            const isInProgress =
              (isActive || completedUnitIdSet.has(String(unit.id))) && !isCompleted;
            const statusLabel = isCompleted ? 'Completed' : isInProgress ? 'Ongoing' : 'Not enrolled';
            const StatusIcon = isCompleted ? CircleCheck : isInProgress ? PlayCircle : Circle;
            const isEnrolled = enrolledUnitIds.has(String(unit.id)) || isCompleted;
            const estimatedMinutes = unit.estimatedMinutes;
            const estimatedTimeLabel = estimatedMinutes == null || estimatedMinutes <= 0
              ? null
              : estimatedMinutes >= 60
                ? `${Number((estimatedMinutes / 60).toFixed(1))} hrs`
                : `${estimatedMinutes} min`;

            const handleOpenUnit = () => {
              if (!user) {
                router.push(`/login?callbackUrl=${encodeURIComponent(`/courses/${courseId}`)}`);
              } else if (isEnrolled) {
                openUnit(unit.id, isActive ? nextTopicByUnitId.get(String(unit.id)) : undefined);
              } else {
                setShowEnrollment(true);
              }
            };

            return (
              <article
                key={unit.id}
                className="flex min-h-72 flex-col rounded-xl border border-border bg-card p-5 shadow-sm transition-colors hover:border-primary/40 hover:shadow-md"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Unit {String(index + 1).padStart(2, '0')}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                      isCompleted
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                        : isInProgress
                          ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
                          : 'bg-muted text-muted-foreground'
                    }`}
                    aria-label={`Unit status: ${statusLabel}`}
                  >
                    <StatusIcon aria-hidden="true" className="h-3.5 w-3.5" />
                    {statusLabel}
                  </span>
                </div>
                <h3 className="mt-4 text-lg font-semibold leading-6 text-foreground">
                  {unit.title || unit.name}
                </h3>
                <p className="mt-2 line-clamp-3 text-sm leading-6 text-muted-foreground">
                  {unit.description || 'Continue through the topics and resources in this unit.'}
                </p>

                <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <BookOpen aria-hidden="true" className="h-4 w-4" />
                    {topics.length} topics
                  </span>
                  {estimatedTimeLabel && (
                    <span className="inline-flex items-center gap-1.5">
                      <Clock aria-hidden="true" className="h-4 w-4" />
                      {estimatedTimeLabel}
                    </span>
                  )}
                  {course.difficulty && (
                    <span className="rounded-full bg-muted px-2.5 py-1 text-xs capitalize text-foreground">
                      {course.difficulty}
                    </span>
                  )}
                </div>

                <div className="mt-auto pt-6">
                  <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
                    <span>{user ? `${completedTopics} of ${topics.length} topics completed` : `${topics.length} topics`}</span>
                    <span className="font-semibold text-foreground">{percentage}%</span>
                  </div>
                  <div
                    className="mt-2 h-2 overflow-hidden rounded-full bg-muted"
                    role="progressbar"
                    aria-label={`${unit.title || unit.name} progress`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={percentage}
                  >
                    <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${percentage}%` }} />
                  </div>
                  <button
                    type="button"
                    onClick={handleOpenUnit}
                    className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                  >
                    {!user
                      ? 'Sign in to access'
                      : isCompleted
                        ? 'Review unit'
                        : isActive
                          ? 'Continue unit'
                          : 'Choose unit'}
                    <ChevronRight aria-hidden="true" className="h-4 w-4" />
                  </button>
                </div>
              </article>
            );
          })}
          </div>
          )}
        </section>
        {user && (
          <section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Plan this course</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Set a course-specific learning goal or add focused study time to your planner.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => setShowGoalWizard(true)}>
                <Target aria-hidden="true" className="mr-2 h-4 w-4" />
                Set course goal
              </Button>
              <Button type="button" onClick={() => setShowScheduleDialog(true)}>
                <CalendarClock aria-hidden="true" className="mr-2 h-4 w-4" />
                Schedule study
              </Button>
            </div>
          </section>
        )}
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
      <GoalCreationWizard
        isOpen={showGoalWizard}
        onClose={() => setShowGoalWizard(false)}
        initialData={{ courseId: course.id }}
        onGoalCreated={() => {
          setShowGoalWizard(false);
          void queryClient.invalidateQueries({ queryKey: ['course-roadmap-goals', user?.id, course.id] });
          toast.success('Course goal created.');
        }}
      />
      <Dialog
        open={showScheduleDialog}
        onOpenChange={open => {
          if (!open && !isScheduling) setShowScheduleDialog(false);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule course study</DialogTitle>
            <DialogDescription>
              Add a 45-minute study session for {course.title || course.name}.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={scheduleCourseStudy} className="space-y-4">
            <label htmlFor="course-study-start" className="block text-sm font-medium text-foreground">
              Start date and time
            </label>
            <input
              id="course-study-start"
              type="datetime-local"
              required
              min={localDateTimeValue(new Date())}
              value={scheduledStart}
              onChange={event => setScheduledStart(event.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowScheduleDialog(false)} disabled={isScheduling}>
                Cancel
              </Button>
              <Button type="submit" disabled={isScheduling}>
                {isScheduling ? 'Scheduling…' : 'Add to schedule'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </main>
  );
}