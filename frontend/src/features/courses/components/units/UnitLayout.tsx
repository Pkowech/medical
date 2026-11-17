'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import {
  BookOpen,
  CheckCircle,
  Circle,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Clock,
  MessageSquare,
  NotebookPen,
  PlayCircle,
} from 'lucide-react';
import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { instructorRoles } from '@/shared/enums/role.enum';
import { useLayoutStore } from '@/core/stores/useLayoutStore';
import { cn } from '@/lib/utils/cn';
import { usePageHeader } from '@/core/providers/HeaderContext';
import { useCourseProgressStore } from '@/features/courses/hooks/useCourseProgressStore';
import { Breadcrumb } from '@/shared/components/ui/breadcrumb';
import { ProgressBar } from '@/shared/components/ui/ProgressBar';
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
import { TopicForm } from '@/features/courses/components/TopicForm';
import { topicService } from '@/features/courses/services/topicService';
import type { Topic } from '@/shared/types/courseInterface';
import { TOPIC_MASTERY_PASSING_SCORE } from '@/shared/types/mastery.types';
import { Button } from '@/shared/components/ui/button';
import { Dialog, DialogContent } from '@/shared/components/ui/dialog';
import { toast } from 'sonner';
import {
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

function getTopicBreadcrumbTitle(title: string): string {
  return /\boverview$/i.test(title.trim()) ? 'Overview' : title;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export const UnitLayout = ({ unitId: propUnitId, courseId }: UnitLayoutProps) => {
  const params = useParams();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const unitId = propUnitId || (params?.unitId as string);
  const selectedTopicId = searchParams.get('topicId') || (params?.topicId as string | undefined);

  // ── Global UI state ────────────────────────────────────────────────────
  const {
    activeCoursePanel,
    toggleCoursePanel,
    closeCoursePanel,
  } = useLayoutStore();

  // ── Page header ────────────────────────────────────────────────────────
  const { setHeader } = usePageHeader();
  const queryClient = useQueryClient();
  const {
    activeSession,
    ensureCourseSession,
    pauseCourseSession,
    recordCourseActivity,
  } = useCourseStudySession();

  // ── Progress store ─────────────────────────────────────────────────────
  const { progress, bookmarks, notes, markLessonComplete, toggleLessonComplete, toggleBookmark, saveNote } =
    useCourseProgressStore();

  // ── Local state ────────────────────────────────────────────────────────
  const [offlineMode, setOfflineMode] = useState(false);
  const [isAddTopicOpen, setIsAddTopicOpen] = useState(false);
  const [createdTopic, setCreatedTopic] = useState<Topic | null>(null);
  const selectedMaterialId = searchParams.get('materialId');
  const hasSelectedTopic = Boolean(selectedTopicId);
  const { user } = useAuth();
  const isAdmin = Boolean(user?.role && instructorRoles.includes(user.role));

  const updateRouteQuery = (key: string, value: string | null, replace = false) => {
    if (searchParams.get(key) === value) return;

    const nextSearchParams = new URLSearchParams(searchParams.toString());
    if (value) {
      nextSearchParams.set(key, value);
    } else {
      nextSearchParams.delete(key);
    }

    const query = nextSearchParams.toString();
    const href = `${pathname}${query ? `?${query}` : ''}`;
    if (replace) {
      router.replace(href, { scroll: false });
    } else {
      router.push(href, { scroll: false });
    }
  };

  const openMaterial = (id: string) => {
    if (typedCurrentTopic?.id != null) {
      recordCourseActivity(
        'material_opened',
        courseId,
        activeSession?.topicId ?? String(typedCurrentTopic.id),
        undefined,
        id,
      );
    }
    updateRouteQuery('materialId', id);
  };
  const openCoursePanel = (panelName: string) => {
    updateRouteQuery('materialId', null, true);
    toggleCoursePanel(panelName);
  };
  const closeMaterial = async () => {
    updateRouteQuery('materialId', null, true);
    try {
      await refreshLearningCaches();
    } catch (error) {
      console.error('Could not refresh learning data after material progress changed:', error);
    }
  };

  const handleAddTopic = async (topicData: Partial<Topic>, hasPendingMaterial: boolean) => {
    if (!unitId) {
      throw new Error('Cannot create a topic because the unit could not be identified.');
    }

    try {
      const newTopic = await topicService.createTopic(unitId, topicData);
      if (hasPendingMaterial) {
        setCreatedTopic(newTopic);
      } else {
        setIsAddTopicOpen(false);
      }
      toast.success('Topic created successfully.');
      await refetchUnit();
      return newTopic;
    } catch (error) {
      console.error('Failed to create topic:', error);
      throw error;
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
    canNavigateNext,
    isNextTopicLocked,
  } = useCourseNavigation(
    unitData?.chapters || [],
    unitId,
    selectedTopicId,
    courseId || unitData?.courseId,
  );

  const selectTopic = (chapterIndex: number, lessonIndex: number) => {
    closeCoursePanel('quiz');
    closeCoursePanel('unit-quiz');
    navigateTo(chapterIndex, lessonIndex);
  };

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

  // ── Page header sync ───────────────────────────────────────────────────
  useEffect(() => {
    if (unitData?.title) {
      const isTopicReading = hasSelectedTopic && !selectedMaterialId;
      setHeader({
        title: unitData.title,
        mobileTitle: hasSelectedTopic
          ? typedCurrentTopic?.title || 'Topic'
          : undefined,
        description: unitData.description || 'Unit content and materials',
        canResumeStudySession: isTopicReading,
        presentation: isTopicReading ? 'compact' : 'metadata',
      });
    }
    return () => setHeader(null);
  }, [
    activeCoursePanel,
    courseId,
    hasSelectedTopic,
    recordCourseActivity,
    selectedMaterialId,
    setHeader,
    toggleCoursePanel,
    typedCurrentTopic?.id,
    typedCurrentTopic?.title,
    unitData?.description,
    unitData?.title,
  ]);
  useEffect(() => {
    if (!hasSelectedTopic || !courseId || typedCurrentTopic?.id == null) return;
    void ensureCourseSession(
      courseId,
      String(typedCurrentTopic.id),
      typedCurrentTopic.title,
    );
    return () => pauseCourseSession('navigation');
  }, [
    courseId,
    ensureCourseSession,
    hasSelectedTopic,
    pauseCourseSession,
    typedCurrentTopic?.id,
    typedCurrentTopic?.title,
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
      queryClient.invalidateQueries({
        queryKey: ['course-overview-progress', courseId, user.id],
      }),
      queryClient.invalidateQueries({
        queryKey: ['course-overview-active-units', courseId, user.id],
      }),
    ]);
  };
  const handleToggleLessonComplete = (key: string) => toggleLessonComplete(key);
  const chapters = unitData?.chapters || [];
  const isTopicComplete = (chapterIndex: number) => {
    const chapter = chapters[chapterIndex];
    const topic = chapter?.lessons[0];
    return Boolean(
      topic?.masteryUnlocked === true,
    );
  };
  const completedTopicCount = chapters.filter((_, index) => isTopicComplete(index)).length;
  const unitProgressPercentage = chapters.length
    ? Math.round((completedTopicCount / chapters.length) * 100)
    : 0;
  const nextTopicIndex = chapters.findIndex((_, index) => {
    const previousTopic = chapters[index - 1]?.lessons[0];
    return !isTopicComplete(index) && (index === 0 || previousTopic?.nextTopicUnlocked === true);
  });
  const currentTopicIndex = hasSelectedTopic ? currentChapterIndex : nextTopicIndex;

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
      <div className="min-h-screen flex items-center justify-center bg-background/50 dark:bg-card/50">
        <p className="text-muted-foreground dark:text-muted-foreground">Loading unit content…</p>
      </div>
    );
  }

  if (unitError && !unitData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background/50 dark:bg-card/50">
        <div className="text-center">
          <p className="text-red-600 dark:text-red-400 font-semibold">Error loading unit</p>
          <p className="text-muted-foreground dark:text-muted-foreground text-sm mt-2">
            {unitError instanceof Error ? unitError.message : 'Failed to load unit data'}
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            <Button type="button" variant="outline" onClick={() => void refetchUnit()}>
              Retry
            </Button>
            {courseId && (
              <Link
                href={`/courses/${courseId}`}
                className="inline-flex h-10 items-center rounded-md border border-border px-4 text-sm font-medium hover:bg-muted"
              >
                Back to course overview
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!unitData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background/50 dark:bg-card/50">
        <div className="text-center">
          <p className="text-muted-foreground dark:text-muted-foreground">Unit not found.</p>
          {courseId && (
            <Link
              href={`/courses/${courseId}`}
              className="mt-4 inline-flex h-10 items-center rounded-md border border-border px-4 text-sm font-medium hover:bg-muted"
            >
              Back to course overview
            </Link>
          )}
        </div>
      </div>
    );
  }

  // ── Separate topic materials from unit resources ───────────────────────
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
  const unitResources = allResources.filter(resource =>
    resource.topicId == null && !topicMaterialIds.has(String(resource.id)),
  );

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div
      className={cn(
        'relative flex w-full flex-1 flex-col bg-background/50 dark:bg-card',
        selectedMaterialId
          ? 'h-full min-h-0'
          : 'min-h-full lg:h-full lg:min-h-0',
      )}
    >
      <div
        className={cn(
          'relative flex min-w-0 flex-1',
          selectedMaterialId
            ? 'min-h-0 overflow-hidden'
            : 'lg:min-h-0 lg:overflow-hidden',
        )}
      >

        {/* Main content area */}
        <main className={cn(
          'min-w-0 flex-1 overscroll-contain scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-slate-700',
          selectedMaterialId
            ? 'flex min-h-0 overflow-hidden p-0'
            : 'overflow-visible px-4 py-4 sm:px-6 sm:py-6 lg:min-h-0 lg:overflow-y-auto lg:p-8',
        )}>
          <div className={cn(
            'max-w-6xl mx-auto space-y-6 md:space-y-8 pb-20',
            selectedMaterialId && 'flex h-full w-full max-w-none flex-1 flex-col space-y-0 pb-0',
          )}>

            {!selectedMaterialId && (
              <header className="space-y-4 border-b border-border pb-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 space-y-2">
                    <Breadcrumb
                      items={[
                        { label: 'Courses', href: '/courses' },
                        ...(courseId
                          ? [{
                              label: unitData.courseName || 'Course',
                              href: `/courses/${courseId}`,
                            }]
                          : []),
                        ...(hasSelectedTopic
                          ? [
                              {
                                label: unitData.title,
                                href: courseId
                                  ? `/courses/${courseId}/units/${unitId}`
                                  : `/unit/${unitId}`,
                              },
                              {
                                label: getTopicBreadcrumbTitle(
                                  typedCurrentTopic?.title || unitData.title,
                                ),
                              },
                            ]
                          : [{ label: unitData.title }]),
                      ]}
                    />
                    {hasSelectedTopic && (
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                        <Link
                          href={courseId ? `/courses/${courseId}/units/${unitId}` : `/unit/${unitId}`}
                          className="inline-flex min-h-10 items-center gap-2 text-sm font-medium text-primary hover:underline"
                        >
                          <ChevronLeft aria-hidden="true" className="h-4 w-4" />
                          All topics
                        </Link>
                        <Button
                          type="button"
                          size="sm"
                          variant={activeCoursePanel === 'notes' ? 'default' : 'outline'}
                          aria-pressed={activeCoursePanel === 'notes'}
                          aria-label={activeCoursePanel === 'notes' ? 'Return to topic' : 'Open notes for this topic'}
                          onClick={() => openCoursePanel('notes')}
                          className="min-h-10"
                        >
                          <NotebookPen className="mr-2 h-4 w-4" />
                          {activeCoursePanel === 'notes' ? 'Back to topic' : 'Topic notes'}
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    {hasSelectedTopic && (
                      <Button
                        type="button"
                        size="sm"
                        variant={activeCoursePanel === 'discussion' ? 'default' : 'outline'}
                        aria-pressed={activeCoursePanel === 'discussion'}
                        onClick={() => openCoursePanel('discussion')}
                      >
                        <MessageSquare className="mr-2 h-4 w-4" />
                        Discussion
                      </Button>
                    )}
                    {unitResources.length > 0 && (
                      <details className="group relative">
                        <summary className="flex min-h-10 cursor-pointer list-none items-center rounded-md border border-border bg-card px-3 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                          <BookOpen className="mr-2 h-4 w-4" />
                          Unit resources ({unitResources.length})
                        </summary>
                        <div className="absolute right-0 z-30 mt-2 grid max-h-80 w-72 max-w-[calc(100vw-2rem)] gap-1 overflow-y-auto rounded-lg border border-border bg-card p-2 shadow-lg">
                          {unitResources.map(resource => (
                            <button
                              key={resource.id}
                              type="button"
                              onClick={() => openMaterial(String(resource.id))}
                              className="min-h-10 rounded-md px-3 py-2 text-left text-sm text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                            >
                              {resource.title}
                            </button>
                          ))}
                        </div>
                      </details>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      variant={activeCoursePanel === 'unit-quiz' ? 'outline' : 'default'}
                      onClick={() => {
                        if (typedCurrentTopic?.id != null) {
                          recordCourseActivity('reading', courseId, String(typedCurrentTopic.id));
                        }
                        toggleCoursePanel('unit-quiz');
                      }}
                      aria-label={activeCoursePanel === 'unit-quiz' ? 'Return to unit content' : 'Open unit assessment'}
                      aria-pressed={activeCoursePanel === 'unit-quiz'}
                    >
                      <ClipboardCheck className="mr-2 h-4 w-4" />
                      {activeCoursePanel === 'unit-quiz' ? 'Back to unit' : 'Unit assessment'}
                    </Button>
                  </div>
                </div>

                {hasSelectedTopic && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Unit progress · {completedTopicCount} of {chapters.length} topics</span>
                      <span>{unitProgressPercentage}%</span>
                    </div>
                    <ProgressBar value={unitProgressPercentage} className="h-1.5" />
                  </div>
                )}
              </header>
            )}

            {/* Admin actions - Add Topic */}
            {!selectedMaterialId && isAdmin && (
              <div className="flex justify-end mt-4">
                <Button onClick={() => setIsAddTopicOpen(true)}>Add New Topic</Button>
              </div>
            )}

            {selectedMaterialId ? (
              <MaterialPreviewModal
                materialId={selectedMaterialId}
                isOpen={Boolean(selectedMaterialId)}
                onClose={closeMaterial}
                materials={allResources}
                onNavigate={id => updateRouteQuery('materialId', id)}
                unitId={unitId}
                courseId={courseId}
                topicId={
                  typedCurrentTopic?.id == null
                    ? undefined
                    : String(typedCurrentTopic.id)
                }
                studySessionId={activeSession?.id}
                inline
              />
            ) : activeCoursePanel === 'unit-quiz' ? (
              <div className="animate-in fade-in slide-in-from-right-4 duration-500">
                <div className="mb-4 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => toggleCoursePanel('unit-quiz')}
                    className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-blue-600"
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
              <section className="mx-auto w-full max-w-6xl space-y-6">
                <div className="flex flex-wrap items-end justify-between gap-2">
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">Learning roadmap</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {completedTopicCount} of {chapters.length} topics completed
                    </p>
                  </div>
                  <span className="text-sm font-medium text-muted-foreground">
                    {unitProgressPercentage}% complete
                  </span>
                </div>
                <ProgressBar value={unitProgressPercentage} className="h-2" />

                <ol className="space-y-3" aria-label="Topics in this unit">
                  {chapters.map((chapter, chapterIndex) => {
                    const isComplete = isTopicComplete(chapterIndex);
                    const previousTopic = chapters[chapterIndex - 1]?.lessons[0];
                    const isLocked = chapterIndex > 0 && previousTopic?.nextTopicUnlocked !== true;
                    const isCurrent = !isComplete && chapterIndex === currentTopicIndex;

                    return (
                      <li
                        key={chapter.id}
                        className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="flex min-w-0 items-start gap-3">
                          <span className="mt-0.5 shrink-0 text-muted-foreground">
                            {isComplete ? (
                              <CheckCircle aria-label="Completed" className="h-5 w-5 text-emerald-600" />
                            ) : isLocked ? (
                              <Circle aria-label="Upcoming" className="h-5 w-5" />
                            ) : (
                              <PlayCircle aria-label={isCurrent ? 'Current topic' : 'Available topic'} className="h-5 w-5 text-blue-600" />
                            )}
                          </span>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              Topic {String(chapterIndex + 1).padStart(2, '0')}
                              <span className="ml-2 normal-case tracking-normal">
                                {isComplete ? 'Completed' : isCurrent ? 'Current' : 'Upcoming'}
                              </span>
                            </p>
                            <h3 className="mt-1 font-semibold text-foreground">{chapter.title}</h3>
                            {chapter.duration && chapter.duration !== '0m' && (
                              <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                                <Clock className="h-3.5 w-3.5" />
                                {chapter.duration}
                              </p>
                            )}
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant={isCurrent ? 'default' : 'outline'}
                          disabled={isLocked}
                          onClick={() => selectTopic(chapterIndex, 0)}
                          className="shrink-0"
                        >
                          {isComplete ? 'Review topic' : isCurrent ? (selectedTopicId ? 'Continue topic' : 'Start topic') : 'Open topic'}
                          {!isLocked && <ChevronRight className="ml-2 h-4 w-4" />}
                        </Button>
                      </li>
                    );
                  })}
                </ol>
              </section>
            ) : activeCoursePanel === 'quiz' ? (
              <div className="animate-in fade-in slide-in-from-right-4 duration-500">
                <div className="flex items-center justify-between mb-4">
                  <button
                    onClick={() => toggleCoursePanel('quiz')}
                    className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-blue-600 transition-colors"
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
                  navigatePrev={navigatePrev}
                  navigateNext={navigateNext}
                  onOpenMasteryQuiz={() => toggleCoursePanel('quiz')}
                  isFirstLesson={isFirstLesson}
                  isLastLesson={isLastLesson}
                  canNavigateNext={canNavigateNext}
                  isNextTopicLocked={isNextTopicLocked}
                  materials={materialsForCurrentTopic as unknown as Material[]}
                  openMaterial={openMaterial}
                  masteryPassingScore={TOPIC_MASTERY_PASSING_SCORE}
                />

              </>
            )}

            {/* Notes panel */}
            {!selectedMaterialId && activeCoursePanel === 'notes' && (
              <NotesPanel
                topicId={typedCurrentTopic?.id == null ? undefined : String(typedCurrentTopic.id)}
                lessonKey={lessonKey}
                notes={notes}
                saveNote={saveNote}
              />
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
      <Dialog
        open={isAddTopicOpen}
        onOpenChange={open => {
          setIsAddTopicOpen(open);
          if (!open) setCreatedTopic(null);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <TopicForm
            topic={createdTopic}
            courseId={courseId}
            courseTitle={unitData?.courseName}
            unitId={unitId}
            unitTitle={unitData?.title}
            onSave={handleAddTopic}
            onCancel={() => {
              setIsAddTopicOpen(false);
              setCreatedTopic(null);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};