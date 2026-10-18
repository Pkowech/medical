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
          className="p-2 text-muted-foreground hover:text-muted-foreground dark:text-muted-foreground dark:hover:text-muted-foreground bg-muted dark:bg-card rounded-full"
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
                  className="hidden rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground dark:text-muted-foreground dark:hover:bg-card dark:hover:text-foreground lg:inline-flex"
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
                    parentUnitId &&
                    chapterIndex > 0 &&
                    currentChapterIndex !== chapterIndex &&
                    !(previousTopic?.nextTopicUnlocked || previousTopic?.masteryUnlocked),
                  );
                  const isExpanded = expandedChapterId === chapter.id;

                  return (
                  <div key={chapter.id} className="border border-border dark:border-border rounded-lg overflow-hidden">
                    <button
                      type="button"
                      disabled={chapterLocked}
                      aria-expanded={isExpanded}
                      className="w-full flex items-center justify-between p-3 text-left hover:bg-background dark:hover:bg-card/50 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                      onClick={() => {
                        if (chapterLocked) return;
                        setExpandedChapterId(isExpanded ? null : chapter.id);
                        if (!parentUnitId && courseId) {
                          router.push(`/courses/${courseId}/units/${chapter.id}`);
                        } else if (!isExpanded && currentChapterIndex !== chapterIndex) {
                          navigateTo(chapterIndex, 0);
                        }
                      }}
                      title={chapterLocked ? 'Pass the previous topic quiz to unlock this topic' : `Navigate to chapter ${chapter.title}`}
                    >
                      <div>
                        <p className="font-semibold text-foreground dark:text-foreground">{chapter.title}</p>
                        <p className="text-xs text-muted-foreground dark:text-muted-foreground">{chapter.duration}</p>
                      </div>
                      <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                    </button>
                    {isExpanded && (
                      <div className="border-t border-border dark:border-border bg-background/50 dark:bg-card/50">
                        {chapter.lessons.map((lesson, lessonIndex) => {
                          const previousLesson = chapter.lessons[lessonIndex - 1];
                          const previousLessonUnlocked = previousLesson?.nextTopicUnlocked || previousLesson?.masteryUnlocked;
                          const isLocked = chapterLocked || (lessonIndex > 0 && !previousLessonUnlocked);
                          const isActive = currentLessonIndex === lessonIndex && currentChapterIndex === chapterIndex;
                          const isCompleted = lesson.isCompleted || progress[String(lesson.id)] || false;
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
                                      className="z-10 rounded-full bg-blue-50 p-0.5 shadow-sm shadow-blue-500/20 ring-2 ring-blue-400/30 transition-all hover:scale-125 dark:bg-blue-900/20"
                                      title="Click to view relevant materials (videos, links, etc.)"
                                    >
                                      {isCompleted ? (
                                        <CheckCircle className="w-4 h-4 text-green-500" />
                                      ) : (
                                        <Circle className="w-4 h-4 text-blue-500" />
                                      )}
                                    </button>
                                  ) : isCompleted ? (
                                    <CheckCircle className="w-4 h-4 text-green-500" />
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
                                    <p className="text-sm font-medium text-foreground dark:text-muted-foreground">{lesson.title}</p>
                                    <div className="flex items-center space-x-2">
                                      <p className="text-xs text-muted-foreground dark:text-muted-foreground">{lesson.duration}</p>
                                      {lesson.failedAttempts && lesson.failedAttempts > 0 && (
                                        <span className="text-[10px] bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-1 rounded">
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
                                  {!isLocked && lesson.masteryUnlocked && !lesson.readinessSignal && (
                                     <div className="w-2 h-2 rounded-full bg-green-500" title="Mastery Unlocked">
                                       <span className="sr-only">Mastery unlocked</span>
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
                                        className="w-full flex items-center space-x-3 px-3 py-1.5 rounded-md text-left hover:bg-card dark:hover:bg-card transition-colors group cursor-pointer"
                                        title={`Open ${material.title} (Activity Tracked)`}
                                      >
                                        <div className="p-1 bg-blue-100/50 dark:bg-blue-900/20 rounded text-blue-600 dark:text-blue-400">
                                          {material.type.toLowerCase().includes('video') ? (
                                            <PlayCircle className="w-3 h-3" />
                                          ) : (
                                            <FileText className="w-3 h-3" />
                                          )}
                                        </div>
                                        <span className="text-[11px] font-medium text-muted-foreground dark:text-muted-foreground group-hover:text-blue-600 dark:group-hover:text-blue-400 truncate flex-1">
                                          {material.title}
                                        </span>
                                        <ExternalLink className="w-2.5 h-2.5 text-gray-300 opacity-0 group-hover:opacity-100" />
                                      </button>
                                      ))
                                    }
                                    {lessonResources.length === 0 && (
                                      <p className="text-[10px] text-muted-foreground italic px-3 py-1">No additional materials for this unit.</p>
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
                  className="flex items-center justify-between p-3 bg-background dark:bg-card/30 rounded-lg border border-transparent dark:border-border/50 group hover:border-blue-200 dark:hover:border-blue-500/30 transition-all"
                >
                  <button
                    type="button"
                    aria-label={`Open ${resource.title}`}
                    className="flex min-w-0 flex-1 items-center space-x-3 text-left"
                    onClick={() => openMaterial(String(resource.id))}
                  >
                    <div className="p-2 bg-blue-100/50 dark:bg-blue-900/20 rounded-md text-blue-600 dark:text-blue-400 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                      {resource.type.toLowerCase().includes('video') ? <PlayCircle className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground dark:text-muted-foreground group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{resource.title}</p>
                      {resource.size && <p className="text-xs text-muted-foreground dark:text-muted-foreground">{resource.size}</p>}
                    </div>
                    <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  </button>
                  <div className="flex items-center gap-1">
                    {(onDownloadMaterial || resource.url) && (
                      <button
                      type="button"
                      className="p-1.5 text-muted-foreground hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
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
              className="w-full flex items-center space-x-3 p-3 text-left bg-background dark:bg-card/30 hover:bg-muted dark:hover:bg-secondary/50 rounded-lg transition-colors border border-transparent dark:border-border/50"
              title="Open Notes Panel"
            >
              <Edit3 className="w-4 h-4 text-muted-foreground dark:text-muted-foreground" />
              <span className="text-sm font-medium text-foreground dark:text-muted-foreground">Notes</span>
            </button>
            <button
              onClick={() => toggleCoursePanel('discussion')}
              className="w-full flex items-center space-x-3 p-3 text-left bg-background dark:bg-card/30 hover:bg-muted dark:hover:bg-secondary/50 rounded-lg transition-colors border border-transparent dark:border-border/50"
              title="Open Discussion Panel"
            >
              <MessageSquare className="w-4 h-4 text-muted-foreground dark:text-muted-foreground" />
              <span className="text-sm font-medium text-foreground dark:text-muted-foreground">Discussion</span>
            </button>
            <button
              onClick={() => toggleCoursePanel('quiz')}
              className="w-full flex items-center space-x-3 p-3 text-left bg-background dark:bg-card/30 hover:bg-muted dark:hover:bg-secondary/50 rounded-lg transition-colors border border-transparent dark:border-border/50"
              title="Open Quiz Panel"
            >
              <FileText className="w-4 h-4 text-muted-foreground dark:text-muted-foreground" />
              <span className="text-sm font-medium text-foreground dark:text-muted-foreground">Quiz</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
