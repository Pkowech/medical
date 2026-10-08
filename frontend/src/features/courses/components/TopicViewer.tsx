'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import {
  FileText,
  Play,
  Download,
  ChevronLeft,
  Bookmark,
  CheckCircle,
  Clock,
  AlertCircle,
  Lightbulb,
  BookOpen,
  WifiOff,
  HardDriveDownload,
} from 'lucide-react';
import { useSession } from 'next-auth/react';
import { apiService } from '@/features/auth/services/apiClient';
import { topicService, Topic } from '@/features/courses/services/topicService';
import materialService from '@/features/courses/services/materialService';
import progressService from '@/features/learning-management/services/progressService';
import offlineProgressSync from '@/features/learning-management/services/offlineProgressSync';
import { Material, MaterialType } from '@/shared/types/materialInterface';
import { usePageHeader } from '@/core/providers/HeaderContext';
import { useCourseProgressStore } from '@/features/courses/hooks/useCourseProgressStore';
import { useAuthStore } from '@/features/auth/store/useAuthStore';
import { MaterialPreviewModal } from './MaterialPreviewModal';
import { TopicQuiz } from './TopicQuiz';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { toast } from 'sonner';
import { Brain } from 'lucide-react';
import { offlineService } from '@/lib/core/offline/offlineService';
import type { OfflineQuizQuestion, OfflineTopicBundle } from '@/lib/core/offline/db';
import {
  StartCourseStudySessionButton,
  useCourseStudySession,
} from '@/features/learning-management/study/components/CourseStudySessionProvider';

interface TopicViewerProps {
  courseId: string;
  unitId: string;
  topicId: string;
}

type TopicQuizResponseQuestion = {
  id: string;
  text: string;
  type?: string;
  difficulty?: string;
  options?: Array<{ id: string; text: string }>;
  explanation?: string | null;
  points?: number;
};

function isPdfMaterial(material: Material): boolean {
  const driveMimeType = material.metadata?.driveMimeType?.toLowerCase();
  const fileMimeType = material.file?.mimetype?.toLowerCase();
  const previewMimeType = material.previewFile?.mimetype?.toLowerCase();
  return (
    material.type?.toLowerCase() === 'pdf' ||
    material.contentType?.toLowerCase() === 'application/pdf' ||
    driveMimeType === 'application/pdf' ||
    fileMimeType === 'application/pdf' ||
    previewMimeType === 'application/pdf'
  );
}

async function prepareTopicOfflineContent(
  topic: Topic,
  materials: Material[],
  userId: string,
  courseId: string,
  unitId: string,
  materialsMetadataComplete: boolean,
  cacheMode: 'download' | 'session',
  sessionId?: string,
): Promise<{ bundle: OfflineTopicBundle; complete: boolean }> {
  const pdfMaterials = materials.filter(isPdfMaterial);
  const [quizResult, ...materialResults] = await Promise.allSettled([
    apiService.get<TopicQuizResponseQuestion[]>(`/quizzes/topic/${encodeURIComponent(topic.id)}`),
    ...pdfMaterials.map(async material => {
      const bytes = await materialService.getMaterialPreviewContent(material.id);
      const copy = new Uint8Array(bytes.byteLength);
      copy.set(bytes);
      return {
        materialId: material.id,
        title: material.title,
        description: material.description,
        content: new Blob([copy.buffer], { type: 'application/pdf' }),
      };
    }),
  ]);

  const downloadedMaterials = materialResults.flatMap(result =>
    result.status === 'fulfilled' ? [result.value] : [],
  );
  const questions: OfflineQuizQuestion[] =
    quizResult.status === 'fulfilled'
      ? quizResult.value.data.map(question => ({
          id: question.id,
          text: question.text,
          type:
            question.type === 'multiple_select' || question.type === 'true_false'
              ? question.type
              : 'multiple_choice',
          difficulty:
            question.difficulty === 'easy' || question.difficulty === 'hard'
              ? question.difficulty
              : 'medium',
          options: (question.options || []).map(option => ({ id: option.id, text: option.text })),
          explanation: question.explanation || undefined,
          points: question.points || 1,
        }))
      : [];
  const complete =
    materialsMetadataComplete &&
    quizResult.status === 'fulfilled' &&
    materialResults.every(result => result.status === 'fulfilled');

  if (downloadedMaterials.length === 0 && questions.length === 0) {
    throw new Error('No topic PDFs or practice questions could be cached.');
  }
  if (cacheMode === 'download' && !complete) {
    throw new Error('Some topic content could not be downloaded.');
  }

  const bundle = await offlineService.cacheTopicBundle({
    userId,
    courseId,
    unitId,
    topicId: topic.id,
    title: topic.title,
    description: topic.description,
    cacheMode,
    sessionId,
    isComplete: complete,
    preserveCachedQuiz: quizResult.status === 'rejected',
    materials: downloadedMaterials,
    questions,
  });
  return { bundle, complete };
}

const MATERIAL_ICONS: Record<string, React.ReactNode> = {
  VIDEO: <Play className="w-5 h-5" />,
  PDF: <FileText className="w-5 h-5" />,
  DOCUMENT: <FileText className="w-5 h-5" />,
  ARTICLE: <FileText className="w-5 h-5" />,
  INTERACTIVE: <Lightbulb className="w-5 h-5" />,
  QUIZ: <BookOpen className="w-5 h-5" />,
};

const getMaterialIcon = (type: string) => MATERIAL_ICONS[type?.toUpperCase()] || <Download className="w-5 h-5" />;
const getMaterialColor = (type: string): string => {
  const types: Record<string, string> = {
    VIDEO: 'from-blue-500 to-blue-600',
    PDF: 'from-red-500 to-red-600',
    DOCUMENT: 'from-orange-500 to-orange-600',
    ARTICLE: 'from-green-500 to-green-600',
    INTERACTIVE: 'from-purple-500 to-purple-600',
    QUIZ: 'from-pink-500 to-pink-600',
  };
  return types[type?.toUpperCase()] || 'from-gray-500 to-gray-600';
};

export const TopicViewer: React.FC<TopicViewerProps> = ({ courseId, unitId, topicId }) => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const userId = useAuthStore(state => state.user?.id);
  const { data: session } = useSession();
  const { setHeader } = usePageHeader();
  const { toggleBookmark, bookmarks, markLessonComplete, progress } = useCourseProgressStore();
  const { activeSession, recordCourseActivity, switchCourseTopic } = useCourseStudySession();

  useEffect(() => {
    if (topic && activeSession?.courseId === courseId && activeSession.topicId !== topicId) {
      switchCourseTopic(courseId, topicId, topic.title);
    }
  }, [activeSession?.courseId, activeSession?.topicId, courseId, switchCourseTopic, topic?.title, topicId]);

  const refreshLearningCaches = async () => {
    if (!userId) return;
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['userProgress', userId] }),
      queryClient.invalidateQueries({ queryKey: ['userLearningStreak', userId] }),
      queryClient.invalidateQueries({ queryKey: ['studyPlanner', userId] }),
      queryClient.invalidateQueries({ queryKey: ['course-progress-dashboard', userId] }),
      queryClient.invalidateQueries({ queryKey: ['courseStatistics', userId] }),
      queryClient.invalidateQueries({ queryKey: ['studyResume', userId] }),
      queryClient.invalidateQueries({ queryKey: ['courses'] }),
      queryClient.invalidateQueries({ queryKey: ['unit'] }),
    ]);
  };

  const [topic, setTopic] = useState<Topic | null>(null);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMaterialId, setSelectedMaterialId] = useState<string | null>(null);
  const [showMaterialModal, setShowMaterialModal] = useState(false);
  const [showQuiz, setShowQuiz] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [offlineUserId, setOfflineUserId] = useState<string>();
  const [offlineBundle, setOfflineBundle] = useState<OfflineTopicBundle>();
  const [isDownloading, setIsDownloading] = useState(false);
  const [isMarkingComplete, setIsMarkingComplete] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [materialsLoaded, setMaterialsLoaded] = useState(false);
  const [materialsMetadataComplete, setMaterialsMetadataComplete] = useState(true);
  const [offlineBundleLoaded, setOfflineBundleLoaded] = useState(false);
  const [sessionCacheStatus, setSessionCacheStatus] = useState<
    'idle' | 'preparing' | 'ready' | 'partial' | 'unavailable'
  >('idle');
  const sessionCacheRequestRef = useRef<string | undefined>(undefined);
  const sessionCachePromiseRef = useRef<Promise<unknown> | null>(null);
  const sessionCacheIdRef = useRef(
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );

  const isBookmarked = bookmarks.includes(topicId);
  const isCompleted = progress[topicId];

  // Fetch topic data
  useEffect(() => {
    const userId = session?.user?.id || offlineService.getActiveOfflineUserId();
    setOfflineUserId(userId);
    const updateOfflineStatus = () => setIsOffline(!navigator.onLine);
    updateOfflineStatus();
    window.addEventListener('online', updateOfflineStatus);
    window.addEventListener('offline', updateOfflineStatus);

    const fetchTopic = async () => {
      try {
        setIsLoading(true);
        setMaterialsLoaded(false);
        setMaterialsMetadataComplete(true);
        setOfflineBundleLoaded(false);
        sessionCacheRequestRef.current = undefined;
        setTopic(null);
        setMaterials([]);
        setOfflineBundle(undefined);
        setSessionCacheStatus('idle');
        setLoadError(null);
        const topicData = await topicService.getTopicById(courseId, unitId, topicId);
        setTopic(topicData);

        // Set page header
        setHeader({
          title: topicData.title || 'Topic',
          description: topicData.description || 'Learning material',
          icon: '📖',
        });

        // Fetch materials for this topic
        if (topicData.materials && Array.isArray(topicData.materials)) {
          setMaterials(topicData.materials);
        } else {
          // Try to fetch materials separately
          try {
            const mats = await materialService.getMaterialsByTopicId(topicId);
            setMaterials(mats || []);
          } catch (err) {
            setMaterialsMetadataComplete(false);
            console.warn('Could not fetch materials:', err);
          }
        }
        setMaterialsLoaded(true);

        if (userId) {
          const bundle = await offlineService.getOfflineTopicBundle(userId, topicId);
          setOfflineBundle(bundle);
        }
      } catch (error) {
        console.error('Error fetching topic:', error);
        const details = error as {
          status?: number;
          message?: string;
          rawResponse?: { statusCode?: number; message?: string };
        };
        const status = details?.status ?? details?.rawResponse?.statusCode;
        const message = details?.message ?? details?.rawResponse?.message;
        if (userId && status !== 401 && status !== 403 && status !== 404) {
          try {
            const [bundle, cachedMaterials, cachedQuiz] = await Promise.all([
              offlineService.getOfflineTopicBundle(userId, topicId),
              offlineService.getOfflineTopicMaterials(userId, topicId),
              offlineService.getOfflineTopicQuiz(userId, topicId),
            ]);
            if (bundle && cachedQuiz) {
              const cachedTopic: Topic = {
                id: bundle.topicId,
                unitId: bundle.unitId,
                courseId: bundle.courseId,
                title: bundle.title,
                description: bundle.description,
              };
              setTopic(cachedTopic);
              setMaterials(
                cachedMaterials.map(material => ({
                  id: material.materialId,
                  materialId: material.materialId,
                  title: material.title,
                  description: material.description || '',
                  contentType: MaterialType.DOCUMENT,
                  content: '',
                  type: 'pdf',
                  courseId: bundle.courseId,
                  unitId: bundle.unitId,
                  topicId: bundle.topicId,
                  createdAt: new Date(material.cachedAt).toISOString(),
                  updatedAt: new Date(material.cachedAt).toISOString(),
                })),
              );
              setMaterialsLoaded(true);
              setOfflineBundle(bundle);
              if (bundle.cacheMode === 'session' && bundle.sessionId) {
                sessionCacheIdRef.current = bundle.sessionId;
              }
              setHeader({
                title: bundle.title,
                description: bundle.description || 'Learning material',
                icon: '📖',
              });
              return;
            }
          } catch (cacheError) {
            console.error('[OfflineCache] Failed to open the cached topic:', cacheError);
          }
        } else if (userId && (status === 403 || status === 404)) {
          await offlineService.removeOfflineTopic(userId, topicId);
          setOfflineBundle(undefined);
        }
        setMaterialsLoaded(true);
        setLoadError(
          status === 403
            ? message || 'Pass the previous topic quiz to unlock this topic.'
            : status === 404
              ? 'This topic is no longer available.'
              : status === 401
                ? 'Sign in again while online to access this topic.'
                : 'Failed to load topic',
        );
      } finally {
        setOfflineBundleLoaded(true);
        setIsLoading(false);
      }
    };

    if (topicId) {
      void fetchTopic();
    }
    return () => {
      window.removeEventListener('online', updateOfflineStatus);
      window.removeEventListener('offline', updateOfflineStatus);
    };
  }, [courseId, unitId, topicId, setHeader, session?.user?.id]);

  const downloadTopicForOffline = async () => {
    if (!topic || !offlineUserId) {
      toast.error('Sign in online before downloading offline materials.');
      return;
    }

    setIsDownloading(true);
    try {
      await sessionCachePromiseRef.current?.catch(() => undefined);
      const { bundle } = await prepareTopicOfflineContent(
        topic,
        materials,
        offlineUserId,
        courseId,
        unitId,
        materialsMetadataComplete,
        'download',
      );
      setOfflineBundle(bundle);
      toast.success(`Available offline (${formatOfflineSize(bundle.totalBytes)})`);
    } catch (error) {
      console.error('[OfflineCache] Failed to download this topic:', error);
      toast.error('Could not download this topic. Check your connection and access, then try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  useEffect(() => {
    if (isOffline) {
      sessionCacheRequestRef.current = undefined;
      return;
    }
    if (!topic || !offlineUserId || !materialsLoaded || !offlineBundleLoaded) return;
    if (offlineBundle?.cacheMode !== 'session' && offlineBundle) {
      setSessionCacheStatus('ready');
      return;
    }
    if (
      offlineBundle?.cacheMode === 'session' &&
      offlineBundle.expiresAt > Date.now() &&
      offlineBundle.isComplete !== false &&
      offlineBundle.sessionId === sessionCacheIdRef.current
    ) {
      setSessionCacheStatus('ready');
      return;
    }

    const requestKey = `${offlineUserId}:${topicId}`;
    if (sessionCacheRequestRef.current === requestKey) return;
    sessionCacheRequestRef.current = requestKey;
    setSessionCacheStatus('preparing');
    const cachePromise = prepareTopicOfflineContent(
      topic,
      materials,
      offlineUserId,
      courseId,
      unitId,
      materialsMetadataComplete,
      'session',
      sessionCacheIdRef.current,
    );
    sessionCachePromiseRef.current = cachePromise;
    void cachePromise.then(({ bundle, complete }) => {
      if (sessionCacheRequestRef.current !== requestKey) return;
      setOfflineBundle(bundle);
      setSessionCacheStatus(complete ? 'ready' : 'partial');
    }).catch(error => {
      console.warn('[OfflineCache] Could not prepare this topic for interruptions:', error);
      if (sessionCacheRequestRef.current === requestKey) {
        setSessionCacheStatus('unavailable');
      }
    });
  }, [
    courseId,
    isOffline,
    materials,
    materialsLoaded,
    materialsMetadataComplete,
    offlineBundle,
    offlineBundleLoaded,
    offlineUserId,
    topic,
    topicId,
    unitId,
  ]);

  useEffect(() => {
    const sessionId = sessionCacheIdRef.current;
    return () => {
      if (offlineUserId) {
        const pendingCache = sessionCachePromiseRef.current;
        void (async () => {
          await pendingCache?.catch(() => undefined);
          await offlineService.removeSessionOfflineTopic(offlineUserId, topicId, sessionId);
        })().catch(error => {
            console.warn('[OfflineCache] Could not clear temporary topic content:', error);
          });
      }
    };
  }, [offlineUserId, topicId]);

  const removeTopicFromOffline = async () => {
    if (!offlineUserId) return;
    try {
      await offlineService.removeOfflineTopic(offlineUserId, topicId);
      setOfflineBundle(undefined);
      toast.success('Topic removed from offline downloads.');
    } catch (error) {
      console.error('[OfflineCache] Failed to remove this topic:', error);
      toast.error('Could not remove this topic from offline downloads.');
    }
  };

  const offlinePdfCount = materials.filter(isPdfMaterial).length;

  const handleOpenMaterial = (materialId: string) => {
    recordCourseActivity('reading', courseId, topicId);
    setSelectedMaterialId(materialId);
    setShowMaterialModal(true);
  };

  const handleCloseMaterial = async () => {
    setShowMaterialModal(false);
    if (offlineUserId) {
      try {
        setOfflineBundle(await offlineService.getOfflineTopicBundle(offlineUserId, topicId));
      } catch (error) {
        console.error('[OfflineCache] Could not refresh the saved-topic status:', error);
      }
    }
    
    // Track material as viewed
    if (selectedMaterialId) {
      try {
        await progressService.updateContentProgress({
          courseId,
          unitId,
          topicId,
          materialId: selectedMaterialId,
          status: 'completed',
          progressPercentage: 100,
        });
        await refreshLearningCaches();
      } catch (error) {
        console.error('Error tracking material progress:', error);
        try {
          await offlineProgressSync.addToQueue({
            courseId,
            unitId,
            topicId,
            materialId: selectedMaterialId,
            percent: 100,
            status: 'completed',
          });
          toast.info('Material progress saved offline and will sync when connected.');
        } catch (queueError) {
          console.error('Failed to queue material progress for sync:', queueError);
          toast.error('Material progress could not be saved.');
        }
      }
    }
    
    setSelectedMaterialId(null);
  };

  const handleToggleBookmark = () => {
    toggleBookmark(topicId);
    toast.success(isBookmarked ? 'Removed from bookmarks' : 'Added to bookmarks');
  };

  const handleMarkComplete = async () => {
    setIsMarkingComplete(true);
    try {
      await progressService.updateContentProgress({
        courseId,
        unitId,
        topicId,
        status: 'completed',
        progressPercentage: 100,
      });
      await refreshLearningCaches();
      markLessonComplete(topicId);
      toast.success('Topic marked as complete!');
    } catch (error) {
      console.error('Error saving topic completion:', error);
      try {
        await offlineProgressSync.addToQueue({
          courseId,
          unitId,
          topicId,
          percent: 100,
          status: 'completed',
        });
        markLessonComplete(topicId);
        toast.info('Topic completion saved offline and will sync when connected.');
      } catch (queueError) {
        console.error('Failed to queue topic completion for sync:', queueError);
        toast.error('Topic completion could not be saved.');
      }
    } finally {
      setIsMarkingComplete(false);
    }
  };

  const handleTopicQuizComplete = async (result: {
    masteryUnlocked: boolean;
    score: number;
  }) => {
    if (!result.masteryUnlocked) {
      toast.error(`You scored ${result.score}%. At least 70% is required to pass.`);
      return;
    }
    await progressService.updateContentProgress({
      courseId,
      unitId,
      topicId,
      status: 'completed',
      progressPercentage: 100,
    });
    await refreshLearningCaches();
    markLessonComplete(topicId);
    toast.success(`Topic mastered with ${result.score}%`);
  };

  const handleGoBack = () => {
    router.back();
  };

  const handleNavigateToUnit = () => {
    router.push(`/courses/${courseId}/units/${unitId}`);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-4 md:p-8">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-center min-h-screen">
            <div className="text-center space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mx-auto" />
              <p className="text-slate-600 dark:text-slate-400 font-medium">Loading topic...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!topic) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-4 md:p-8">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col items-center justify-center min-h-screen space-y-4">
            <AlertCircle className="w-12 h-12 text-red-500" />
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
              {loadError || 'Topic not found'}
            </h2>
            <p className="text-slate-600 dark:text-slate-400">
              {loadError ? 'Complete the preceding topic quiz before opening this topic.' : "The topic you're looking for doesn't exist."}
            </p>
            <Button onClick={handleGoBack} variant="outline">
              Go Back
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      {/* Header with Navigation */}
      <div className="sticky top-0 z-40 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 md:px-8 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleGoBack}
                className="flex-shrink-0"
              >
                <ChevronLeft className="w-5 h-5" />
              </Button>
              <div className="min-w-0">
                <h1 className="text-xl font-bold text-slate-900 dark:text-white truncate">
                  {topic.title}
                </h1>
                {topic.isMandatory && (
                  <Badge variant="secondary" className="mt-1">
                    Mandatory
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {isCompleted && (
                <div className="flex items-center gap-1 text-green-600 dark:text-green-400 px-3 py-1.5 bg-green-50 dark:bg-green-950 rounded-lg">
                  <CheckCircle className="w-4 h-4" />
                  <span className="text-sm font-medium">Done</span>
                </div>
              )}
              <Button
                variant={isBookmarked ? 'default' : 'outline'}
                size="icon"
                onClick={handleToggleBookmark}
                className="flex-shrink-0"
              >
                <Bookmark className={`w-5 h-5 ${isBookmarked ? 'fill-current' : ''}`} />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-5xl mx-auto px-4 md:px-8 py-8 space-y-8">
        {isOffline && (
          <div
            role="status"
            className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
          >
            <WifiOff className="h-4 w-4 shrink-0" />
            Offline mode: showing this device&apos;s saved topic content. Quiz attempts remain
            provisional until they sync.
          </div>
        )}
        {!isOffline &&
          (sessionCacheStatus === 'preparing' ||
            sessionCacheStatus === 'partial' ||
            sessionCacheStatus === 'unavailable' ||
            offlineBundle?.cacheMode === 'session') && (
            <div
              role="status"
              className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900"
            >
              {sessionCacheStatus === 'preparing'
                ? 'Preparing this topic for connection interruptions. Keep this page open until preparation finishes.'
                : sessionCacheStatus === 'partial'
                  ? 'Some content is ready for interruptions, but not all PDFs or quiz content could be cached. Check your connection.'
                  : sessionCacheStatus === 'unavailable'
                    ? 'Automatic interruption protection is unavailable. Use “Download for offline” to save this topic and check for any errors.'
                    : 'This topic is ready for brief interruptions. Its temporary cache is cleared when you leave; use “Download for offline” to keep it.'}
            </div>
          )}

        {/* Topic Description */}
        {topic.description && (
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-3">
              Overview
            </h2>
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
              {topic.description}
            </p>
          </div>
        )}

        {/* Materials Section */}
        {materials.length > 0 ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                Study Materials
              </h2>
              <Badge variant="outline">{materials.length}</Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {materials.map((material) => (
                <div
                  key={material.id}
                  className="bg-white dark:bg-slate-800 rounded-xl p-5 shadow-sm border border-slate-200 dark:border-slate-700 hover:shadow-md transition-shadow group cursor-pointer"
                  onClick={() => handleOpenMaterial(material.id)}
                >
                  {/* Material Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${getMaterialColor(material.type || 'DOCUMENT')} flex items-center justify-center text-white`}>
                      {getMaterialIcon(material.type || 'DOCUMENT')}
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {material.type || 'DOCUMENT'}
                    </Badge>
                  </div>

                  {/* Material Info */}
                  <h3 className="font-semibold text-slate-900 dark:text-white mb-2 line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {material.title}
                  </h3>

                  {material.description && (
                    <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2 mb-3">
                      {material.description}
                    </p>
                  )}

                  {/* Material Footer */}
                  <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-700">
                    <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                      {material.duration && (
                        <>
                          <Clock className="w-3.5 h-3.5" />
                          <span>{material.duration} min</span>
                        </>
                      )}
                    </div>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenMaterial(material.id);
                      }}
                      className="group-hover:shadow-lg transition-shadow"
                    >
                      Study Now →
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-800 rounded-xl p-8 shadow-sm border border-slate-200 dark:border-slate-700 text-center">
            <BookOpen className="w-12 h-12 text-slate-400 mx-auto mb-3" />
            <p className="text-slate-600 dark:text-slate-400 font-medium">
              No materials available for this topic yet
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-between pt-4">
          <StartCourseStudySessionButton
            courseId={courseId}
            topicId={topicId}
            topicTitle={topic.title}
          />
          <Button
            variant="outline"
            onClick={handleNavigateToUnit}
            className="flex items-center gap-2"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to Unit
          </Button>
          <div className="flex flex-col gap-2 sm:flex-row">
            {!isCompleted && (
              <Button
                variant="outline"
                onClick={() => void handleMarkComplete()}
                disabled={isMarkingComplete}
                className="flex items-center gap-2"
              >
                <CheckCircle className="w-4 h-4" />
                {isMarkingComplete ? 'Saving…' : 'Mark topic complete'}
              </Button>
            )}
            {offlineBundle && offlineBundle.cacheMode !== 'session' ? (
              <Button
                variant="outline"
                onClick={() => void removeTopicFromOffline()}
                className="flex items-center gap-2"
              >
                <HardDriveDownload className="h-4 w-4" />
                Available offline · {formatOfflineSize(offlineBundle.totalBytes)} · Remove
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={() => void downloadTopicForOffline()}
                disabled={isDownloading || isOffline || (!offlinePdfCount && !topic)}
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                {isDownloading
                  ? 'Downloading…'
                  : `Download for offline${offlinePdfCount ? ` · ${offlinePdfCount} PDF${offlinePdfCount === 1 ? '' : 's'}${getEstimatedPdfSize(materials)}` : ' · practice quiz'}`}
              </Button>
            )}
            <Button
              onClick={() => {
                recordCourseActivity('reading', courseId, topicId);
                setShowQuiz(true);
              }}
              className="flex items-center gap-2"
            >
              <Brain className="w-4 h-4" />
              {isCompleted ? 'Retake Topic Quiz' : 'Take Topic Quiz'}
            </Button>
          </div>
        </div>
      </div>

      {/* Topic Quiz Modal */}
      <TopicQuiz
        topicId={topicId}
        unitId={unitId}
        courseId={courseId}
        userId={offlineUserId || ''}
        isOpen={showQuiz}
        onClose={() => setShowQuiz(false)}
        onNextTopic={(nextTopicId) => {
          setShowQuiz(false);
          router.push(`/courses/${courseId}/units/${unitId}/topics/${nextTopicId}`);
        }}
        onComplete={handleTopicQuizComplete}
      />

      {/* Material Preview Modal */}
      <MaterialPreviewModal
        materialId={selectedMaterialId}
        topicId={topicId}
        userId={offlineUserId}
        fallbackMaterial={materials.find(material => material.id === selectedMaterialId)}
        isOpen={showMaterialModal}
        onClose={handleCloseMaterial}
        materials={materials}
        onNavigate={setSelectedMaterialId}
      />
    </div>
  );
};

function formatOfflineSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let size = bytes / 1024;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}

function getEstimatedPdfSize(materials: Material[]): string {
  const pdfs = materials.filter(material =>
    material.type?.toLowerCase() === 'pdf' ||
    material.contentType?.toLowerCase() === 'application/pdf' ||
    material.metadata?.driveMimeType?.toLowerCase() === 'application/pdf' ||
    material.file?.mimetype?.toLowerCase() === 'application/pdf' ||
    material.previewFile?.mimetype?.toLowerCase() === 'application/pdf',
  );
  const sizes = pdfs.map(material => {
    const match = material.size?.trim().match(/^([\d,.]+)\s*(B|KB|KIB|MB|MIB|GB|GIB)?$/i);
    if (!match) return undefined;
    const size = Number(match[1].replace(/,/g, ''));
    if (!Number.isFinite(size)) return undefined;
    const unit = (match[2] || 'B').toUpperCase();
    const multiplier =
      unit === 'KB' || unit === 'KIB' ? 1024 :
      unit === 'MB' || unit === 'MIB' ? 1024 ** 2 :
      unit === 'GB' || unit === 'GIB' ? 1024 ** 3 : 1;
    return size * multiplier;
  });
  return sizes.some(size => size === undefined)
    ? ' · size calculated as files download'
    : ` · ~${formatOfflineSize(sizes.reduce<number>((sum, size) => sum + (size ?? 0), 0))}`;
}
