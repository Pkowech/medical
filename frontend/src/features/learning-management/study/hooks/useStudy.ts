import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuthStore } from '@/features/auth/store/useAuthStore';
import progressService from '../../services/progressService';
import apiService from '@/features/auth/services/apiClient';
import type { StudyStats, CourseProgressData, UnitProgressData } from '@/shared/types/progressInterface';
import type { 
  StudySessionInternal, 
  StudySession, 
  CourseProgressResponse, 
  UnitProgressResponse,
} from '@/shared/types/studyInterface';

export const useStudy = () => {
  const { user } = useAuthStore();
  const [sessions, setSessions] = useState<StudySessionInternal[]>([]);
  const [stats, setStats] = useState<StudyStats>({
    totalSessions: 0,
    totalTime: 0,
    averageScore: 0,
    currentStreak: 0,
    topicsStudied: [],
    courseProgress: [],
    unitProgress: [],
  });
  const [isLoading, setIsLoading] = useState(false);
  
  const statsRef = useRef(stats);
  useEffect(() => {
    statsRef.current = stats;
  }, [stats]);

  const startSession = useCallback(async (
    contextId: string, 
    contextType: 'course' | 'unit' | 'topic' | 'material' = 'topic'
  ): Promise<StudySessionInternal | null> => {
    if (!user?.id) return null;
    
    try {
      // payload: { context: { type, id }, topicId? }
      // If type is topic, we can pass it as topicId for legacy, or context.
      // New backend supports body: { context: { type, id } }
      
      const payload = {
        context: { type: contextType, id: contextId }
      };

      const response = await apiService.post<StudySession>('/study/session/start', payload);
      const session = response.data;
      
      // Transform if necessary, backend returns proper StudySession shape
      // Frontend StudySessionInternal might need adaptation if types differ
      const sessionInternal: StudySessionInternal = {
          id: session.id,
          startTime: new Date(session.startTime),
          endTime: session.endTime ? new Date(session.endTime) : undefined,
          userId: session.userId,
          duration: session.duration ?? 0,
          topic: session.topicId || 'unknown'
      };

      setSessions(prev => [...prev, sessionInternal]);
      return sessionInternal;
    } catch (error) {
      console.error('Failed to start study session:', error);
      return null;
    }
  }, [user?.id]);

  const endSession = useCallback(async (sessionId: string, score?: number, notes?: string): Promise<void> => {
    try {
        await apiService.put(`/study/session/${sessionId}/end`, {
            activities: score ? [{ type: 'quiz', score, duration: 0 }] : [], // Simplification
            notes
        });

        // Update local state
        setSessions(prev =>
            prev.map(session =>
              session.id === sessionId
                ? {
                    ...session,
                    endTime: new Date(),
                    duration: session.startTime 
                        ? (Date.now() - new Date(session.startTime).getTime()) / 1000 / 60 
                        : 0,
                    score,
                    notes,
                  }
                : session
            )
          );
    } catch (error) {
        console.error('Failed to end study session:', error);
    }
  }, []);

  const getStudyStats = useCallback(async (): Promise<StudyStats> => {
    if (!user?.id) return statsRef.current;
    
    try {
      setIsLoading(true);
      const [progressData, streakData] = await Promise.all([
        progressService.getProgressStats(user.id).catch(() => null),
        progressService.getUserStreaks(user.id).catch(() => null),
      ]);

      const currentStats = statsRef.current;

      const updatedStats: StudyStats = {
        totalSessions: (progressData?.totalSessions as number) ?? currentStats.totalSessions,
        totalTime: (progressData?.totalTime as number) ?? currentStats.totalTime,
        averageScore: (progressData?.averageScore as number) ?? currentStats.averageScore,
        currentStreak: streakData?.currentStreak ?? progressData?.streak ?? currentStats.currentStreak,
        topicsStudied: currentStats.topicsStudied, // Need separate endpoint for detailed topics if not in overview
        courseProgress: currentStats.courseProgress, 
        unitProgress: currentStats.unitProgress,
      };

      setStats(updatedStats);
      return updatedStats;
    } catch (error) {
      console.error('Error fetching study stats:', error);
      return statsRef.current;
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);
  
  // Fetch real course progress
  const getCourseProgress = useCallback(async (): Promise<CourseProgressData[]> => {
    if (!user?.id) return [];
    try {
      const response = await progressService.getCourseProgress(user.id);
      // Map response to CourseProgressData
      const mapped = response.map((c: CourseProgressResponse) => ({
          id: c.courseId || c.id || '',
          name: c.course?.title || c.title || 'Untitled',
          progressPercentage: c.progressPercentage || 0
      }));
      setStats(prev => ({ ...prev, courseProgress: mapped }));
      return mapped;
    } catch (e) {
      console.error(e);
      return [];
    }
  }, [user?.id]);

  const getUnitProgress = useCallback(async (courseId?: string): Promise<UnitProgressData[]> => {
      if (!user?.id) return [];
      try {
          const response = await progressService.getUnitProgress(user.id, courseId);
          const mapped = response.map((u: UnitProgressResponse) => ({
              id: u.unitId || u.id || '',
              name: u.unit?.title || u.title || 'Untitled',
              courseId: u.unit?.courseId || courseId || '',
              progressPercentage: u.progressPercentage || 0
          }));
          setStats(prev => ({ ...prev, unitProgress: mapped }));
          return mapped;
      } catch (e) {
          console.error(e);
          return [];
      }
  }, [user?.id]);

  const getResumePoint = useCallback(async (courseId: string) => {
      try {
          const res = await apiService.get<{ type: string, id: string, title?: string, unitId?: string }>(`/study/resume/${courseId}`);
          return res.data;
      } catch (e) {
          console.error("Failed to get resume point", e);
          return null;
      }
  }, []);

  // Initial fetch
  useEffect(() => {
    if (user?.id) {
        getStudyStats();
        getCourseProgress();
        // getUnitProgress(); // Lazy load usually
    }
  }, [user?.id, getStudyStats, getCourseProgress]);

  return {
    sessions,
    stats,
    isLoading,
    startSession,
    endSession,
    getStudyStats,
    getCourseProgress,
    getUnitProgress,
    getResumePoint
  };
};
