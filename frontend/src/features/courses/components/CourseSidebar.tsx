import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  MessageSquare,
  Edit3,
  FileText,
  CheckCircle,
  Circle,
  Lock,
  X,
  PlayCircle,
  ExternalLink,
} from 'lucide-react';
import { useLayoutStore } from '@/core/stores/useLayoutStore';
import type { CourseSidebarProps } from '@/shared/types/courseInterface';

type CourseSidebarComponentProps = CourseSidebarProps & {
  onDownloadMaterial?: (materialId: string) => void;
  allowCollapse?: boolean;
};

export const CourseSidebar = ({
  chapters,
  resources,
  parentUnitId,
  currentChapterIndex,
  currentLessonIndex,
  navigateTo,
  progress,
  toggleCoursePanel,
  openMaterial,
  onDownloadMaterial,
  allowCollapse = false,
}: CourseSidebarComponentProps) => {
  const { setSidebarOpen, setSidebarCollapsed } = useLayoutStore();
  const router = useRouter();
  const params = useParams<{ courseId?: string }>();
  const courseId = params?.courseId;
  const [expandedLessonMaterials, setExpandedLessonMaterials] = useState<string | number | null>(null);
  const [expandedChapterId, setExpandedChapterId] = useState<string | number | null>(
    chapters[currentChapterIndex]?.id ?? null,
  );

  useEffect(() => {
    setExpandedChapterId(chapters[currentChapterIndex]?.id ?? null);
  }, [chapters[currentChapterIndex]?.id, currentChapterIndex]);

  const toggleMaterials = (e: React.MouseEvent, lessonId: string | number) => {
    e.stopPropagation();
    setExpandedLessonMaterials(prev => prev === lessonId ? null : lessonId);
  };

  const getLessonResources = (
    lessonId: string | number,
    chapterId: string | number,
  ) => resources.filter(resource => {
    if (resource.topicId) {
      return String(resource.topicId) === String(lessonId);
    }
    if (parentUnitId) return false;
    return String(resource.unitId) === String(parentUnitId || chapterId);
  });

  return (
    <div className="w-80 h-full min-h-0 transition-all duration-300 overflow-hidden bg-card dark:bg-card border-r border-border dark:border-border flex flex-col shadow-xl">
      <div className="lg:hidden flex justify-end p-4 border-b border-border dark:border-border">
        <button
          type="button"
          onClick={() => setSidebarOpen(false)}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-muted p-2 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:bg-card dark:text-muted-foreground dark:hover:text-foreground"
          aria-label="Close sidebar"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="p-6">
          {/* Course Navigation */}
          <div className="mb-8">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-foreground dark:text-foreground">Course Content</h3>
              {allowCollapse && (
                <button
                  type="button"
                  onClick={() => setSidebarCollapsed(true)}
                  className="hidden h-8 w-8 items-center justify-center rounded-md border border-border bg-background text-muted-foreground shadow-sm transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-border dark:bg-card dark:text-muted-foreground dark:hover:bg-secondary dark:hover:text-foreground lg:inline-flex"
                  aria-label="Collapse course sidebar"
                  title="Collapse course sidebar"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="space-y-2">
              {chapters.length > 0 ? (
                chapters.map((chapter, chapterIndex) => {
                  const previousChapter = chapters[chapterIndex - 1];
                  const previousTopic = previousChapter?.lessons?.at(-1);
                  const chapterLocked = Boolean(
                    chapterIndex > 0 &&
                    chapterIndex > currentChapterIndex &&
                    previousTopic?.nextTopicUnlocked !== true,
                  );
                  const isExpanded = expandedChapterId === chapter.id;
                  const onlyLesson = chapter.lessons.length === 1 ? chapter.lessons[0] : undefined;
                  const isFlattenedTopic = Boolean(
                    onlyLesson &&
                    chapter.title.trim().toLocaleLowerCase() ===
                      onlyLesson.title.trim().toLocaleLowerCase(),
                  );
                  const isActiveChapter =
                    currentChapterIndex === chapterIndex && currentLessonIndex === 0;
                  const isFlattenedComplete = Boolean(
                    onlyLesson?.masteryUnlocked ||
                    onlyLesson?.isCompleted ||
                    (onlyLesson && progress[`${chapter.id}-${onlyLesson.id}`]),
                  );

                  return (
                  <div key={chapter.id} className="border border-border dark:border-border rounded-lg overflow-hidden">
                    <button
                      type="button"
                      disabled={chapterLocked}
                      aria-expanded={isFlattenedTopic ? undefined : isExpanded}
                      className={`flex min-h-12 w-full items-center justify-between gap-3 p-3 text-left transition-colors hover:bg-background dark:hover:bg-card/50 disabled:cursor-not-allowed disabled:opacity-60 ${
                        isActiveChapter ? 'border-l-2 border-primary bg-primary/[0.06]' : ''
                      }`}
                      onClick={() => {
                        if (chapterLocked) return;
                        if (isFlattenedTopic) {
                          setExpandedChapterId(chapter.id);
                          if (!parentUnitId && courseId) {
                            router.push(`/courses/${courseId}/units/${chapter.id}`);
                          } else {
                            navigateTo(chapterIndex, 0);
                          }
                          return;
                        }
                        setExpandedChapterId(isExpanded ? null : chapter.id);
                        if (!parentUnitId && courseId) {
                          router.push(`/courses/${courseId}/units/${chapter.id}`);
                        } else if (!isExpanded && currentChapterIndex !== chapterIndex) {
                          navigateTo(chapterIndex, 0);
                        }
                      }}
                      title={chapterLocked ? 'Pass the previous topic quiz to unlock this topic' : `Navigate to chapter ${chapter.title}`}
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground dark:text-foreground">{chapter.title}</p>
                        <p className="text-[13px] text-foreground/75">
                          {isFlattenedTopic
                            ? `1 lesson · ${onlyLesson?.duration ?? chapter.duration}`
                            : chapter.duration}
                        </p>
                      </div>
                      {isFlattenedTopic ? (
                        isFlattenedComplete ? (
                          <CheckCircle aria-label="Mastered" className="h-4 w-4 shrink-0 text-green-600" />
                        ) : chapterLocked ? (
                          <Lock aria-label="Locked" className="h-4 w-4 shrink-0 text-muted-foreground" />
                        ) : (
                          <Circle aria-label="Not started" className="h-4 w-4 shrink-0 text-primary" />
                        )
                      ) : (
                        <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                      )}
                    </button>
                    {isExpanded && !isFlattenedTopic && (
                      <div className="border-t border-border dark:border-border bg-background/50 dark:bg-card/50">
                        {chapter.lessons.map((lesson, lessonIndex) => {
                          const previousLesson = chapter.lessons[lessonIndex - 1];
                          const previousLessonUnlocked = previousLesson?.nextTopicUnlocked === true;
                          const isLocked = Boolean(
                            (chapterLocked || (lessonIndex > 0 && !previousLessonUnlocked)),
                          );
                          const isActive = currentLessonIndex === lessonIndex && currentChapterIndex === chapterIndex;
                          const isMarkedStudied = Boolean(progress[`${chapter.id}-${lesson.id}`]);
                          const readingProgress = Math.min(
                            100,
                            Math.max(0, lesson.readingProgressPercentage ?? 0),
                          );
                          const lessonResources = getLessonResources(lesson.id, chapter.id);
                          
                          return (
                            <React.Fragment key={lesson.id}>
                              <div
                                className={`w-full flex items-center justify-between p-3 text-left hover:bg-card dark:hover:bg-card transition-all ${
                                  isActive
                                    ? 'bg-blue-50 dark:bg-blue-500/10 border-l-2 border-blue-500'
                                    : ''
                                } ${isLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
                                title={isLocked ? `Lesson locked: Complete previous mastery quiz` : `Navigate to lesson ${lesson.title}`}
                              >
                                <div className="flex items-center space-x-3">
                                  {isLocked ? (
                                    <Lock className="w-4 h-4 text-muted-foreground" />
                                  ) : lessonResources.length > 0 ? (
                                    <button
                                      type="button"
                                      onClick={(e) => toggleMaterials(e, lesson.id)}
                                      aria-expanded={expandedLessonMaterials === lesson.id}
                                      aria-label={`View materials for ${lesson.title}`}
                                      className="z-10 flex h-11 w-11 items-center justify-center rounded-full bg-blue-50 shadow-sm shadow-blue-500/20 ring-2 ring-blue-400/30 transition-all hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:bg-blue-900/20"
                                      title="Click to view relevant materials (videos, links, etc.)"
                                    >
                                      {lesson.masteryUnlocked ? (
                                        <CheckCircle className="w-4 h-4 text-green-500" />
                                      ) : isMarkedStudied ? (
                                        <CheckCircle className="w-4 h-4 text-muted-foreground" />
                                      ) : (
                                        <Circle className="w-4 h-4 text-blue-500" />
                                      )}
                                    </button>
                                  ) : lesson.masteryUnlocked ? (
                                    <CheckCircle className="w-4 h-4 text-green-500" />
                                  ) : isMarkedStudied ? (
                                    <CheckCircle className="w-4 h-4 text-muted-foreground" />
                                  ) : (
                                    <Circle className="w-4 h-4 text-muted-foreground" />
                                  )}
                                  <button
                                    type="button"
                                    disabled={isLocked}
                                    onClick={() => !isLocked && navigateTo(chapterIndex, lessonIndex)}
                                    className="flex-1 min-w-0 text-left disabled:cursor-not-allowed"
                                    title={isLocked ? 'Lesson locked: complete the previous mastery quiz' : `Go to lesson ${lesson.title}`}
                                  >
                                  <div>
                                    <p className="text-sm font-medium text-foreground">{lesson.title}</p>
                                    <div className="flex items-center space-x-2">
                                      <p className="text-xs text-muted-foreground dark:text-muted-foreground">{lesson.duration}</p>
                                      {readingProgress > 0 && (
                                        <span className="text-xs text-muted-foreground">
                                          Reading {readingProgress}%
                                        </span>
                                      )}
                                      {lesson.masteryUnlocked && (
                                        <span className="rounded-full bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-200">
                                          Mastered
                                        </span>
                                      )}
                                      {lesson.failedAttempts != null && lesson.failedAttempts > 0 && (
                                        <span className="text-xs bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-1 rounded">
                                          {lesson.failedAttempts} attempts
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  </button>
                                </div>
                                <div className="flex items-center space-x-2">
                                  {!isLocked && lesson.readinessSignal && (
                                    <div
                                      className={`w-2 h-2 rounded-full ${
                                        lesson.readinessSignal === 'SAFE' ? 'bg-green-500' :
                                        lesson.readinessSignal === 'BORDERLINE' ? 'bg-yellow-500' : 'bg-red-500'
                                      }`} 
                                      title={`Readiness: ${lesson.readinessSignal}`}
                                    >
                                      <span className="sr-only">Readiness: {lesson.readinessSignal}</span>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Relevant Materials Inline List */}
                              {expandedLessonMaterials === lesson.id && !isLocked && (
                                <div className="bg-blue-50/30 dark:bg-blue-900/10 border-t border-b border-blue-100/50 dark:border-blue-800/30 animate-in slide-in-from-top-1 duration-200 py-2">
                                  <p className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-2 px-6">Relevant Materials</p>
                                  <div className="space-y-0.5 px-3">
                                    {lessonResources.map(material => (
                                      <button
                                        type="button"
                                        key={material.id}
                                        onClick={() => openMaterial(String(material.id))}
                                        className="flex min-h-11 w-full items-center space-x-3 rounded-md px-3 py-1.5 text-left text-foreground hover:bg-card dark:hover:bg-card transition-colors group cursor-pointer"
                                        title={`Open ${material.title} (Activity Tracked)`}
                                      >
                                        <div className="p-1 bg-blue-100/50 dark:bg-blue-900/20 rounded text-blue-600 dark:text-blue-400">
                                          {material.type.toLowerCase().includes('video') ? (
                                            <PlayCircle className="w-3 h-3" />
                                          ) : (
                                            <FileText className="w-3 h-3" />
                                          )}
                                        </div>
                                        <span className="text-xs font-medium text-foreground/75 group-hover:text-blue-600 dark:group-hover:text-blue-400 truncate flex-1">
                                          {material.title}
                                        </span>
                                        <ExternalLink className="w-2.5 h-2.5 text-gray-300 opacity-0 group-hover:opacity-100" />
                                      </button>
                                      ))
                                    }
                                    {lessonResources.length === 0 && (
                                      <p className="px-3 py-1 text-xs italic text-foreground/75">No additional materials for this unit.</p>
                                    )}
                                  </div>
                                </div>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  );
                })
              ) : (
                <div className="p-4 bg-background dark:bg-card/50 rounded-lg border border-dashed border-border dark:border-border text-center">
                  <p className="text-xs text-muted-foreground">No units available for this course yet.</p>
                </div>
              )}
            </div>
          </div>

          {/* Resources */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-foreground dark:text-foreground mb-4">Resources</h3>
            <div className="space-y-2">
              {resources.map(resource => (
                <div
                  key={resource.id}
                  className="flex min-h-12 items-center justify-between rounded-lg border border-border bg-background p-3 group hover:border-blue-300 hover:bg-muted/50 dark:border-border dark:bg-card/50 dark:hover:bg-card transition-all"
                >
                  <button
                    type="button"
                    aria-label={`Open ${resource.title}`}
                    className="flex min-h-11 min-w-0 flex-1 items-center space-x-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    onClick={() => openMaterial(String(resource.id))}
                  >
                    <div className="p-2 bg-blue-100/50 dark:bg-blue-900/20 rounded-md text-blue-600 dark:text-blue-400 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                      {resource.type.toLowerCase().includes('video') ? <PlayCircle className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{resource.title}</p>
                      {resource.size && <p className="text-xs text-foreground/75">{resource.size}</p>}
                    </div>
                    <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  </button>
                  <div className="flex items-center gap-1">
                    {(onDownloadMaterial || resource.url) && (
                      <button
                      type="button"
                      className="flex h-11 w-11 items-center justify-center text-muted-foreground hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:hover:text-blue-400 transition-colors"
                      title={`Download ${resource.title}`}
                      aria-label={`Download ${resource.title}`}
                      onClick={() => {
                        if (onDownloadMaterial) {
                          onDownloadMaterial(String(resource.id));
                        } else {
                          window.open(resource.url, '_blank', 'noopener,noreferrer');
                        }
                      }}
                    >
                      <Download className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="space-y-2 pb-6">
            <button
              onClick={() => toggleCoursePanel('notes')}
              className="flex min-h-11 w-full items-center space-x-3 rounded-lg border border-border bg-background p-3 text-left text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:bg-card/50 dark:hover:bg-secondary/50"
              title="Open Notes Panel"
            >
              <Edit3 className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-foreground">Notes</span>
            </button>
            <button
              onClick={() => toggleCoursePanel('discussion')}
              className="flex min-h-11 w-full items-center space-x-3 rounded-lg border border-border bg-background p-3 text-left text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:bg-card/50 dark:hover:bg-secondary/50"
              title="Open Discussion Panel"
            >
              <MessageSquare className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-foreground">Discussion</span>
            </button>
            <button
              onClick={() => toggleCoursePanel('quiz')}
              className="flex min-h-11 w-full items-center space-x-3 rounded-lg border border-border bg-background p-3 text-left text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:bg-card/50 dark:hover:bg-secondary/50"
              title="Open Quiz Panel"
            >
              <FileText className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-foreground">Topic Quiz</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
