// next/link removed — not used in this component
import {
  Clock,
  CheckCircle,
  FileText,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  EyeOff,
  PlayCircle,
  XCircle,
} from 'lucide-react';
import { useXapi } from '@/lib/xapi/useXapi';
import { URLS } from '@/lib/urls';
import { useEffect, useRef } from 'react';
import { VideoPlayer } from './VideoPlayer';
import type { CourseContentProps } from '@/shared/types/courseInterface';

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
  masteryPassingScore = 80,
}: CourseContentProps) => {
  const { trackAction, XAPI_VERBS } = useXapi();
  const lastLessonId = useRef<string | number | null>(null);
  const durationLabel = formatStudyDuration(lesson?.duration);

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
    <div className="bg-card/80 dark:bg-card/50 backdrop-blur-sm rounded-lg p-5 shadow-sm border border-border dark:border-border/50 sm:p-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <h2 className="min-w-0 text-2xl font-bold leading-tight text-foreground dark:text-foreground">
          {lesson.title}
        </h2>
        <details className="group relative shrink-0">
          <summary className="flex h-9 cursor-pointer list-none items-center rounded-md border border-border px-3 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground marker:hidden">
            Topic actions
          </summary>
          <div className="absolute right-0 top-full z-30 mt-2 grid min-w-48 gap-1 rounded-lg border border-border bg-card p-1.5 shadow-lg">
            <button
              type="button"
              onClick={() => toggleBookmark(lessonKey)}
              aria-pressed={bookmarks.has(lessonKey)}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-foreground hover:bg-muted"
            >
              <Bookmark className={`h-4 w-4 ${bookmarks.has(lessonKey) ? 'fill-current text-yellow-600' : ''}`} />
              {bookmarks.has(lessonKey) ? 'Remove bookmark' : 'Bookmark for later'}
            </button>
            <button
              type="button"
              onClick={() => toggleLessonComplete(lessonKey)}
              aria-pressed={Boolean(progress[lessonKey])}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-foreground hover:bg-muted"
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
          <p className="text-muted-foreground dark:text-muted-foreground leading-relaxed">{lesson.content?.text}</p>
        </div>
      )}

      {/* Keep one clear starting point; the rest stays available on demand. */}
      {materials.length > 0 && (
        <section className="mt-8 space-y-3 border-t border-border pt-6 dark:border-border">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">Your next step</p>
              <h3 className="mt-1 font-bold text-foreground dark:text-foreground">Start with a study material</h3>
            </div>
            <span className="shrink-0 rounded-full bg-muted px-2 py-1 text-xs font-medium text-muted-foreground dark:bg-card">
              {materials.length} {materials.length === 1 ? 'resource' : 'resources'}
            </span>
          </div>

          {(() => {
            const firstMaterial = materials[0];
            const isVideo = firstMaterial.type?.toLowerCase().includes('video') ||
              firstMaterial.contentType?.toLowerCase().includes('video');
            return (
              <div className="flex flex-col gap-4 rounded-xl border border-primary/20 bg-primary/[0.03] p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <div className={`shrink-0 rounded-lg p-3 ${
                    isVideo
                      ? 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400'
                      : 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400'
                  }`}>
                    {isVideo ? <PlayCircle className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-muted-foreground">
                      {isVideo ? 'Video' : 'Reading'}{firstMaterial.duration ? ` · ${firstMaterial.duration}` : ''}
                    </p>
                    <p className="mt-1 line-clamp-2 font-semibold text-foreground">
                      {firstMaterial.title}
                    </p>
                    {firstMaterial.description && (
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                        {firstMaterial.description}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => openMaterial(String(firstMaterial.id))}
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                  aria-label={`${isVideo ? 'Watch' : 'Read'} ${firstMaterial.title}`}
                >
                  {isVideo ? 'Watch now' : 'Start reading'}
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            );
          })()}

          {materials.length > 1 && (
            <details className="group rounded-lg border border-border dark:border-border/50">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-foreground marker:hidden">
                <span>More study materials ({materials.length - 1})</span>
                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
              </summary>
              <div className="space-y-2 border-t border-border p-3 dark:border-border/50">
                {materials.slice(1).map(material => (
                  <button
                    key={material.id}
                    type="button"
                    onClick={() => openMaterial(String(material.id))}
                    className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left transition-colors hover:bg-muted"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-foreground">
                        {material.title}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {material.type || material.contentType || 'Study material'}
                        {material.duration ? ` · ${material.duration}` : ''}
                      </span>
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </button>
                ))}
              </div>
            </details>
          )}
        </section>
      )}

      {/* Mastery Gate Section - Now feels like a natural "Next Step" */}
      <div className="mt-12 p-8 bg-linear-to-br from-slate-50 to-white dark:from-slate-900/80 dark:to-slate-900/40 rounded-2xl border border-blue-100 dark:border-blue-900/30 shadow-inner">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-blue-600 text-white rounded-lg shadow-lg shadow-blue-500/20">
                <CheckCircle className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-extrabold text-foreground dark:text-foreground tracking-tight">
                Mastery Gate: {lesson.title}
              </h3>
            </div>
            
            <p className="text-muted-foreground dark:text-muted-foreground leading-relaxed max-w-xl">
              {lesson.masteryUnlocked 
                ? "Excellent work! You have successfully mastered this topic. You can proceed or retake the assessment for a higher score." 
                : `Verify your understanding of this topic to unlock the next part of your learning path. ${masteryPassingScore}% passing score required.`}
            </p>
            
          </div>
          
          <div className="flex flex-col items-center gap-3 min-w-60">
             <button
              onClick={onOpenMasteryQuiz}
              className={`w-full py-4 rounded-xl font-bold transition-all shadow-xl text-center flex items-center justify-center gap-2 group ${
                lesson.masteryUnlocked
                  ? 'bg-green-600 text-white hover:bg-green-700'
                  : 'bg-blue-600 text-white hover:bg-blue-700 ring-4 ring-blue-500/10'
              }`}
            >
              {lesson.masteryUnlocked ? "Retake Mastery Quiz" : "Unlock Mastery Quiz"}
              <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
            {lesson.failedAttempts != null && lesson.failedAttempts > 0 && !lesson.masteryUnlocked && (
              <div className="flex items-center gap-2 px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full text-xs font-bold uppercase tracking-wider">
                <XCircle className="w-3 h-3" />
                {lesson.failedAttempts} Failed Attempts
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex justify-between items-center mt-8 pt-6 border-t border-border dark:border-border/50">
        <button
          onClick={navigatePrev}
          disabled={isFirstLesson}
          className="flex items-center space-x-2 px-4 py-2 bg-muted dark:bg-secondary text-muted-foreground dark:text-muted-foreground rounded-lg hover:bg-secondary dark:hover:bg-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Previous Lesson"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Previous</span>
        </button>
        <button
          onClick={navigateNext}
          disabled={!canNavigateNext}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/20"
          title={
            isNextTopicLocked
              ? 'Complete the mastery quiz to unlock the next topic'
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
