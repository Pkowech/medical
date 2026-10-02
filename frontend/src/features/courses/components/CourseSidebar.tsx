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
    <div className="w-80 h-full min-h-0 transition-all duration-300 overflow-hidden bg-white dark:bg-slate-900 border-r border-gray-200 dark:border-slate-800 flex flex-col shadow-xl">
      <div className="lg:hidden flex justify-end p-4 border-b border-gray-100 dark:border-slate-800">
        <button
          onClick={() => setSidebarOpen(false)}
          className="p-2 text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200 bg-gray-100 dark:bg-slate-800 rounded-full"
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
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Course Content</h3>
              {allowCollapse && (
                <button
                  type="button"
                  onClick={() => setSidebarCollapsed(true)}
                  className="hidden rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white lg:inline-flex"
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
                  <div key={chapter.id} className="border border-gray-200 dark:border-slate-800 rounded-lg overflow-hidden">
                    <button
                      type="button"
                      disabled={chapterLocked}
                      aria-expanded={isExpanded}
                      className="w-full flex items-center justify-between p-3 text-left hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
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
                        <p className="font-semibold text-gray-900 dark:text-white">{chapter.title}</p>
                        <p className="text-xs text-gray-500 dark:text-slate-500">{chapter.duration}</p>
                      </div>
                      <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                    </button>
                    {isExpanded && (
                      <div className="border-t border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/50">
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
                                className={`w-full flex items-center justify-between p-3 text-left hover:bg-white dark:hover:bg-slate-800 transition-all ${
                                  isActive
                                    ? 'bg-blue-50 dark:bg-blue-500/10 border-l-2 border-blue-500'
                                    : ''
                                } ${isLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
                                title={isLocked ? `Lesson locked: Complete previous mastery quiz` : `Navigate to lesson ${lesson.title}`}
                              >
                                <div className="flex items-center space-x-3">
                                  {isLocked ? (
                                    <Lock className="w-4 h-4 text-gray-400" />
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={(e) => toggleMaterials(e, lesson.id)}
                                      aria-expanded={expandedLessonMaterials === lesson.id}
                                      aria-label={`View materials for ${lesson.title}`}
                                      className={`cursor-pointer hover:scale-125 transition-all p-0.5 rounded-full z-10 ${
                                        lessonResources.length > 0
                                          ? 'ring-2 ring-blue-400/30 bg-blue-50 dark:bg-blue-900/20 shadow-sm shadow-blue-500/20'
                                          : 'hover:bg-gray-100 dark:hover:bg-slate-800'
                                      }`}
                                      title="Click to view relevant materials (videos, links, etc.)"
                                    >
                                      {isCompleted ? (
                                        <CheckCircle className="w-4 h-4 text-green-500" />
                                      ) : (
                                        <Circle className={`w-4 h-4 transition-colors ${
                                          expandedLessonMaterials === lesson.id 
                                            ? 'text-blue-600 fill-blue-500/20' 
                                            : lessonResources.length > 0
                                              ? 'text-blue-500'
                                              : 'text-gray-400'
                                        }`} />
                                      )}
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    disabled={isLocked}
                                    onClick={() => !isLocked && navigateTo(chapterIndex, lessonIndex)}
                                    className="flex-1 min-w-0 text-left disabled:cursor-not-allowed"
                                    title={isLocked ? 'Lesson locked: complete the previous mastery quiz' : `Go to lesson ${lesson.title}`}
                                  >
                                  <div>
                                    <p className="text-sm font-medium text-gray-900 dark:text-slate-200">{lesson.title}</p>
                                    <div className="flex items-center space-x-2">
                                      <p className="text-xs text-gray-500 dark:text-slate-500">{lesson.duration}</p>
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
                                        className="w-full flex items-center space-x-3 px-3 py-1.5 rounded-md text-left hover:bg-white dark:hover:bg-slate-800 transition-colors group cursor-pointer"
                                        title={`Open ${material.title} (Activity Tracked)`}
                                      >
                                        <div className="p-1 bg-blue-100/50 dark:bg-blue-900/20 rounded text-blue-600 dark:text-blue-400">
                                          {material.type.toLowerCase().includes('video') ? (
                                            <PlayCircle className="w-3 h-3" />
                                          ) : (
                                            <FileText className="w-3 h-3" />
                                          )}
                                        </div>
                                        <span className="text-[11px] font-medium text-gray-600 dark:text-slate-300 group-hover:text-blue-600 dark:group-hover:text-blue-400 truncate flex-1">
                                          {material.title}
                                        </span>
                                        <ExternalLink className="w-2.5 h-2.5 text-gray-300 opacity-0 group-hover:opacity-100" />
                                      </button>
                                      ))
                                    }
                                    {lessonResources.length === 0 && (
                                      <p className="text-[10px] text-gray-400 italic px-3 py-1">No additional materials for this unit.</p>
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
                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-dashed border-slate-200 dark:border-slate-700 text-center">
                  <p className="text-xs text-slate-500">No units available for this course yet.</p>
                </div>
              )}
            </div>
          </div>

          {/* Resources */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Resources</h3>
            <div className="space-y-2">
              {resources.map(resource => (
                <div
                  key={resource.id}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-800/30 rounded-lg border border-transparent dark:border-slate-800/50 group hover:border-blue-200 dark:hover:border-blue-500/30 transition-all"
                >
                  <div 
                    className="flex items-center space-x-3 flex-1 cursor-pointer"
                    onClick={() => openMaterial(String(resource.id))}
                  >
                    <div className="p-2 bg-blue-100/50 dark:bg-blue-900/20 rounded-md text-blue-600 dark:text-blue-400 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                      {resource.type.toLowerCase().includes('video') ? <PlayCircle className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{resource.title}</p>
                      {resource.size && <p className="text-xs text-gray-500 dark:text-slate-500">{resource.size}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      className="p-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                      title={`Open ${resource.title}`}
                      onClick={() => openMaterial(String(resource.id))}
                    >
                      <ExternalLink className="w-4 h-4" />
                    </button>
                    {(onDownloadMaterial || resource.url) && (
                      <button
                      type="button"
                      className="p-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
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
              className="w-full flex items-center space-x-3 p-3 text-left bg-gray-50 dark:bg-slate-800/30 hover:bg-gray-100 dark:hover:bg-slate-700/50 rounded-lg transition-colors border border-transparent dark:border-slate-800/50"
              title="Open Notes Panel"
            >
              <Edit3 className="w-4 h-4 text-gray-600 dark:text-slate-400" />
              <span className="text-sm font-medium text-gray-900 dark:text-slate-200">Notes</span>
            </button>
            <button
              onClick={() => toggleCoursePanel('discussion')}
              className="w-full flex items-center space-x-3 p-3 text-left bg-gray-50 dark:bg-slate-800/30 hover:bg-gray-100 dark:hover:bg-slate-700/50 rounded-lg transition-colors border border-transparent dark:border-slate-800/50"
              title="Open Discussion Panel"
            >
              <MessageSquare className="w-4 h-4 text-gray-600 dark:text-slate-400" />
              <span className="text-sm font-medium text-gray-900 dark:text-slate-200">Discussion</span>
            </button>
            <button
              onClick={() => toggleCoursePanel('quiz')}
              className="w-full flex items-center space-x-3 p-3 text-left bg-gray-50 dark:bg-slate-800/30 hover:bg-gray-100 dark:hover:bg-slate-700/50 rounded-lg transition-colors border border-transparent dark:border-slate-800/50"
              title="Open Quiz Panel"
            >
              <FileText className="w-4 h-4 text-gray-600 dark:text-slate-400" />
              <span className="text-sm font-medium text-gray-900 dark:text-slate-200">Quiz</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
