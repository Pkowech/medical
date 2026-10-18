'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, CheckCircle, ChevronRight, CircleCheck, Clock, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { courseService } from '@/features/courses/services/courseService';
import type { Course } from '@/shared/types/courseInterface';
import type { TopicProgress } from '@/shared/types/progressInterface';
import { UnitSelectionModal } from './UnitSelectionModal';
import { useAuth } from '@/features/auth/hooks/useAuth';

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
  const [showEnrollment, setShowEnrollment] = useState(false);

  const { data: course, isLoading: courseLoading, error: courseError } = useQuery<Course>({
    queryKey: ['course-overview', courseId],
    queryFn: () => courseService.getCourseById(courseId),
    enabled: Boolean(courseId),
  });
  const { data: progress } = useQuery<CourseProgress>({
    queryKey: ['course-overview-progress', courseId, user?.id],
    queryFn: () => courseService.getDetailedCourseProgress(courseId),
    enabled: Boolean(courseId && user?.id),
  });
  const { data: activeUnits = [] } = useQuery<Array<Record<string, unknown>>>({
    queryKey: ['course-overview-active-units', courseId, user?.id],
    queryFn: () => courseService.getEnrolledUnits(),
    enabled: Boolean(courseId && user?.id),
  });

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

  return (
    <main className="min-h-full bg-[#f5f7fa] px-4 py-6 dark:bg-background md:px-8 md:py-9">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="flex flex-col gap-5 border-b border-border pb-6 dark:border-border sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium text-muted-foreground dark:text-muted-foreground">
              <Link href="/courses" className="hover:text-blue-700 dark:hover:text-blue-300">Courses</Link>
              <span className="px-1">/</span> {user ? 'Units' : 'Course preview'}
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-foreground dark:text-foreground">{course.title || course.name}</h1>
            {course.description && <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground dark:text-muted-foreground">{course.description}</p>}
          </div>
          {user ? (
            <button
              type="button"
              onClick={() => setShowEnrollment(true)}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              Enroll in units
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

        <section className="space-y-5" aria-label="Course units">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-xl font-semibold text-foreground dark:text-foreground">Units</h2>
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
            const isCompleted = completedUnitIdSet.has(String(unit.id));
            const isEnrolled = enrolledUnitIds.has(String(unit.id));

            return (
              <button
                key={unit.id}
                type="button"
                onClick={() => {
                  if (!user) {
                    router.push(`/login?callbackUrl=${encodeURIComponent(`/courses/${courseId}`)}`);
                  } else if (isEnrolled) {
                    const nextTopicId = nextTopicByUnitId.get(String(unit.id));
                    router.push(
                      `/courses/${courseId}/units/${unit.id}${
                        nextTopicId ? `?topicId=${encodeURIComponent(nextTopicId)}` : ''
                      }`,
                    );
                  } else {
                    setShowEnrollment(true);
                  }
                }}
                className="group flex min-h-85 flex-col overflow-hidden rounded-lg border border-border bg-card text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md dark:border-border dark:bg-card"
              >
                <span className={`relative flex min-h-36 flex-col justify-between overflow-hidden p-5 text-white ${UNIT_HEADER_COLORS[index % UNIT_HEADER_COLORS.length]}`}>
                  <span aria-hidden="true" className="pointer-events-none absolute -right-7 -top-10 h-36 w-36 rounded-full border-18 border-white/10" />
                  <span className="relative flex items-center justify-between gap-3">
                    <span className="text-xs font-semibold uppercase text-white/75">Unit {String(index + 1).padStart(2, '0')}</span>
                    {isEnrolled && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-black/15 px-2.5 py-1 text-xs font-medium text-white">
                        <CircleCheck className="h-3.5 w-3.5" /> {isCompleted ? 'Completed' : 'Active'}
                      </span>
                    )}
                  </span>
                  <span className="relative block pr-8 text-xl font-semibold leading-7 line-clamp-2">
                    {unit.title || unit.name}
                  </span>
                </span>
                <span className="flex flex-1 flex-col p-5">
                  <span className="line-clamp-2 min-h-10 text-sm leading-5 text-muted-foreground dark:text-muted-foreground">
                    {unit.description || 'Continue through the topics and resources in this unit.'}
                  </span>
                  <span className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground dark:text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <BookOpen className="h-4 w-4" /> {topics.length} topics
                    </span>
                    {unit.estimatedMinutes != null && unit.estimatedMinutes > 0 && (
                      <span className="inline-flex items-center gap-1.5">
                        <Clock className="h-4 w-4" /> {unit.estimatedMinutes} min
                      </span>
                    )}
                  </span>
                  <span className="mt-auto pt-6">
                    <span className="flex items-center justify-between gap-3 text-xs text-muted-foreground dark:text-muted-foreground">
                      <span>
                        {user
                          ? percentage === 100 ? 'Unit completed' : `${completedTopics} of ${topics.length} topics complete`
                          : `${topics.length} topics`}
                      </span>
                      {user && percentage === 100 && <CheckCircle className="h-4 w-4 text-emerald-600" />}
                    </span>
                    <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-muted dark:bg-card">
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
                              : 'Enroll unit'}
                      </span>
                      <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </span>
                </span>
              </button>
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