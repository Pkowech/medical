'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
} from 'lucide-react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { instructorRoles } from '@/shared/enums/role.enum';
import { useLayoutStore } from '@/core/stores/useLayoutStore';
import { cn } from '@/lib/utils/cn';
import { usePageHeader } from '@/core/providers/HeaderContext';
import { useCourseProgressStore } from '@/features/courses/hooks/useCourseProgressStore';
import { Breadcrumb } from '@/shared/components/ui/breadcrumb';
import { ProgressBar } from '@/shared/components/ui/ProgressBar';
import { CourseSidebar } from '@/features/courses/components/CourseSidebar';
import { CourseContent } from '@/features/courses/components/CourseContent';
import { Material } from '@/shared/types/materialInterface';
import { URLS } from '@/lib/urls';
import { Lesson } from '@/shared/types/courseInterface';
import { NotesPanel } from '@/features/courses/components/NotesPanel';
import { DiscussionPanel } from '@/features/courses/components/DiscussionPanel';
import { QuizPanel } from '@/features/courses/components/QuizPanel';
import { useUnitData } from '@/features/courses/hooks/useUnitData';
import { useCourseNavigation } from '@/features/courses/hooks/useCourseNavigation';
import { useXapi } from '@/lib/xapi/useXapi';
import { MaterialPreviewModal } from '@/features/courses/components/MaterialPreviewModal';
import { Button } from '@/shared/components/ui/button';
import progressService from '@/features/learning-management/services/progressService';
import offlineProgressSync from '@/features/learning-management/services/offlineProgressSync';
import { toast } from 'sonner';
import {
  StartCourseStudySessionButton,
  useCourseStudySession,
} from '@/features/learning-management/study/components/CourseStudySessionProvider';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UnitLayoutProps {
  unitId?: string;
  courseId?: string;
}

type NormalisedMaterial = {
  id: string | number;
  title: string;
  type: string;
  size?: string;
  url: string;
  description?: string;
  unitId?: string | number;
};


// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export const UnitLayout = ({ unitId: propUnitId, courseId }: UnitLayoutProps) => {
  const params = useParams();
  const unitId = propUnitId || (params?.unitId as string);

  // ── Global UI state ────────────────────────────────────────────────────
  const {
    activeCoursePanel,
    toggleCoursePanel,
    closeCoursePanel,
    sidebarOpen,
    sidebarCollapsed,
    setSidebarCollapsed,
  } = useLayoutStore();

  // ── Page header ────────────────────────────────────────────────────────
  const { setHeader } = usePageHeader();
  const queryClient = useQueryClient();
  const { activeSession, recordCourseActivity, switchCourseTopic } = useCourseStudySession();

  // ── Progress store ─────────────────────────────────────────────────────
  const { progress, bookmarks, notes, markLessonComplete, toggleLessonComplete, toggleBookmark, saveNote } =
    useCourseProgressStore();

  // ── Local state ────────────────────────────────────────────────────────
  const [offlineMode, setOfflineMode] = useState(false);
  const [selectedMaterialId, setSelectedMaterialId] = useState<string | null>(null);
  const [hasSelectedTopic, setHasSelectedTopic] = useState(Boolean(params?.topicId));
  const { user } = useAuth();
  const isAdmin = Boolean(user?.role && instructorRoles.includes(user.role));

  const openMaterial = (id: string) => {
    if (typedCurrentTopic?.id != null) {
      recordCourseActivity(
        'reading',
        courseId,
        activeSession?.topicId ?? String(typedCurrentTopic.id),
      );
    }
    setSidebarCollapsed(false);
    setSelectedMaterialId(id);
  };
  const openCoursePanel = (panelName: string) => {
    setSelectedMaterialId(null);
    setSidebarCollapsed(false);
    toggleCoursePanel(panelName);
  };
  const closeMaterial = () => {
    setSidebarCollapsed(false);
    setSelectedMaterialId(null);
  };

  const handleAddTopic = async () => {
    console.warn('Admin wants to add a new topic!');
    // In a real application, you would make an API call here, e.g.:
    // await apiService.createTopic(unitId, { title: 'New Topic', description: '...' });
    // After successful creation, refetch unit data to update the UI
    // Assuming useUnitData provides a refetch method
    // If useUnitData doesn't return refetch, you might need to use a mutation hook (e.g., from react-query)
    // useUnitData returns a `refetch` function; call it if available
    if (typeof refetchUnit === 'function') {
      refetchUnit();
    }
  };

  // ── Data fetching ──────────────────────────────────────────────────────
  // useUnitData now returns chapters = one chapter per topic.
  const { data: unitData, isLoading: isUnitLoading, error: unitError, refetch: refetchUnit } = useUnitData(unitId, courseId);

  // ── Navigation (chapter = topic, lesson = topic itself) ────────────────
  const {
    currentChapterIndex,
    currentLessonIndex,
    lessonKey,
    navigateTo,
    navigateNext,
    navigatePrev,
    isFirstLesson,
    isLastLesson,
  } = useCourseNavigation(unitData?.chapters || [], unitId);

  const selectTopic = (chapterIndex: number, lessonIndex: number) => {
    setHasSelectedTopic(true);
    closeCoursePanel('quiz');
    closeCoursePanel('unit-quiz');
    navigateTo(chapterIndex, lessonIndex);
  };

  // ── Page header sync ───────────────────────────────────────────────────
  useEffect(() => {
    if (unitData?.title) {
      setHeader({
        title: unitData.title,
        description: unitData.description || 'Unit content and materials',
        icon: '📘',
      });
    }
    return () => setHeader(null);
  }, [unitData?.title, unitData?.description, setHeader]);

  // ── Online / offline ───────────────────────────────────────────────────
  useEffect(() => {
    const on = () => setOfflineMode(false);
    const off = () => setOfflineMode(true);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  // ── Current topic ──────────────────────────────────────────────────────
  const getCurrentTopic = () => {
    // Each chapter is a topic; the single lesson inside it IS the topic.
    const chapter = unitData?.chapters?.[currentChapterIndex];
    return chapter ? chapter.lessons[currentLessonIndex] : undefined;
  };

  const typedCurrentTopic = getCurrentTopic() as unknown as Lesson & { resources?: Material[] };
  useEffect(() => {
    if (
      typedCurrentTopic?.id != null &&
      courseId &&
      activeSession &&
      activeSession?.courseId === courseId &&
      activeSession.topicId !== String(typedCurrentTopic.id)
    ) {
      switchCourseTopic(courseId, String(typedCurrentTopic.id), typedCurrentTopic.title);
    }
  }, [
    activeSession?.courseId,
    activeSession?.topicId,
    activeSession,
    courseId,
    lessonKey,
    switchCourseTopic,
    typedCurrentTopic?.id,
  ]);
  const refreshLearningCaches = async () => {
    if (!user?.id) return;
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['userProgress', user.id] }),
      queryClient.invalidateQueries({ queryKey: ['userLearningStreak', user.id] }),
      queryClient.invalidateQueries({ queryKey: ['studyPlanner', user.id] }),
      queryClient.invalidateQueries({ queryKey: ['course-progress-dashboard', user.id] }),
      queryClient.invalidateQueries({ queryKey: ['courseStatistics', user.id] }),
      queryClient.invalidateQueries({ queryKey: ['studyResume', user.id] }),
      queryClient.invalidateQueries({ queryKey: ['courses'] }),
      queryClient.invalidateQueries({ queryKey: ['unit'] }),
    ]);
  };
  const handleToggleLessonComplete = async (key: string) => {
    if (typedCurrentTopic?.id == null) {
      toast.error('This topic cannot be updated because it has no topic ID.');
      return;
    }

    const isComplete = Boolean(progress[key]);
    const nextStatus: 'notStarted' | 'completed' = isComplete ? 'notStarted' : 'completed';
    const progressPercentage = isComplete ? 0 : 100;
    const update = {
      courseId,
      unitId,
      topicId: String(typedCurrentTopic.id),
      status: nextStatus,
      progressPercentage,
    };

    try {
      await progressService.updateContentProgress(update);
    } catch (error) {
      console.error('Failed to update topic progress:', error);
      try {
        await offlineProgressSync.addToQueue({
          courseId: update.courseId,
          unitId,
          topicId: update.topicId,
          percent: progressPercentage,
          status: isComplete ? 'notStarted' : 'completed',
        });
        toggleLessonComplete(key);
        toast.info('Topic progress saved offline and will sync when connected.');
        return;
      } catch (queueError) {
        console.error('Failed to queue topic progress:', queueError);
        toast.error('Topic progress could not be saved.');
        return;
      }
    }

    toggleLessonComplete(key);
    await Promise.all([refreshLearningCaches(), refetchUnit()]).catch(error => {
      console.error('Failed to refresh topic progress after saving:', error);
    });
  };
  const unitProgressPercentage = unitData?.chapters?.length
    ? Math.round(
        (unitData.chapters.filter(chapter => chapter.lessons[0]?.isCompleted).length /
          unitData.chapters.length) * 100,
      )
    : 0;

  // ── Materials for the current topic ───────────────────────────────────
  // The lesson carries `resources` (set in normalizeUnitToChapters).
  // We also scan the top-level resources array as a fallback.
  const materialsForCurrentTopic: NormalisedMaterial[] = useMemo(() => {
    if (!unitData || !typedCurrentTopic) return [];

    const topicId = String(typedCurrentTopic.id);

    // 1. Materials attached directly to the lesson (preferred)
    const lessonResources: Material[] = typedCurrentTopic.resources || [];

    // 2. Include only top-level resources explicitly linked to this topic.
    const topLevelMatches = ((unitData.resources || []) as Material[]).filter(m => {
      const mTyped = m as Material & {
        topicId?: string | number;
      };
      return mTyped.topicId != null && String(mTyped.topicId) === topicId;
    });

    // Merge and deduplicate
    const all = [...lessonResources, ...topLevelMatches];
    const seen = new Set<string | number>();
    return all
      .filter(m => {
        if (seen.has(m.id)) return false;
        seen.add(m.id);
        return true;
      })
      .map(m => ({
        id: m.id,
        title: m.title ?? 'Untitled',
        type: m.type ?? 'DOCUMENT',
        size: (m as Material & { size?: string }).size,
        url: m.url ?? '',
        description: m.description,
        unitId: (m as Material & { unitId?: string | number }).unitId,
        topicId: (m as Material & { topicId?: string | number }).topicId,
      }));
  }, [unitData, typedCurrentTopic]);

  // ── xAPI tracking ──────────────────────────────────────────────────────
  const { trackAction, XAPI_VERBS } = useXapi();

  useEffect(() => {
    if (unitData?.id && unitData?.title) {
      trackAction(XAPI_VERBS.LAUNCHED, {
        id: `${URLS.BASE}/units/${unitData.id}`,
        definition: {
          name: { 'en-US': unitData.title },
          type: 'http://adlnet.gov/expapi/activities/unit',
        },
      });
    }
  }, [unitData?.id, unitData?.title, trackAction, XAPI_VERBS.LAUNCHED]);

  // ── Early returns ──────────────────────────────────────────────────────

  if (isUnitLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50/50 dark:bg-slate-900/50">
        <p className="text-gray-600 dark:text-slate-400">Loading unit content…</p>
      </div>
    );
  }

  if (unitError && !unitData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50/50 dark:bg-slate-900/50">
        <div className="text-center">
          <p className="text-red-600 dark:text-red-400 font-semibold">Error loading unit</p>
          <p className="text-gray-600 dark:text-slate-400 text-sm mt-2">
            {unitError instanceof Error ? unitError.message : 'Failed to load unit data'}
          </p>
        </div>
      </div>
    );
  }

  if (!unitData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50/50 dark:bg-slate-900/50">
        <p className="text-gray-600 dark:text-slate-400">Unit not found.</p>
      </div>
    );
  }

  // ── Separate topic materials from general sidebar resources ────────────
  type ResourceLike = Partial<Material> & {
    contentType?: string;
    size?: string;
    url?: string;
    id?: string | number;
    title?: string;
    unitId?: string | number;
    topicId?: string | number;
    unit?: { id: string | number };
  };

  const allResources = ((unitData.resources || []) as ResourceLike[]).map(m => ({
    id: m.id ?? 'unknown',
    title: m.title ?? 'Untitled',
    type: m.type ?? m.contentType ?? 'document',
    size: m.size,
    url: m.url ?? '',
    unitId: m.unitId || m.unit?.id,
    topicId: m.topicId,
  }));
  const topicMaterialIds = new Set<string>();
  (unitData.chapters || []).forEach(chapter => {
    chapter.lessons.forEach(lesson => {
      const topicResources = (lesson as typeof lesson & {
        resources?: Array<{ id: string | number }>;
      }).resources ?? [];
      topicResources.forEach(resource => topicMaterialIds.add(String(resource.id)));
    });
  });
  const sidebarResources = allResources.filter(resource =>
    resource.topicId == null && !topicMaterialIds.has(String(resource.id)),
  );

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full flex-col flex-1 min-h-0 bg-gray-50/50 dark:bg-slate-900">
      <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden relative">

        {/*
         * Sidebar
         * unitData.chapters is now [topic1, topic2, …] — one chapter per topic.
         * CourseSidebar will render each chapter (topic) as a top-level item,
         * exactly like it renders lessons in the course layout.
         */}
        <div
          className={cn(
            'fixed lg:static inset-y-0 left-0 z-60 lg:z-40 h-full min-h-0 w-80 shrink-0 overflow-hidden transition-[width,transform] duration-300 ease-in-out',
            sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
            sidebarCollapsed && selectedMaterialId ? 'lg:w-0' : 'lg:w-80',
          )}
        >
          <CourseSidebar
            chapters={unitData.chapters || []}
            resources={sidebarResources}
            parentUnitId={unitData.id}
            currentChapterIndex={currentChapterIndex}
            currentLessonIndex={currentLessonIndex}
            navigateTo={selectTopic}
            progress={progress}
            toggleCoursePanel={openCoursePanel}
            openMaterial={openMaterial}
            allowCollapse={Boolean(selectedMaterialId)}
          />
        </div>

        {/* Main content area */}
        <main className={cn(
          'min-h-0 min-w-0 flex-1 overscroll-contain scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-slate-700',
          selectedMaterialId ? 'flex overflow-hidden p-0' : 'overflow-y-auto p-4 md:p-8',
        )}>
          <div className={cn(
            'max-w-5xl mx-auto space-y-6 md:space-y-8 pb-20',
            selectedMaterialId && 'flex h-full w-full max-w-none flex-1 flex-col space-y-0 pb-0',
          )}>

            {/* Breadcrumb + progress */}
            {!selectedMaterialId && <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                {sidebarCollapsed && selectedMaterialId && (
                  <button
                    type="button"
                    onClick={() => setSidebarCollapsed(false)}
                    className="rounded-md border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                    aria-label="Open course sidebar"
                    title="Open course sidebar"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                )}
                <Breadcrumb />
                </div>
                <Button
                  type="button"
                  variant={activeCoursePanel === 'unit-quiz' ? 'outline' : 'default'}
                  onClick={() => {
                    if (typedCurrentTopic?.id != null) {
                      recordCourseActivity('reading', courseId, String(typedCurrentTopic.id));
                    }
                    toggleCoursePanel('unit-quiz');
                  }}
                  aria-pressed={activeCoursePanel === 'unit-quiz'}
                  className="shrink-0"
                >
                  <ClipboardCheck className="mr-2 h-4 w-4" />
                  {activeCoursePanel === 'unit-quiz' ? 'Back to Unit' : 'Unit Quiz'}
                </Button>
                {hasSelectedTopic && typedCurrentTopic?.id != null && courseId && (
                  <StartCourseStudySessionButton
                    courseId={courseId}
                    topicId={String(typedCurrentTopic.id)}
                    topicTitle={typedCurrentTopic.title}
                  />
                )}
              </div>
              <ProgressBar value={unitProgressPercentage} className="h-2" />
            </div>}

            {/* Admin actions - Add Topic */}
            {!selectedMaterialId && isAdmin && (
              <div className="flex justify-end mt-4">
                <Button onClick={handleAddTopic}>Add New Topic</Button>
              </div>
            )}

            {selectedMaterialId ? (
              <MaterialPreviewModal
                materialId={selectedMaterialId}
                isOpen={Boolean(selectedMaterialId)}
                onClose={closeMaterial}
                materials={allResources}
                onNavigate={setSelectedMaterialId}
                inline
              />
            ) : activeCoursePanel === 'unit-quiz' ? (
              <div className="animate-in fade-in slide-in-from-right-4 duration-500">
                <div className="mb-4 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => toggleCoursePanel('unit-quiz')}
                    className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-blue-600"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Back to Unit
                  </button>
                </div>
                <QuizPanel
                  lessonId={unitData.id}
                  lessonTitle={unitData.title}
                  courseId={courseId}
                  scope="unit"
                  onReturn={() => toggleCoursePanel('unit-quiz')}
                />
              </div>
            ) : !hasSelectedTopic ? (
              <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{unitData.title}</h1>
                <p className="mt-2 text-slate-600 dark:text-slate-400">{unitData.description || 'Choose a topic to begin.'}</p>
                <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:hidden">
                  {(unitData.chapters || []).map((chapter, chapterIndex) => (
                    <button
                      key={chapter.id}
                      type="button"
                      onClick={() => selectTopic(chapterIndex, 0)}
                      className="flex w-full items-center justify-between rounded-lg border border-slate-200 p-4 text-left hover:border-blue-400 hover:bg-blue-50/50 dark:border-slate-700 dark:hover:bg-blue-950/20"
                    >
                      <span>
                        <span className="block font-semibold text-slate-900 dark:text-white">{chapter.title}</span>
                        <span className="text-sm text-slate-500 dark:text-slate-400">{chapter.duration}</span>
                      </span>
                      <span className="text-sm font-semibold text-blue-600">Open topic</span>
                    </button>
                  ))}
                </div>
              </section>
            ) : activeCoursePanel === 'quiz' ? (
              <div className="animate-in fade-in slide-in-from-right-4 duration-500">
                <div className="flex items-center justify-between mb-4">
                  <button
                    onClick={() => toggleCoursePanel('quiz')}
                    className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-blue-600 transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Back to Topic
                  </button>
                </div>
                <QuizPanel
                  lessonId={typedCurrentTopic?.id}
                  lessonTitle={typedCurrentTopic?.title}
                  courseId={courseId}
                  scope="topic"
                  onTopicProgressUpdated={async () => {
                    await Promise.all([refetchUnit(), refreshLearningCaches()]);
                  }}
                  onTopicCompleted={() => {
                    markLessonComplete(lessonKey);
                    if (typedCurrentTopic?.id != null) {
                      markLessonComplete(String(typedCurrentTopic.id));
                    }
                  }}
                  onNextTopic={(nextTopicId) => {
                    const nextIndex = (unitData.chapters || []).findIndex(
                      chapter => String(chapter.id) === String(nextTopicId),
                    );
                    if (nextIndex >= 0) {
                      toggleCoursePanel('quiz');
                      selectTopic(nextIndex, 0);
                    }
                  }}
                  onReturn={() => toggleCoursePanel('quiz')}
                />
              </div>
            ) : (
              <>
                {/*
                 * Topic content
                 * CourseContent renders the lesson text / video / etc.
                 * We pass materialsForCurrentTopic so it can show quick-access
                 * buttons inside the content pane too (if CourseContent supports it).
                 */}
                <CourseContent
                  currentLesson={typedCurrentTopic}
                  lessonKey={lessonKey}
                  offlineMode={offlineMode}
                  bookmarks={new Set(bookmarks)}
                  progress={progress}
                  toggleBookmark={toggleBookmark}
                  toggleLessonComplete={handleToggleLessonComplete}
                  navigatePrev={() => { setHasSelectedTopic(true); navigatePrev(); }}
                  navigateNext={() => { setHasSelectedTopic(true); navigateNext(); }}
                  onOpenMasteryQuiz={() => toggleCoursePanel('quiz')}
                  isFirstLesson={isFirstLesson}
                  isLastLesson={isLastLesson}
                  materials={materialsForCurrentTopic as unknown as Material[]}
                  openMaterial={openMaterial}
                  masteryPassingScore={70}
                />

              </>
            )}

            {/* Notes panel */}
            {!selectedMaterialId && activeCoursePanel === 'notes' && (
              <NotesPanel lessonKey={lessonKey} notes={notes} saveNote={saveNote} />
            )}

            {/* Discussion panel */}
            {!selectedMaterialId && activeCoursePanel === 'discussion' && (
              <DiscussionPanel
                discussions={(
                  (unitData?.discussions || []) as unknown as Record<string, unknown>[]
                ).map((d, idx) => ({
                  id: idx,
                  user: (d?.['user'] as string) ?? 'Unknown',
                  time: (d?.['time'] as string) ?? new Date().toISOString(),
                  message: (d?.['message'] as string) ?? '',
                  replies: (d?.['replies'] as number) ?? 0,
                }))}
              />
            )}
          </div>
        </main>
      </div>

    </div>
  );
};