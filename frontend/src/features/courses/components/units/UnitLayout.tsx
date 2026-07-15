'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  ChevronLeft,
  Play,
  FileText,
  Download,
  BookOpen,
  Lightbulb,
  ExternalLink,
  X,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useParams } from 'next/navigation';
import { useLayoutStore } from '@/core/stores/useLayoutStore';
import { cn } from '@/lib/utils/cn';
import { usePageHeader } from '@/core/providers/HeaderContext';
import { useCourseProgressStore } from '@/features/courses/hooks/useCourseProgressStore';
import { Breadcrumb } from '@/shared/components/ui/breadcrumb';
import { ProgressBar } from '@/shared/components/ui/ProgressBar';
import { CourseSidebar } from '@/features/courses/components/CourseSidebar';
import { CourseContent } from '@/features/courses/components/CourseContent';
import { Material } from '@/shared/types/materialInterface';
import { NotesPanel } from '@/features/courses/components/NotesPanel';
import { DiscussionPanel } from '@/features/courses/components/DiscussionPanel';
import { QuizPanel } from '@/features/courses/components/QuizPanel';
import { useUnitData } from '@/features/courses/hooks/useUnitData';
import { useCourseNavigation } from '@/features/courses/hooks/useCourseNavigation';
import { useXapi } from '@/lib/xapi/useXapi';
import { MaterialPreviewModal } from '@/features/courses/components/MaterialPreviewModal';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MATERIAL_ICONS: Record<string, React.ReactNode> = {
  VIDEO: <Play className="w-4 h-4" />,
  PDF: <FileText className="w-4 h-4" />,
  DOCUMENT: <FileText className="w-4 h-4" />,
  ARTICLE: <FileText className="w-4 h-4" />,
  INTERACTIVE: <Lightbulb className="w-4 h-4" />,
  QUIZ: <BookOpen className="w-4 h-4" />,
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UnitLayoutProps {
  unitId?: string;
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
// Helpers
// ---------------------------------------------------------------------------

const getMaterialIcon = (type: string) =>
  MATERIAL_ICONS[type.toUpperCase()] ?? <Download className="w-4 h-4" />;

/**
 * Helper to organize materials by type
 */
const organizeMaterialsByType = (materials: NormalisedMaterial[]): Record<string, NormalisedMaterial[]> => {
  return materials.reduce((acc, material) => {
    const type = material.type || 'DOCUMENT';
    if (!acc[type]) {
      acc[type] = [];
    }
    acc[type].push(material);
    return acc;
  }, {} as Record<string, NormalisedMaterial[]>);
};

/**
 * Inline material viewer.
 *
 * - VIDEO  → <video> element
 * - PDF    → <iframe> / <object>
 * - ARTICLE / DOCUMENT / TEXT → rich text / iframe
 * - anything else → download prompt
 */
const InlineMaterialViewer = ({
  material,
  onClose,
}: {
  material: NormalisedMaterial;
  onClose: () => void;
}) => {
  const type = (material.type || '').toUpperCase();

  const renderContent = () => {
    if (type === 'VIDEO') {
      return (
        <video
          src={material.url}
          controls
          autoPlay
          className="w-full rounded-lg max-h-[60vh] bg-black"
        >
          Your browser does not support video playback.
        </video>
      );
    }

    if (type === 'PDF') {
      return (
        <iframe
          src={`${material.url}#toolbar=1&navpanes=0`}
          title={material.title}
          className="w-full rounded-lg border border-gray-200 dark:border-slate-600"
          style={{ height: '70vh' }}
        />
      );
    }

    // ARTICLE / DOCUMENT — try iframe first, fallback to open-in-tab prompt
    if (['ARTICLE', 'DOCUMENT', 'INTERACTIVE'].includes(type)) {
      return (
        <iframe
          src={material.url}
          title={material.title}
          className="w-full rounded-lg border border-gray-200 dark:border-slate-600"
          style={{ height: '70vh' }}
        />
      );
    }

    // Default: download / open externally
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
        <div className="text-gray-400 dark:text-slate-500">{getMaterialIcon(type)}</div>
        <p className="text-gray-600 dark:text-slate-300 text-sm">
          This material type cannot be previewed inline.
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.open(material.url, '_blank')}
          className="gap-2"
        >
          <ExternalLink className="w-4 h-4" />
          Open in new tab
        </Button>
      </div>
    );
  };

  return (
    <div className="mt-4 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/50">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-gray-400 dark:text-slate-400 shrink-0">
            {getMaterialIcon(material.type)}
          </span>
          <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
            {material.title}
          </span>
          <Badge variant="outline" className="text-xs shrink-0">
            {material.type}
          </Badge>
        </div>
        <div className="flex items-center gap-1 shrink-0 ml-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.open(material.url, '_blank')}
            className="h-7 w-7 p-0"
            title="Open in new tab"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-7 w-7 p-0"
            title="Close"
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="p-0">{renderContent()}</div>
    </div>
  );
};

/**
 * Expandable materials list for a topic, organized by type.
 * Clicking a material opens the InlineMaterialViewer below the list.
 */
const TopicMaterialsSection = ({ materials }: { materials: NormalisedMaterial[] }) => {
  const [openMaterialId, setOpenMaterialId] = useState<string | number | null>(null);

  if (materials.length === 0) return null;

  const activeMaterial = materials.find(m => m.id === openMaterialId) ?? null;
  const materialsByType = organizeMaterialsByType(materials);

  const handleMaterialClick = (material: NormalisedMaterial) => {
    if (!material.url) return;
    setOpenMaterialId(prev => (prev === material.id ? null : material.id));
  };

  return (
    <div className="mt-8 pt-8 border-t border-gray-200 dark:border-slate-700">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Topic Materials</h2>

      {Object.entries(materialsByType).map(([type, typeMaterials]) => (
        <div key={type} className="mb-6">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-slate-200 mb-3 flex items-center gap-2">
            {getMaterialIcon(type)}
            {type}s
          </h3>
          <div className="space-y-2">
            {typeMaterials.map(material => {
              const isOpen = openMaterialId === material.id;
              return (
                <div key={material.id}>
                  <div
                    className={cn(
                      'flex items-center justify-between p-3 rounded-lg transition-colors border cursor-pointer select-none',
                      isOpen
                        ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700'
                        : 'bg-gray-50 dark:bg-slate-700/50 border-gray-200 dark:border-slate-600 hover:bg-gray-100 dark:hover:bg-slate-700',
                    )}
                    onClick={() => handleMaterialClick(material)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={e => e.key === 'Enter' && handleMaterialClick(material)}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div
                        className={cn(
                          'shrink-0 transition-colors',
                          isOpen
                            ? 'text-blue-500 dark:text-blue-400'
                            : 'text-gray-400 dark:text-slate-400',
                        )}
                      >
                        {getMaterialIcon(material.type || 'DOCUMENT')}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p
                          className={cn(
                            'text-sm font-medium truncate transition-colors',
                            isOpen
                              ? 'text-blue-700 dark:text-blue-300'
                              : 'text-gray-900 dark:text-white',
                          )}
                        >
                          {material.title}
                        </p>
                        {material.description && (
                          <p className="text-xs text-gray-500 dark:text-slate-400 truncate mt-0.5">
                            {material.description}
                          </p>
                        )}
                      </div>

                      <Badge
                        variant="outline"
                        className={cn(
                          'text-xs whitespace-nowrap ml-2 transition-colors',
                          isOpen && 'border-blue-300 dark:border-blue-600 text-blue-600 dark:text-blue-400',
                        )}
                      >
                        {material.type || 'Material'}
                      </Badge>
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-2 shrink-0 h-7 w-7 p-0"
                      title="Download"
                      onClick={e => {
                        e.stopPropagation();
                        if (material.url) window.open(material.url, '_blank');
                      }}
                    >
                      <Download className="w-3.5 h-3.5" />
                    </Button>
                  </div>

                  {isOpen && activeMaterial && (
                    <InlineMaterialViewer
                      material={activeMaterial}
                      onClose={() => setOpenMaterialId(null)}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export const UnitLayout = ({ unitId: propUnitId }: UnitLayoutProps) => {
  const params = useParams();
  const unitId = propUnitId || (params?.unitId as string);

  // ── Global UI state ────────────────────────────────────────────────────
  const { activeCoursePanel, toggleCoursePanel, sidebarOpen } = useLayoutStore();

  // ── Page header ────────────────────────────────────────────────────────
  const { setHeader } = usePageHeader();

  // ── Progress store ─────────────────────────────────────────────────────
  const { progress, bookmarks, notes, markLessonComplete, toggleBookmark, saveNote } =
    useCourseProgressStore();

  // ── Local state ────────────────────────────────────────────────────────
  const [offlineMode, setOfflineMode] = useState(false);
  const [selectedMaterialId, setSelectedMaterialId] = useState<string | null>(null);
  const [isAdmin, _setIsAdmin] = useState(true); // Placeholder for admin status

  const openMaterial = (id: string) => setSelectedMaterialId(id);
  const closeMaterial = () => setSelectedMaterialId(null);

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
  const { data: unitData, isLoading: isUnitLoading, error: unitError, refetch: refetchUnit } = useUnitData(unitId);

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
  } = useCourseNavigation(unitData?.chapters || []);

  // ── Page header sync ───────────────────────────────────────────────────
  useEffect(() => {
    if (unitData?.title) {
      setHeader({
        title: unitData.title,
        description: unitData.description || 'Unit content and materials',
        icon: '�',
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

  const typedCurrentTopic = getCurrentTopic() as unknown as { id?: string | number; resources?: Material[] };

  // ── Materials for the current topic ───────────────────────────────────
  // The lesson carries `resources` (set in normalizeUnitToChapters).
  // We also scan the top-level resources array as a fallback.
  const materialsForCurrentTopic: NormalisedMaterial[] = useMemo(() => {
    if (!unitData || !typedCurrentTopic) return [];

    const topicId = String(typedCurrentTopic.id);

    // 1. Materials attached directly to the lesson (preferred)
    const lessonResources: Material[] = typedCurrentTopic.resources || [];

    // 2. Fallback: scan top-level resources that reference this topic
    const topLevelMatches = ((unitData.resources || []) as Material[]).filter(m => {
      const mTyped = m as Material & { unitId?: string | number; unit?: { id: string | number } };
      return String(mTyped.unitId || mTyped.unit?.id || '') === topicId;
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
      }));
  }, [unitData, typedCurrentTopic]);

  // ── xAPI tracking ──────────────────────────────────────────────────────
  const { trackAction, XAPI_VERBS } = useXapi();

  useEffect(() => {
    if (unitData?.id && unitData?.title) {
      trackAction(XAPI_VERBS.LAUNCHED, {
        id: `https://medtrackhub.com/units/${unitData.id}`,
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

  if (unitError) {
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

  // ── Sidebar resources (all materials for the sidebar Resources panel) ──
  type ResourceLike = Partial<Material> & {
    contentType?: string;
    size?: string;
    url?: string;
    id?: string | number;
    title?: string;
    unitId?: string | number;
    unit?: { id: string | number };
  };

  const sidebarResources = ((unitData.resources || []) as ResourceLike[]).map(m => ({
    id: m.id ?? 'unknown',
    title: m.title ?? 'Untitled',
    type: m.type ?? m.contentType ?? 'document',
    size: m.size,
    url: m.url ?? '',
    unitId: m.unitId || m.unit?.id,
  }));

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col flex-1 min-h-0 bg-gray-50/50 dark:bg-slate-900">
      <div className="flex flex-1 overflow-hidden relative">

        {/*
         * Sidebar
         * unitData.chapters is now [topic1, topic2, …] — one chapter per topic.
         * CourseSidebar will render each chapter (topic) as a top-level item,
         * exactly like it renders lessons in the course layout.
         */}
        <div
          className={cn(
            'fixed lg:static inset-y-0 left-0 z-[60] lg:z-40 transition-transform duration-300 ease-in-out',
            sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
          )}
        >
          <CourseSidebar
            chapters={unitData.chapters || []}
            resources={sidebarResources}
            currentChapterIndex={currentChapterIndex}
            currentLessonIndex={currentLessonIndex}
            navigateTo={navigateTo}
            progress={progress}
            toggleCoursePanel={toggleCoursePanel}
            openMaterial={openMaterial}
          />
        </div>

        {/* Main content area */}
        <main className="flex-1 p-4 md:p-8 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-slate-700">
          <div className="max-w-5xl mx-auto space-y-6 md:space-y-8 pb-20">

            {/* Breadcrumb + progress */}
            <div className="space-y-4">
              <Breadcrumb />
              <ProgressBar value={50} className="h-2" />
            </div>

            {/* Admin actions - Add Topic */}
            {isAdmin && (
              <div className="flex justify-end mt-4">
                <Button onClick={handleAddTopic}>Add New Topic</Button>
              </div>
            )}

            {/* Quiz panel */}
            {activeCoursePanel === 'quiz' ? (
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
                  markLessonComplete={markLessonComplete}
                  navigatePrev={navigatePrev}
                  navigateNext={navigateNext}
                  isFirstLesson={isFirstLesson}
                  isLastLesson={isLastLesson}
                  materials={materialsForCurrentTopic as unknown as Material[]}
                  openMaterial={openMaterial}
                />

                {/*
                 * Topic materials — expandable list with INLINE viewer.
                 * Clicking a PDF opens it in an iframe right below the row.
                 * Clicking a video opens a <video> player.
                 * Everything stays on the same page; no modal required.
                 */}
                <TopicMaterialsSection materials={materialsForCurrentTopic} />
              </>
            )}

            {/* Notes panel */}
            {activeCoursePanel === 'notes' && (
              <NotesPanel lessonKey={lessonKey} notes={notes} saveNote={saveNote} />
            )}

            {/* Discussion panel */}
            {activeCoursePanel === 'discussion' && (
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

      {/* Fallback modal (used only when openMaterial() is called from sidebar resource clicks) */}
      <MaterialPreviewModal
        materialId={selectedMaterialId}
        isOpen={!!selectedMaterialId}
        onClose={closeMaterial}
      />
    </div>
  );
};