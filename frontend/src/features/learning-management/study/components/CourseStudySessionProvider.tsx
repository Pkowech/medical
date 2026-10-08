'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, Pause, Play, Square } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/shared/components/ui/button';
import { Textarea } from '@/shared/components/ui/textarea';
import { useStudy } from '../hooks/useStudy';
import { useAuthStore } from '@/features/auth/store/useAuthStore';
import { offlineService } from '@/lib/core/offline/offlineService';
import { syncService } from '@/lib/core/offline/syncService';
import type { OfflineStudySession } from '@/lib/core/offline/db';
import type {
  StudySession,
  StudySessionActivity,
} from '@/shared/types/studyInterface';

interface ActiveCourseSession {
  id: string;
  courseId: string;
  topicId: string;
  topicTitle: string;
  elapsedSeconds: number;
  lastActivitySeconds: number;
  isActive: boolean;
  activities: StudySessionActivity[];
  notes: string;
}

interface ActiveCourseSessionSummary {
  id: string;
  courseId: string;
  topicId: string;
  topicTitle: string;
  isActive: boolean;
  notes: string;
}

interface CourseStudySessionContextValue {
  activeSession: ActiveCourseSessionSummary | null;
  startCourseSession: (courseId: string, topicId: string, topicTitle: string) => Promise<void>;
  recordCourseActivity: (
    type: StudySessionActivity['type'],
    courseId: string | undefined,
    topicId: string,
    score?: number,
  ) => void;
  switchCourseTopic: (courseId: string, topicId: string, topicTitle: string) => void;
  pauseCourseSession: () => void;
  resumeCourseSession: () => void;
  endCourseSession: () => Promise<StudySession | null>;
}

const CourseStudySessionContext = createContext<CourseStudySessionContextValue | null>(null);

function formatElapsedTime(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function isNetworkUnavailable(error: unknown): boolean {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true;
  if (typeof error !== 'object' || error === null || !('isAxiosError' in error)) {
    return false;
  }
  return error.isAxiosError === true &&
    (!('response' in error) || error.response === undefined);
}

export function CourseStudySessionProvider({ children }: { children: React.ReactNode }) {
  const { startSession, endSession } = useStudy();
  const userId = useAuthStore(state => state.user?.id);
  const [activeSession, setActiveSession] = useState<ActiveCourseSession | null>(null);
  const [isEnding, setIsEnding] = useState(false);
  const activeSessionRef = useRef(activeSession);
  const isStartingRef = useRef(false);
  const isEndingRef = useRef(false);
  const restoredUserIdRef = useRef<string | undefined>(undefined);
  activeSessionRef.current = activeSession;

  const persistOfflineSession = useCallback(async (session: ActiveCourseSession) => {
    if (!userId) return;
    const saved: OfflineStudySession = {
      id: session.id,
      userId,
      courseId: session.courseId,
      topicId: session.topicId,
      topicTitle: session.topicTitle,
      elapsedSeconds: session.elapsedSeconds,
      lastActivitySeconds: session.lastActivitySeconds,
      isActive: session.isActive,
      activities: session.activities,
      notes: session.notes,
      updatedAt: Date.now(),
    };
    await offlineService.saveOfflineStudySession(saved);
  }, [userId]);

  useEffect(() => {
    if (!userId || restoredUserIdRef.current === userId) return;
    restoredUserIdRef.current = userId;
    let cancelled = false;
    void offlineService.getOfflineStudySession(userId).then(saved => {
      if (cancelled || !saved || activeSessionRef.current) return;
      const restored: ActiveCourseSession = {
        ...saved,
        isActive: false,
        activities: saved.activities,
      };
      setActiveSession(restored);
      toast.info('Your saved course session and notes were restored. Resume when ready.');
    }).catch(error => {
      console.error('Could not restore the offline study session:', error);
      toast.error('Could not restore your saved study session.');
    });
    return () => { cancelled = true; };
  }, [userId]);

  useEffect(() => {
    if (!activeSession?.isActive) return;
    const timer = window.setInterval(() => {
      setActiveSession(current =>
        current?.isActive
          ? { ...current, elapsedSeconds: current.elapsedSeconds + 1 }
          : current,
      );
    }, 1000);
    return () => window.clearInterval(timer);
  }, [activeSession?.isActive]);

  useEffect(() => {
    if (!activeSession || !userId) return;
    const timer = window.setInterval(() => {
      const current = activeSessionRef.current;
      if (current) {
        void persistOfflineSession(current).catch(error => {
          console.error('Could not persist the offline study session:', error);
        });
      }
    }, 5000);
    return () => window.clearInterval(timer);
  }, [activeSession?.id, persistOfflineSession, userId]);

  useEffect(() => {
    if (!activeSession || !userId) return;
    const timeout = window.setTimeout(() => {
      void persistOfflineSession(activeSession).catch(error => {
        console.error('Could not save offline study notes:', error);
        toast.error('Notes could not be saved on this device.');
      });
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [
    activeSession?.id,
    activeSession?.notes,
    activeSession?.topicId,
    activeSession?.topicTitle,
    activeSession?.isActive,
    activeSession?.activities,
    persistOfflineSession,
    userId,
  ]);

  const startCourseSession = useCallback(async (
    courseId: string,
    topicId: string,
    topicTitle: string,
  ) => {
    const currentSession = activeSessionRef.current;
    if (currentSession) {
      if (currentSession.courseId !== courseId || currentSession.topicId !== topicId) {
        toast.info('Finish your current course study session before starting another.');
      }
      return;
    }
    if (isStartingRef.current) return;

    isStartingRef.current = true;
    try {
      const session = await startSession({ type: 'topic', id: topicId });
      if (!session) {
        toast.error('Could not start a study session for this topic.');
        return;
      }

      const newSession: ActiveCourseSession = {
        id: session.id,
        courseId,
        topicId,
        topicTitle,
        elapsedSeconds: 0,
        lastActivitySeconds: 0,
        isActive: true,
        activities: [{
          type: 'reading',
          duration: 0,
          timestamp: new Date().toISOString(),
          metadata: { topicId, durationSeconds: 0 },
        }],
        notes: '',
      };
      activeSessionRef.current = newSession;
      setActiveSession(newSession);
      try {
        await persistOfflineSession(newSession);
      } catch (error) {
        console.error('Could not save the started session on this device:', error);
        toast.error('Session started, but offline recovery could not be enabled.');
      }
      toast.success(`Study session started for ${topicTitle}.`);
    } finally {
      isStartingRef.current = false;
    }
  }, [persistOfflineSession, startSession]);

  const updateSessionNotes = useCallback((notes: string) => {
    const current = activeSessionRef.current;
    if (!current) return;
    const updated = { ...current, notes };
    activeSessionRef.current = updated;
    setActiveSession(updated);
  }, []);

  const recordCourseActivity = useCallback((
    type: StudySessionActivity['type'],
    courseId: string | undefined,
    topicId: string,
    score?: number,
  ) => {
    setActiveSession(current => {
      if (!current || (courseId && current.courseId !== courseId)) return current;
      const segmentSeconds = Math.max(0, current.elapsedSeconds - current.lastActivitySeconds);
      return {
        ...current,
        topicId,
        lastActivitySeconds: current.elapsedSeconds,
        activities: [
          ...current.activities,
          {
            type,
            duration: segmentSeconds / 60,
            timestamp: new Date().toISOString(),
            ...(score === undefined ? {} : { score }),
            metadata: { topicId, durationSeconds: segmentSeconds },
          },
        ],
      };
    });
  }, []);

  const switchCourseTopic = useCallback((
    courseId: string,
    topicId: string,
    topicTitle: string,
  ) => {
    setActiveSession(current => {
      if (!current || current.courseId !== courseId || current.topicId === topicId) return current;
      const segmentSeconds = Math.max(0, current.elapsedSeconds - current.lastActivitySeconds);
      return {
        ...current,
        topicId,
        topicTitle,
        lastActivitySeconds: current.elapsedSeconds,
        activities: [
          ...current.activities,
          {
            type: 'reading',
            duration: segmentSeconds / 60,
            timestamp: new Date().toISOString(),
            metadata: {
              topicId: current.topicId,
              durationSeconds: segmentSeconds,
            },
          },
        ],
      };
    });
  }, []);

  const pauseCourseSession = useCallback(() => {
    setActiveSession(current => current ? { ...current, isActive: false } : current);
  }, []);

  const resumeCourseSession = useCallback(() => {
    setActiveSession(current => current ? { ...current, isActive: true } : current);
  }, []);

  const endCourseSession = useCallback(async () => {
    const currentSession = activeSessionRef.current;
    if (!currentSession || isEndingRef.current) return null;
    isEndingRef.current = true;
    setIsEnding(true);
    try {
      const finalSegmentSeconds = Math.max(
        0,
        currentSession.elapsedSeconds - currentSession.lastActivitySeconds,
      );
      const activities = [
        ...currentSession.activities,
        {
          type: 'reading' as const,
          duration: finalSegmentSeconds / 60,
          timestamp: new Date().toISOString(),
          metadata: {
            topicId: currentSession.topicId,
            durationSeconds: finalSegmentSeconds,
          },
        },
      ];
      const ended = await endSession(
        currentSession.id,
        currentSession.notes,
        activities,
        currentSession.elapsedSeconds,
      );
      if (ended.isValid) {
        toast.success(`Course study session saved (${ended.duration ?? 0} minutes).`);
      } else {
        toast.info(`Session saved but did not count toward progress. ${ended.invalidReason ?? ''}`);
      }
      await offlineService.removeOfflineStudySession(currentSession.id);
      setActiveSession(null);
      return ended;
    } catch (error) {
      if (isNetworkUnavailable(error) && userId) {
        try {
          const finalSegmentSeconds = Math.max(
            0,
            currentSession.elapsedSeconds - currentSession.lastActivitySeconds,
          );
          const activities = [
            ...currentSession.activities,
            {
              type: 'reading' as const,
              duration: finalSegmentSeconds / 60,
              timestamp: new Date().toISOString(),
              metadata: {
                topicId: currentSession.topicId,
                durationSeconds: finalSegmentSeconds,
              },
            },
          ];
          await syncService.addToOutbox(
            `/study/session/${currentSession.id}/end`,
            'PUT',
            {
              notes: currentSession.notes,
              activities,
              durationSeconds: currentSession.elapsedSeconds,
            },
            { 'Content-Type': 'application/json' },
            Date.now(),
            currentSession.id,
            userId,
            'study_session_end',
          );
          await offlineService.removeOfflineStudySession(currentSession.id);
          setActiveSession(null);
          toast.success('Session and notes saved on this device. They will sync when you are back online.');
          return null;
        } catch (queueError) {
          console.error('Could not queue the offline study session:', queueError);
          toast.error('Session is still saved locally, but could not be queued to sync.');
          return null;
        }
      }
      console.error('Failed to save course study session:', error);
      toast.error('Could not save the course study session. Please try again.');
      return null;
    } finally {
      isEndingRef.current = false;
      setIsEnding(false);
    }
  }, [endSession, userId]);

  const activeSessionSummary = useMemo<ActiveCourseSessionSummary | null>(() => activeSession
    ? {
        id: activeSession.id,
        courseId: activeSession.courseId,
        topicId: activeSession.topicId,
        topicTitle: activeSession.topicTitle,
        isActive: activeSession.isActive,
        notes: activeSession.notes,
      }
    : null, [
    activeSession?.id,
    activeSession?.courseId,
    activeSession?.topicId,
    activeSession?.topicTitle,
    activeSession?.isActive,
    activeSession?.notes,
  ]);

  const contextValue = useMemo(() => ({
    activeSession: activeSessionSummary,
    startCourseSession,
    recordCourseActivity,
    switchCourseTopic,
    pauseCourseSession,
    resumeCourseSession,
    endCourseSession,
  }), [
    activeSessionSummary,
    endCourseSession,
    pauseCourseSession,
    recordCourseActivity,
    resumeCourseSession,
    startCourseSession,
    switchCourseTopic,
  ]);

  return (
    <CourseStudySessionContext.Provider value={contextValue}>
      {children}
      {activeSession && (
        <aside
          aria-label="Active course study session"
          className="fixed bottom-4 right-4 z-[70] w-[min(24rem,calc(100vw-2rem))] rounded-2xl border border-indigo-200 bg-white p-4 shadow-2xl dark:border-indigo-900 dark:bg-slate-900"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">
            Course study session
          </p>
          <p className="mt-1 truncate font-semibold text-slate-900 dark:text-white">{activeSession.topicTitle}</p>
          <p className="mt-2 font-mono text-2xl tabular-nums text-slate-900 dark:text-white" aria-live="off">
            {formatElapsedTime(activeSession.elapsedSeconds)}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {activeSession.activities.length} learning activities tracked
          </p>
          <label htmlFor="course-session-notes" className="mt-3 block text-xs font-medium text-slate-600 dark:text-slate-300">
            Session notes · saved on this device
          </label>
          <Textarea
            id="course-session-notes"
            value={activeSession.notes}
            onChange={event => updateSessionNotes(event.target.value)}
            placeholder="Capture key ideas or questions—even offline."
            className="mt-1 min-h-20 resize-y text-sm"
          />
          <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            Notes are stored locally as you type and included when the session syncs.
          </p>
          <div className="mt-3 flex gap-2">
            {activeSession.isActive ? (
              <Button type="button" variant="outline" size="sm" onClick={pauseCourseSession}>
                <Pause className="mr-1.5 h-4 w-4" /> Pause
              </Button>
            ) : (
              <Button type="button" variant="outline" size="sm" onClick={resumeCourseSession}>
                <Play className="mr-1.5 h-4 w-4" /> Resume
              </Button>
            )}
            <Button type="button" variant="destructive" size="sm" onClick={() => void endCourseSession()} disabled={isEnding}>
              <Square className="mr-1.5 h-4 w-4" /> {isEnding ? 'Saving…' : 'End session'}
            </Button>
          </div>
        </aside>
      )}
    </CourseStudySessionContext.Provider>
  );
}

export function useCourseStudySession(): CourseStudySessionContextValue {
  const context = useContext(CourseStudySessionContext);
  if (!context) {
    throw new Error('useCourseStudySession must be used inside CourseStudySessionProvider.');
  }
  return context;
}

export function StartCourseStudySessionButton({
  courseId,
  topicId,
  topicTitle,
}: {
  courseId: string;
  topicId: string;
  topicTitle: string;
}) {
  const { activeSession, startCourseSession } = useCourseStudySession();
  const isCurrentTopic = activeSession?.courseId === courseId && activeSession.topicId === topicId;

  return (
    <Button
      type="button"
      variant={isCurrentTopic ? 'secondary' : 'outline'}
      disabled={Boolean(activeSession)}
      onClick={() => void startCourseSession(courseId, topicId, topicTitle)}
      aria-label={isCurrentTopic ? 'Study session already active for this topic' : 'Start a study session for this topic'}
    >
      <BookOpen className="mr-2 h-4 w-4" />
      {isCurrentTopic
        ? 'Session in progress'
        : activeSession
          ? 'Finish current session first'
          : 'Start study session'}
    </Button>
  );
}
