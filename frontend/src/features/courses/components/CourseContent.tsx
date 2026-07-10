import Link from 'next/link';
import {
  Clock,
  CheckCircle,
  FileText,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  EyeOff,
  AlertCircle,
  PlayCircle,
  XCircle,
} from 'lucide-react';
import type { Material } from '@/shared/types/materialInterface';
import type { ReadinessSignal } from '@/shared/types/mastery.types';
import { useXapi } from '@/lib/xapi/useXapi';
import { useEffect, useRef } from 'react';
import { VideoPlayer } from './VideoPlayer';

type WindowWithTogglePanel = Window & { toggleCoursePanel?: (panel: 'notes' | 'discussion' | 'quiz') => void };

interface Lesson {
  id: number | string;
  title: string;
  type: 'video' | 'interactive' | 'text' | 'quiz' | 'assignment';
  duration: string;
  content: { video?: string; transcript?: string; interactive?: boolean; text?: string };
  isCompleted?: boolean;
  masteryUnlocked?: boolean;
  failedAttempts?: number;
  readinessSignal?: ReadinessSignal;
}

interface CourseContentProps {
  currentLesson: Lesson | undefined;
  lessonKey: string;
  offlineMode: boolean;
  bookmarks: Set<string>;
  progress: Record<string, boolean>;
  toggleBookmark: (lessonKey: string) => void;
  markLessonComplete: (lessonKey: string) => void;
  navigatePrev: () => void;
  navigateNext: () => void;
  isFirstLesson: boolean;
  isLastLesson: boolean;
  materials?: Material[];
  openMaterial: (id: string) => void;
}

export const CourseContent = ({
  currentLesson: lesson,
  lessonKey,
  offlineMode,
  bookmarks,
  progress,
  toggleBookmark,
  markLessonComplete,
  navigatePrev,
  navigateNext,
  isFirstLesson,
  isLastLesson,
  materials = [],
  openMaterial,
}: CourseContentProps) => {
  const { trackAction, XAPI_VERBS } = useXapi();
  const lastLessonId = useRef<string | number | null>(null);

  // Track Unit Initialization
  useEffect(() => {
    if (lesson?.id && lesson.id !== lastLessonId.current) {
      trackAction(XAPI_VERBS.INITIALIZED, {
        id: `https://medtrackhub.com/units/${lesson.id}`,
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
        id: `https://medtrackhub.com/units/${lesson.id}`,
        definition: {
          name: { 'en-US': lesson.title },
          type: 'http://adlnet.gov/expapi/activities/lesson',
        },
      });
    }
  }, [lesson?.id, !!progress[lessonKey], trackAction, XAPI_VERBS.COMPLETED]);

  if (!lesson) {
    return (
      <div className="bg-white/80 dark:bg-slate-800/50 backdrop-blur-sm rounded-lg p-12 shadow-sm border border-gray-200 dark:border-slate-700/50 flex flex-col items-center justify-center text-center animate-in fade-in zoom-in duration-500">
        <div className="w-20 h-20 bg-slate-100 dark:bg-slate-900 rounded-full flex items-center justify-center mb-6">
          <FileText className="w-10 h-10 text-slate-400" />
        </div>
        <h3 className="text-xl font-bold text-slate-900 dark:text-white">Start Your Learning Journey</h3>
        <p className="text-slate-500 max-w-sm mt-3 leading-relaxed">
          Select a topic from the course curriculum on the left to view lessons, videos, and study materials.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white/80 dark:bg-slate-800/50 backdrop-blur-sm rounded-lg p-6 shadow-sm border border-gray-200 dark:border-slate-700/50">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{lesson.title}</h2>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => toggleBookmark(lessonKey)}
            className={`p-2 rounded-lg transition-colors ${
              bookmarks.includes(lessonKey)
                ? 'bg-yellow-100 dark:bg-yellow-500/20 text-yellow-600 dark:text-yellow-400'
                : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-600'
            }`}
            title={bookmarks.includes(lessonKey) ? 'Remove bookmark' : 'Add bookmark'}
          >
            <Bookmark className="w-5 h-5" />
          </button>
          <button
            onClick={() => markLessonComplete(lessonKey)}
            className={`p-2 rounded-lg transition-colors ${
              progress[lessonKey]
                ? 'bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-400'
                : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-600'
            }`}
            title={progress[lessonKey] ? 'Mark as incomplete' : 'Mark as complete'}
          >
            <CheckCircle className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex items-center space-x-4 mb-6 text-sm text-gray-500 dark:text-slate-400">
        <span className="flex items-center space-x-1">
          <Clock className="w-4 h-4" />
          <span>{lesson.duration}</span>
        </span>
        <span className="flex items-center space-x-1">
          <FileText className="w-4 h-4" />
          <span>{lesson.type}</span>
        </span>
        {offlineMode && (
          <span className="flex items-center space-x-1 text-orange-600">
            <EyeOff className="w-4 h-4" />
            <span>Offline Mode</span>
          </span>
        )}
      </div>

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
          <p className="text-gray-700 dark:text-slate-300 leading-relaxed">{lesson.content?.text}</p>
        </div>
      )}

      {/* Materials for this lesson/unit - Moved above Mastery Gate for visibility */}
      {materials.length > 0 && (
        <div className="mt-8 pt-8 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Bookmark className="w-5 h-5 text-blue-500" />
              Relevant Study Materials
            </h3>
            <span className="text-xs text-gray-500 dark:text-slate-400 font-medium bg-gray-100 dark:bg-slate-800 px-2 py-1 rounded-full">
              {materials.length} {materials.length === 1 ? 'Resource' : 'Resources'}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {materials.map(m => {
              const isVideo = m.type?.toLowerCase().includes('video') || m.contentType?.toLowerCase().includes('video');
              return (
                <div 
                  key={m.id} 
                  onClick={() => openMaterial(String(m.id))}
                  className="relative p-4 border border-slate-200 dark:border-slate-700/50 rounded-xl bg-white dark:bg-slate-800/50 hover:shadow-md hover:border-blue-200 dark:hover:border-blue-500/30 transition-all group overflow-hidden cursor-pointer"
                >
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-lg shrink-0 ${
                      isVideo 
                        ? 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400' 
                        : 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400'
                    }`}>
                      {isVideo ? <PlayCircle className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-900 dark:text-white text-sm truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {m.title}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                           isVideo 
                            ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' 
                            : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                        }`}>
                          {isVideo ? 'Video' : 'Document'}
                        </span>
                        {m.size && <span className="text-[10px] text-gray-400 dark:text-slate-500">{m.size}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <div className="flex -space-x-1">
                       <div className="w-5 h-5 rounded-full border-2 border-white dark:border-slate-800 bg-slate-200 dark:bg-slate-700" />
                       <div className="w-5 h-5 rounded-full border-2 border-white dark:border-slate-800 bg-slate-300 dark:bg-slate-600" />
                    </div>
                    <button 
                      onClick={(e) => { e.stopPropagation(); openMaterial(String(m.id)); }}
                      className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors shadow-sm shadow-blue-500/20"
                    >
                      Study Now <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="absolute bottom-0 left-0 h-1 bg-blue-500/20 w-full" />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Mastery Gate Section - Now feels like a natural "Next Step" */}
      <div className="mt-12 p-8 bg-gradient-to-br from-slate-50 to-white dark:from-slate-900/80 dark:to-slate-900/40 rounded-2xl border border-blue-100 dark:border-blue-900/30 shadow-inner">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-blue-600 text-white rounded-lg shadow-lg shadow-blue-500/20">
                <CheckCircle className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                Mastery Gate: {lesson.title}
              </h3>
            </div>
            
            <p className="text-gray-600 dark:text-slate-400 leading-relaxed max-w-xl">
              {lesson.masteryUnlocked 
                ? "Excellent work! You have successfully mastered this topic. You can proceed or retake the assessment for a higher score." 
                : "Verify your understanding of this topic to unlock the next part of your learning path. 80% passing score required."}
            </p>
            
            {/* Read-Before-Quiz Warning */}
            {!lesson.masteryUnlocked && materials.length > 0 && (
              <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 text-sm rounded-xl border border-amber-100 dark:border-amber-800/30 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
                <span>
                  <strong>Wait!</strong> We recommend finishing all the study materials above before attempting the quiz. It significantly increases your chance of passing.
                </span>
              </div>
            )}
          </div>
          
          <div className="flex flex-col items-center gap-3 min-w-[240px]">
             <button
              onClick={() => (window as WindowWithTogglePanel).toggleCoursePanel?.('quiz')}
              className={`w-full py-4 rounded-xl font-bold transition-all shadow-xl text-center flex items-center justify-center gap-2 group ${
                lesson.masteryUnlocked
                  ? 'bg-green-600 text-white hover:bg-green-700'
                  : 'bg-blue-600 text-white hover:bg-blue-700 ring-4 ring-blue-500/10'
              }`}
            >
              {lesson.masteryUnlocked ? "Retake Mastery Quiz" : "Unlock Mastery Quiz"}
              <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
            {lesson.failedAttempts && lesson.failedAttempts > 0 && !lesson.masteryUnlocked && (
              <div className="flex items-center gap-2 px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full text-xs font-bold uppercase tracking-wider">
                <XCircle className="w-3 h-3" />
                {lesson.failedAttempts} Failed Attempts
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex justify-between items-center mt-8 pt-6 border-t border-gray-100 dark:border-slate-700/50">
        <button
          onClick={navigatePrev}
          disabled={isFirstLesson}
          className="flex items-center space-x-2 px-4 py-2 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Previous Lesson"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Previous</span>
        </button>
        <button
          onClick={navigateNext}
          disabled={isLastLesson}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/20"
          title="Next Lesson"
        >
          <span>Next</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
