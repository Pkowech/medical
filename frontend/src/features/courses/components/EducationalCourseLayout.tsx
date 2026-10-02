'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Play, FileText, Download, BookOpen, Lightbulb } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useLayoutStore } from '@/core/stores/useLayoutStore';
import { cn } from '@/lib/utils/cn';
import { usePageHeader } from '@/core/providers/HeaderContext';
import { useCourseProgressStore } from '../hooks/useCourseProgressStore';
import { Breadcrumb } from '@/shared/components/ui/breadcrumb';
import { ProgressBar } from '@/shared/components/ui/ProgressBar';
import { PrerequisitesChecker } from './PrerequisitesChecker';
import { CourseSidebar } from './CourseSidebar';
import { CourseContent } from './CourseContent';
import { Material } from '@/shared/types/materialInterface';
import { NotesPanel } from './NotesPanel';
import { DiscussionPanel } from './DiscussionPanel';
import { QuizPanel } from './QuizPanel';
import { useCourseData } from '../hooks/useCourseData';
import { useCourseNavigation } from '../hooks/useCourseNavigation';
import { URLS } from '@/lib/urls';
import { useXapi } from '@/lib/xapi/useXapi';
import { MaterialPreviewModal } from './MaterialPreviewModal';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';

// Material type icons for better visual representation
const MATERIAL_ICONS: Record<string, React.ReactNode> = {
  VIDEO: <Play className="w-5 h-5" />,
  PDF: <FileText className="w-5 h-5" />,
  DOCUMENT: <FileText className="w-5 h-5" />,
  ARTICLE: <FileText className="w-5 h-5" />,
  INTERACTIVE: <Lightbulb className="w-5 h-5" />,
  QUIZ: <BookOpen className="w-5 h-5" />,
};

interface EducationalCourseLayoutProps {
  courseId?: string;
}

// Helper function to get icon for material type
const getMaterialIcon = (type: string) => {
  return MATERIAL_ICONS[type.toUpperCase()] || <Download className="w-5 h-5" />;
};

// Helper function to organize materials by type
const organizeMaterialsByType = (materials: Material[]): Record<string, Material[]> => {
  return materials.reduce((acc, material) => {
    const type = material.type || 'DOCUMENT';
    if (!acc[type]) {
      acc[type] = [];
    }
    acc[type].push(material);
    return acc;
  }, {} as Record<string, Material[]>);
};



export const EducationalCourseLayout = ({ courseId: propCourseId }: EducationalCourseLayoutProps) => {
  const params = useParams();
  const courseId = propCourseId || (params?.courseId as string);

  // --- STATE MANAGEMENT ---
  // Global UI state from Zustand
  const { activeCoursePanel, toggleCoursePanel, sidebarOpen, sidebarCollapsed, setSidebarCollapsed } = useLayoutStore();
  // Page header hook
  const { setHeader } = usePageHeader();
  // Course progress state from Zustand
  const { progress, bookmarks, notes, markLessonComplete, toggleLessonComplete, toggleBookmark, saveNote } =
    useCourseProgressStore();
  // Local component state
  const [offlineMode, setOfflineMode] = useState(false);
  const [showPrerequisites, setShowPrerequisites] = useState(true);
  const [selectedMaterialId, setSelectedMaterialId] = useState<string | null>(null);

  const openMaterial = (id: string) => {
    setSidebarCollapsed(false);
    setSelectedMaterialId(id);
  };
  const closeMaterial = () => {
    setSidebarCollapsed(false);
    setSelectedMaterialId(null);
  };

  // --- DATA FETCHING & HOOKS ---
  const { data: courseData, isLoading: isCourseLoading, error: courseError, refetch: refetchCourse } = useCourseData(courseId);
  const {
    currentChapterIndex,
    currentLessonIndex,
    lessonKey,
    navigateTo,
    navigateNext,
    navigatePrev,
    isFirstLesson,
    isLastLesson,
  } = useCourseNavigation(courseData?.chapters || []);

  // ✅ HOOKS MUST BE CALLED BEFORE ANY EARLY RETURNS
  // Set page header based on course data
  useEffect(() => {
    if (courseData?.title) {
      setHeader({
        title: courseData.title,
        description: courseData.description || 'Course content',
        icon: '📖',
      });
    }

    return () => {
      setHeader(null);
    };
  }, [courseData?.title, courseData?.description, setHeader]);

  // Handle prerequisite logic
  const handlePrerequisitesMet = (met: boolean) => {
    if (met) setShowPrerequisites(false);
  };

  // Online/offline detection
  useEffect(() => {
    const handleOnline = () => setOfflineMode(false);
    const handleOffline = () => setOfflineMode(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const getCurrentLesson = () => {
    const chapter = courseData?.chapters?.[currentChapterIndex];
    return chapter ? chapter.lessons[currentLessonIndex] : undefined;
  };

  // Get current lesson directly - CourseContent can handle the raw shape
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const typedCurrentLesson = getCurrentLesson() as any;

  const materialsForCurrentLesson: Material[] = useMemo(() => {
    if (!courseData || !courseData.resources || !typedCurrentLesson) return [];
    
    // The current chapter (unit)
    const chapter = courseData.chapters?.[currentChapterIndex];
    if (!chapter) return [];

    const lessonId = String(typedCurrentLesson.id);
    const unitId = String(chapter.id);

    return (courseData.resources as unknown as Material[]).filter((m: unknown) => {
      const mWithUnit = m as Material & {
        unitId?: string | number;
        unit?: { id: string | number };
        topicId?: string | number;
      };
      if (mWithUnit.topicId) {
        return String(mWithUnit.topicId) === lessonId;
      }
      const materialUnitId = String(mWithUnit.unitId || mWithUnit.unit?.id || '');
      return materialUnitId === unitId;
    });
  }, [courseData, typedCurrentLesson, currentChapterIndex]);

  const { trackAction, XAPI_VERBS } = useXapi();

  // Track Course Launch
  useEffect(() => {
    if (courseData?.id && courseData?.title) {
      trackAction(XAPI_VERBS.LAUNCHED, {
        id: `${URLS.BASE}/courses/${courseData.id}`,
        definition: {
          name: { 'en-US': courseData.title },
          type: 'http://adlnet.gov/expapi/activities/course',
        },
      });
    }
  }, [courseData?.id, courseData?.title, trackAction, XAPI_VERBS.LAUNCHED]);

  // --- EARLY RETURNS (AFTER ALL HOOKS) ---
  if (isCourseLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50/50 dark:bg-slate-900/50">
        <p className="text-gray-600 dark:text-slate-400">Loading course content...</p>
      </div>
    );
  }

  if (courseError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50/50 dark:bg-slate-900/50">
        <div className="text-center">
          <p className="text-red-600 dark:text-red-400 font-semibold">Error loading course</p>
          <p className="text-gray-600 dark:text-slate-400 text-sm mt-2">
            {courseError instanceof Error ? courseError.message : 'Failed to load course data'}
          </p>
        </div>
      </div>
    );
  }

  if (!courseData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50/50 dark:bg-slate-900/50">
        <p className="text-gray-600 dark:text-slate-400">Course not found.</p>
      </div>
    );
  }

  const courseTopicCount = (courseData.chapters || []).reduce(
    (total, chapter) => total + chapter.lessons.length,
    0,
  );
  const completedCourseTopicCount = (courseData.chapters || []).reduce(
    (total, chapter) => total + chapter.lessons.filter(lesson => lesson.isCompleted).length,
    0,
  );
  const courseProgressPercentage = courseTopicCount
    ? Math.round((completedCourseTopicCount / courseTopicCount) * 100)
    : 0;

  type ResourceLike = Partial<Material> & { contentType?: string; size?: string; url?: string; id?: string | number; title?: string; unitId?: string | number; topicId?: string | number; unit?: { id: string | number } };
  const sidebarResources: { id: string | number; title: string; type: string; size?: string; url: string; unitId?: string | number; topicId?: string | number }[] = ((courseData.resources || []) as ResourceLike[]).map(m => ({
    id: m.id ?? 'unknown',
    title: m.title ?? 'Untitled',
    type: m.type ?? m.contentType ?? 'document',
    size: m.size,
    url: m.url ?? '',
    unitId: m.unitId || m.unit?.id,
    topicId: m.topicId,
  }));

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-gray-50/50 dark:bg-slate-900">
      <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden relative">
        <div className={cn(
          "fixed lg:static inset-y-0 left-0 z-60 lg:z-40 h-full min-h-0 w-80 shrink-0 overflow-hidden transition-[width,transform] duration-300 ease-in-out",
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
          sidebarCollapsed && selectedMaterialId ? "lg:w-0" : "lg:w-80"
        )}>
          <CourseSidebar
            chapters={courseData.chapters || []}
            resources={sidebarResources}
            currentChapterIndex={currentChapterIndex}
            currentLessonIndex={currentLessonIndex}
            navigateTo={navigateTo}
            progress={progress}
            toggleCoursePanel={toggleCoursePanel}
            openMaterial={openMaterial}
            allowCollapse={Boolean(selectedMaterialId)}
          />
        </div>

        {/* Main Content Area */}
        <main className={cn(
          'min-h-0 min-w-0 flex-1 overscroll-contain scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-slate-700',
          selectedMaterialId ? 'flex overflow-hidden p-0' : 'overflow-y-auto p-4 md:p-8',
        )}>
          <div className={cn(
            'max-w-5xl mx-auto space-y-6 md:space-y-8 pb-20',
            selectedMaterialId && 'flex h-full w-full max-w-none flex-1 flex-col space-y-0 pb-0',
          )}>
            {!selectedMaterialId && <div className="space-y-4">
              <div className="flex items-center gap-3">
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
              <ProgressBar value={courseProgressPercentage} className="h-2" />
            </div>}

            {/* Prerequisites Checker */}
            {!selectedMaterialId && showPrerequisites && courseId && (
              <div className="animate-in fade-in slide-in-from-top-4 duration-500">
                <PrerequisitesChecker
                  courseId={courseId}
                  onPrerequisitesMet={handlePrerequisitesMet}
                />
              </div>
            )}

            {selectedMaterialId ? (
              <MaterialPreviewModal
                materialId={selectedMaterialId}
                isOpen={Boolean(selectedMaterialId)}
                onClose={closeMaterial}
                materials={sidebarResources}
                onNavigate={setSelectedMaterialId}
                inline
              />
            ) : activeCoursePanel === 'quiz' ? (
              <div className="animate-in fade-in slide-in-from-right-4 duration-500">
                <div className="flex items-center justify-between mb-4">
                   <button 
                    onClick={() => toggleCoursePanel('quiz')}
                    className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-blue-600 transition-colors"
                   >
                     <ChevronLeft className="w-4 h-4" />
                     Back to Lesson
                   </button>
                </div>
                <QuizPanel 
                  lessonId={typedCurrentLesson?.id} 
                  lessonTitle={typedCurrentLesson?.title} 
                  scope="topic"
                  onTopicProgressUpdated={() => refetchCourse().then(() => undefined)}
                  onTopicCompleted={() => markLessonComplete(lessonKey)}
                />
              </div>
            ) : (
              <>
                <CourseContent
                  currentLesson={typedCurrentLesson}
                  lessonKey={lessonKey}
                  offlineMode={offlineMode}
                  bookmarks={new Set(bookmarks)}
                  progress={progress}
                  toggleBookmark={toggleBookmark}
                  toggleLessonComplete={toggleLessonComplete}
                  navigatePrev={navigatePrev}
                  navigateNext={navigateNext}
                  onOpenMasteryQuiz={() => toggleCoursePanel('quiz')}
                  isFirstLesson={isFirstLesson}
                  isLastLesson={isLastLesson}
                  materials={materialsForCurrentLesson}
                  openMaterial={openMaterial}
                />

                {/* Lesson Materials Section */}
                {materialsForCurrentLesson.length > 0 && (
                  <div className="mt-8 pt-8 border-t border-gray-200 dark:border-slate-700">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Lesson Materials</h2>
                    
                    {/* Materials organized by type */}
                    {Object.entries(organizeMaterialsByType(materialsForCurrentLesson)).map(
                      ([type, materials]) => (
                        <div key={type} className="mb-6">
                          <h3 className="text-lg font-semibold text-gray-800 dark:text-slate-200 mb-3 flex items-center gap-2">
                            {getMaterialIcon(type)}
                            {type}s
                          </h3>
                          <div className="space-y-2">
                            {materials.map(material => (
                              <div
                                key={material.id}
                                className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-slate-700/50 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors border border-gray-200 dark:border-slate-600"
                              >
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                  <div className="text-gray-400 dark:text-slate-400 flex-shrink-0">
                                    {getMaterialIcon(material.type || 'DOCUMENT')}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                      {material.title}
                                    </p>
                                    {material.description && (
                                      <p className="text-xs text-gray-500 dark:text-slate-400 truncate">
                                        {material.description}
                                      </p>
                                    )}
                                  </div>
                                  <Badge variant="outline" className="text-xs whitespace-nowrap ml-2">
                                    {material.type || 'Material'}
                                  </Badge>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="ml-2 flex-shrink-0"
                                  onClick={() => {
                                    if (material.url) {
                                      window.open(material.url, '_blank');
                                    }
                                  }}
                                >
                                  <Download className="w-4 h-4" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    )}
                  </div>
                )}
              </>
            )}

            {/* Side Panels (Notes & Discussion stay as overlays/side panels) */}
            {!selectedMaterialId && activeCoursePanel === 'notes' && (
              <NotesPanel lessonKey={lessonKey} notes={notes} saveNote={saveNote} />
            )}
            {!selectedMaterialId && activeCoursePanel === 'discussion' && (
              <DiscussionPanel
                discussions={((courseData?.discussions || []) as unknown as Record<string, unknown>[]).map((d, idx) => ({
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
