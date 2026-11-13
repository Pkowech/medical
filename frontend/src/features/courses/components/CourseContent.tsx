// next/link removed — not used in this component
import {
  Clock,
  CheckCircle,
  FileText,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  EyeOff,
  PlayCircle,
  XCircle,
  Circle,
  Lock,
  MoreHorizontal,
} from 'lucide-react';
import { useXapi } from '@/lib/xapi/useXapi';
import { URLS } from '@/lib/urls';
import { useEffect, useRef } from 'react';
import { VideoPlayer } from './VideoPlayer';
import type { CourseContentProps } from '@/shared/types/courseInterface';
import { TOPIC_MASTERY_PASSING_SCORE } from '@/shared/types/mastery.types';

export const CourseContent = ({
  currentLesson: lesson,
  lessonKey,
  offlineMode,
  bookmarks,
  progress,
  toggleBookmark,
  toggleLessonComplete,
  navigatePrev,
  navigateNext,
  onOpenMasteryQuiz,
  isFirstLesson,
  isLastLesson,
  canNavigateNext = !isLastLesson,
  isNextTopicLocked = false,
  materials = [],
  openMaterial,
  masteryPassingScore = TOPIC_MASTERY_PASSING_SCORE,
}: CourseContentProps) => {
  const { trackAction, XAPI_VERBS } = useXapi();
  const lastLessonId = useRef<string | number | null>(null);
  const durationLabel = formatStudyDuration(lesson?.duration);
  const materialStatuses = materials.map(material => ({
    material,
    progress: lesson?.materialProgress?.[String(material.id)],
  }));
  const nextMaterial =
    materialStatuses.find(
      item => !item.progress?.isCompleted && (item.progress?.progressPercentage ?? 0) > 0,
    ) ??
    materialStatuses.find(item => !item.progress?.isCompleted);
  const allMaterialsComplete =
    materialStatuses.length > 0 &&
    materialStatuses.every(item => item.progress?.isCompleted);
  const readingProgressPercentage = lesson?.readingProgressPercentage ?? 0;
  const nextStep = lesson?.masteryUnlocked
    ? canNavigateNext
      ? 'next-topic'
      : 'review-mastery'
    : nextMaterial
      ? 'material'
      : 'assessment';
  const studyComplete = materials.length === 0 || allMaterialsComplete;
  const stepStates = [
    studyComplete ? 'done' : 'current',
    lesson?.masteryUnlocked ? 'done' : studyComplete ? 'current' : 'locked',
    lesson?.masteryUnlocked ? (isLastLesson ? 'done' : 'current') : 'locked',
  ] as const;

  // Track Unit Initialization
  useEffect(() => {
    if (lesson?.id && lesson.id !== lastLessonId.current) {
      trackAction(XAPI_VERBS.INITIALIZED, {
        id: `${URLS.BASE}/units/${lesson.id}`,
        definition: {
          name: { 'en-US': lesson.title },
          type: 'http://adlnet.gov/expapi/activities/lesson',
        },
      });
      lastLessonId.current = lesson.id;
    }
  }, [lesson?.id, lesson?.title, trackAction, XAPI_VERBS.INITIALIZED]);

  // Track Unit Completion (if it becomes completed while viewing)
  useEffect(() => {
    if (lesson?.id && progress[lessonKey]) {
      trackAction(XAPI_VERBS.COMPLETED, {
        id: `${URLS.BASE}/units/${lesson.id}`,
        definition: {
          name: { 'en-US': lesson.title },
          type: 'http://adlnet.gov/expapi/activities/lesson',
        },
      });
    }
  }, [lesson?.id, !!progress[lessonKey], trackAction, XAPI_VERBS.COMPLETED]);

  if (!lesson) {
    return (
      <div className="bg-card/80 dark:bg-card/50 backdrop-blur-sm rounded-lg p-12 shadow-sm border border-border dark:border-border/50 flex flex-col items-center justify-center text-center animate-in fade-in zoom-in duration-500">
        <div className="w-20 h-20 bg-muted dark:bg-card rounded-full flex items-center justify-center mb-6">
          <FileText className="w-10 h-10 text-muted-foreground" />
        </div>
        <h3 className="text-xl font-bold text-foreground dark:text-foreground">Start Your Learning Journey</h3>
        <p className="text-muted-foreground max-w-sm mt-3 leading-relaxed">
          Select a topic from the course curriculum on the left to view lessons, videos, and study materials.
        </p>
      </div>
    );
  }

  return (
    <div className="pb-20 sm:pb-0">
      <div className="mb-4 flex items-start justify-between gap-3">
        <h2 className="min-w-0 text-2xl font-bold leading-tight text-foreground dark:text-foreground">
          {lesson.title}
        </h2>
        <details className="group relative shrink-0">
        <summary
          aria-label="Topic actions"
          title="Topic actions"
          className="flex h-11 w-11 cursor-pointer list-none items-center justify-center rounded-md border border-border text-lg font-semibold text-muted-foreground hover:bg-muted hover:text-foreground marker:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <MoreHorizontal aria-hidden="true" className="h-5 w-5" />
        </summary>
          <div className="absolute right-0 top-full z-30 mt-2 grid min-w-48 gap-1 rounded-lg border border-border bg-card p-1.5 shadow-lg">
            <button
              type="button"
              onClick={() => toggleBookmark(lessonKey)}
              aria-pressed={bookmarks.has(lessonKey)}
              className="flex min-h-11 items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <Bookmark className={`h-4 w-4 ${bookmarks.has(lessonKey) ? 'fill-current text-yellow-600' : ''}`} />
              {bookmarks.has(lessonKey) ? 'Remove bookmark' : 'Bookmark for later'}
            </button>
            <button
              type="button"
              onClick={() => toggleLessonComplete(lessonKey)}
              aria-pressed={Boolean(progress[lessonKey])}
              className="flex min-h-11 items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <CheckCircle className={`h-4 w-4 ${progress[lessonKey] ? 'text-green-600' : ''}`} />
              {progress[lessonKey] ? 'Clear studied status' : 'Mark as studied'}
            </button>
          </div>
        </details>
      </div>

      {(durationLabel || offlineMode) && (
        <div className="mb-5 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          {durationLabel && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 dark:bg-secondary">
              <Clock aria-hidden="true" className="h-3.5 w-3.5" />
              {durationLabel}
            </span>
          )}
          {offlineMode && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-orange-700 dark:bg-secondary dark:text-orange-300">
              <EyeOff aria-hidden="true" className="h-3.5 w-3.5" />
              Available offline
            </span>
          )}
        </div>
      )}

      {lesson.type === 'video' && lesson.content?.video && (
        <div className="mb-6">
          <VideoPlayer 
            url={lesson.content.video} 
            title={lesson.title} 
            lessonId={lesson.id} 
          />
        </div>
      )}

      {lesson.content?.text && (
        <div className="prose dark:prose-invert max-w-none mb-6">
          <p className="text-foreground/75 leading-relaxed">{lesson.content?.text}</p>
        </div>
      )}

      <section className="mt-6 space-y-4 border-t border-border pt-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[13px] font-semibold uppercase tracking-wide text-primary">Your next step</p>
            <h3 className="mt-1 font-bold text-foreground">
              {nextStep === 'material'
                ? nextMaterial?.material.title.toLowerCase().includes('notes')
                  ? 'Next: Read the notes'
                  : 'Next: Continue studying'
                : nextStep === 'assessment'
                  ? lesson.failedAttempts
                    ? 'Review and retry your assessment'
                    : 'Check your understanding'
                  : nextStep === 'next-topic'
                    ? 'Continue to the next topic'
                    : 'Review your mastery'}
            </h3>
          </div>
          <span className="rounded-full bg-muted px-2.5 py-1 text-[13px] font-medium text-foreground">
            {lesson.masteryUnlocked
              ? 'Mastery confirmed'
              : allMaterialsComplete
                ? 'Reading complete'
                : readingProgressPercentage > 0
                  ? `Reading ${readingProgressPercentage}%`
                  : 'Not started'}
          </span>
        </div>

        <p className="text-sm text-foreground/75">
          {nextStep === 'material'
            ? nextMaterial?.material.description || 'Open this material to continue your study.'
            : nextStep === 'assessment'
              ? allMaterialsComplete
                ? `Your study materials are complete. A passing assessment (${masteryPassingScore}%) confirms mastery and unlocks progression.`
                : `Assessment results, not reading time or page visits, confirm mastery. ${masteryPassingScore}% is required.`
              : nextStep === 'next-topic'
                ? 'Your mastery is confirmed. Continue along the learning pathway.'
                : 'Mastery and topic completion are tracked separately. Revisit the assessment or study material when needed.'}
        </p>

        {nextStep === 'material' && nextMaterial && (
          <div className="rounded-xl bg-primary/[0.06] p-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="shrink-0 rounded-lg bg-blue-50 p-3 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
                {nextMaterial.material.type?.toLowerCase().includes('video') ||
                nextMaterial.material.contentType?.toLowerCase().includes('video')
                  ? <PlayCircle aria-hidden="true" className="h-5 w-5" />
                  : <FileText aria-hidden="true" className="h-5 w-5" />}
              </div>
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-foreground/75">
                  {formatMaterialDetails(nextMaterial.material)}
                </p>
                <p className="mt-1 line-clamp-2 font-semibold text-foreground">
                  {nextMaterial.material.title}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-50 border-t border-border bg-background/95 px-4 py-3 shadow-[0_-8px_24px_rgba(15,23,42,0.12)] backdrop-blur sm:static sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:shadow-none sm:backdrop-blur-none">
          {nextStep === 'material' && nextMaterial ? (
            <button
              type="button"
              onClick={() => openMaterial(String(nextMaterial.material.id))}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 sm:w-auto"
              aria-label={`Open ${nextMaterial.material.title}`}
            >
              {nextMaterial.material.title.toLowerCase().includes('notes') ? 'Open notes' : 'Open material'}
              <ChevronRight aria-hidden="true" className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={nextStep === 'next-topic' ? navigateNext : onOpenMasteryQuiz}
              disabled={nextStep === 'next-topic' && (isNextTopicLocked || isLastLesson)}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              title={nextStep === 'next-topic' && isNextTopicLocked ? 'Complete the study material to continue' : undefined}
            >
              {nextStep === 'next-topic'
                ? 'Continue to next topic'
                : nextStep === 'assessment'
                  ? lesson.failedAttempts
                    ? 'Retry assessment'
                    : 'Start assessment'
                  : 'Review assessment'}
              <ChevronRight aria-hidden="true" className="h-4 w-4" />
            </button>
          )}
        </div>

        <ol aria-label="Topic learning pathway" className="grid gap-2 sm:grid-cols-3">
          {[
            {
              title: 'Study',
              detail: allMaterialsComplete
                ? 'Materials complete'
                : materials.length > 0
                  ? `${materials.length} materials`
                  : 'No materials',
            },
            {
              title: 'Assess',
              detail: lesson.masteryUnlocked ? 'Mastery confirmed' : 'Not yet passed',
            },
            {
              title: 'Progress',
              detail: isLastLesson
                ? lesson.masteryUnlocked
                  ? 'Unit complete'
                  : 'Final topic'
                : lesson.nextTopicUnlocked
                  ? 'Next topic unlocked'
                  : 'After mastery',
            },
          ].map((step, index) => {
            const state = stepStates[index];
            const StepIcon = state === 'done' ? CheckCircle : state === 'locked' ? Lock : Circle;
            return (
              <li
                key={step.title}
                aria-current={state === 'current' ? 'step' : undefined}
                className={`flex min-h-12 items-center gap-3 rounded-lg border px-3 py-2 text-[13px] ${
                  state === 'current'
                    ? 'border-primary/40 bg-primary/[0.06] text-primary'
                    : state === 'done'
                      ? 'border-green-600/20 bg-green-500/[0.04] text-foreground'
                      : 'border-border bg-muted/40 text-foreground/75'
                }`}
              >
                <StepIcon
                  aria-hidden="true"
                  className={`h-4 w-4 shrink-0 ${
                    state === 'done' ? 'text-green-600' : state === 'locked' ? 'text-muted-foreground' : 'text-primary'
                  }`}
                />
                <span className="min-w-0">
                  <span className="font-semibold">{index + 1}. {step.title}</span>
                  <span className="ml-2">{step.detail}</span>
                </span>
              </li>
            );
          })}
        </ol>

        {materials.length > 1 && (
          <div role="group" aria-label="Study materials" className="flex flex-wrap gap-2">
            {materialStatuses
              .filter(({ material }) => String(material.id) !== String(nextMaterial?.material.id))
              .map(({ material, progress: materialProgress }) => (
                <button
                  key={material.id}
                  type="button"
                  onClick={() => openMaterial(String(material.id))}
                  className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-left text-[13px] font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  {materialProgress?.isCompleted && (
                    <CheckCircle aria-hidden="true" className="h-4 w-4 shrink-0 text-green-600" />
                  )}
                  <span className="min-w-0 truncate">{material.title}</span>
                  <span className="shrink-0 text-foreground/75">{formatMaterialDetails(material)}</span>
                </button>
              ))}
          </div>
        )}

        {lesson.failedAttempts != null && lesson.failedAttempts > 0 && !lesson.masteryUnlocked && (
          <p className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
            <XCircle aria-hidden="true" className="h-3.5 w-3.5" />
            {lesson.failedAttempts} assessment {lesson.failedAttempts === 1 ? 'attempt' : 'attempts'} need review
          </p>
        )}
      </section>

      <div className="flex justify-between items-center mt-8 pt-6 border-t border-border dark:border-border/50">
        <button
          onClick={navigatePrev}
          disabled={isFirstLesson}
          className="flex min-h-11 items-center space-x-2 rounded-lg bg-muted px-4 py-2 text-muted-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50 dark:bg-secondary dark:text-muted-foreground dark:hover:bg-secondary"
          title="Previous Lesson"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Previous</span>
        </button>
        <button
          onClick={navigateNext}
          disabled={!canNavigateNext}
          className="flex min-h-11 items-center space-x-2 rounded-lg bg-primary px-4 py-2 text-primary-foreground shadow-sm shadow-primary/20 transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          title={
            isNextTopicLocked
              ? 'Complete the study materials and pass the mastery quiz to continue'
              : isLastLesson
                ? 'End of course content'
                : 'Next Lesson'
          }
        >
          <span>Next</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

function formatStudyDuration(value?: string): string | null {
  const match = value?.trim().match(
    /^(\d+(?:\s*[-–]\s*\d+)?)\s*(m|min|mins|minute|minutes|h|hr|hrs|hour|hours)$/i,
  );
  if (!match) return null;
  const unit = /^h/i.test(match[2]) ? 'hr' : 'min';
  return `${match[1].replace(/\s+/g, '')} ${unit}`;
}

function formatMaterialDetails(material: NonNullable<CourseContentProps['materials']>[number]): string {
  const type = material.type || material.contentType || 'Study material';
  const normalizedType = type.toLowerCase() === 'application/pdf' ? 'PDF' : type.toUpperCase();
  const estimatedMinutes = material.metadata?.estimatedTime;
  const duration = estimatedMinutes
    ? `~${estimatedMinutes} min`
    : material.duration
      ? /^\d+(?:\.\d+)?$/.test(material.duration)
        ? `${material.duration} min`
        : material.duration
      : undefined;
  return [normalizedType, duration].filter(Boolean).join(' · ');
}
