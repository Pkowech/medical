'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Clock, Pause, Play, Square } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/shared/components/ui/button';
import { Textarea } from '@/shared/components/ui/textarea';
import { useStudy } from '../hooks/useStudy';
import { useAuthStore } from '@/features/auth/store/useAuthStore';
import { offlineService } from '@/lib/core/offline/offlineService';
import { isOfflineQueuedError } from '@/lib/core/offline/offlineQueuedError';
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
  pausedDurationSeconds: number;
  pauseStartedAtMs: number | null;
  pauseReason: 'manual' | 'navigation' | 'visibility' | 'idle' | null;
  isActive: boolean;
  activities: StudySessionActivity[];
  notes: string;
}

interface ActiveCourseSessionSummary {
  id: string;
  courseId: string;
  topicId: string;
  topicTitle: string;
  elapsedSeconds: number;
  isActive: boolean;
  pauseReason: ActiveCourseSession['pauseReason'];
  notes: string;
}

interface CourseStudySessionContextValue {
  activeSession: ActiveCourseSessionSummary | null;
  isEnding: boolean;
  ensureCourseSession: (courseId: string, topicId: string, topicTitle: string) => Promise<void>;
  updateSessionNotes: (notes: string) => void;
  recordCourseActivity: (
    type: StudySessionActivity['type'],
    courseId: string | undefined,
    topicId: string,
    score?: number,
    materialId?: string,
  ) => void;
  switchCourseTopic: (courseId: string, topicId: string, topicTitle: string) => void;
  pauseCourseSession: (reason?: NonNullable<ActiveCourseSession['pauseReason']>) => void;
  resumeCourseSession: () => void;
  endCourseSession: () => Promise<StudySession | null>;
}

const CourseStudySessionContext = createContext<CourseStudySessionContextValue | null>(null);
const STUDY_IDLE_TIMEOUT_MS = 5 * 60 * 1000;

interface PendingCourseSession {
  courseId: string;
  topicId: string;
  topicTitle: string;
}

function isMeaningfulStudyActivity(type: StudySessionActivity['type']): boolean {
  return type === 'reading' || type === 'material_opened' ||
    type === 'quiz' || type === 'notes';
}

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

function getHttpStatus(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  if ('status' in error && typeof error.status === 'number') {
    return error.status;
  }
  if (!('response' in error)) return undefined;
  const response = error.response;
  if (typeof response === 'object' && response !== null &&
      'status' in response && typeof response.status === 'number') {
    return response.status;
  }
  return undefined;
}

export function CourseStudySessionProvider({ children }: { children: React.ReactNode }) {
  const userId = useAuthStore(state => state.user?.id);

  return (
    <CourseStudySessionStateProvider key={userId} userId={userId}>
      {children}
    </CourseStudySessionStateProvider>
  );
}

function CourseStudySessionStateProvider({
  children,
  userId,
}: {
  children: React.ReactNode;
  userId?: string;
}) {
  const { startSession, endSession } = useStudy();
  const [activeSession, setActiveSession] = useState<ActiveCourseSession | null>(null);
  const [isEnding, setIsEnding] = useState(false);
  const [sessionReadyUserId, setSessionReadyUserId] = useState<string>();
  const [sessionElapsedBase, setSessionElapsedBase] = useState(0);
  const activeSessionRef = useRef(activeSession);
  const isStartingRef = useRef(false);
  const isEndingRef = useRef(false);
  const isPausedByVisibilityRef = useRef(false);
  const pendingCourseSessionRef = useRef<PendingCourseSession | null>(null);
  const lastInteractionAtRef = useRef(Date.now());
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
      pausedDurationSeconds: session.pausedDurationSeconds,
      pauseStartedAtMs: session.pauseStartedAtMs,
      pauseReason: session.pauseReason,
      isActive: session.isActive,
      activities: session.activities,
      notes: session.notes,
      updatedAt: Date.now(),
    };
    await offlineService.saveOfflineStudySession(saved);
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setSessionReadyUserId(undefined);
      return;
    }

    setSessionReadyUserId(undefined);
    let cancelled = false;
    void offlineService.getOfflineStudySession(userId).then(saved => {
      if (cancelled || !saved || activeSessionRef.current) return;
      const restored: ActiveCourseSession = {
        ...saved,
        isActive: false,
        pausedDurationSeconds: saved.pausedDurationSeconds ?? 0,
        pauseStartedAtMs: saved.pauseStartedAtMs ?? saved.updatedAt,
        pauseReason: saved.pauseReason ?? 'navigation',
        activities: saved.activities,
      };
      activeSessionRef.current = restored;
      setActiveSession(restored);
      setSessionElapsedBase(restored.elapsedSeconds);
      toast.info('Your saved course session and notes were restored.');
    }).catch(error => {
      if (!cancelled) {
        console.error('Could not restore the offline study session:', error);
        toast.error('Could not restore your saved study session.');
      }
    }).finally(() => {
      if (!cancelled) setSessionReadyUserId(userId);
    });
    return () => { cancelled = true; };
  }, [userId]);

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

  const updateSessionNotes = useCallback((notes: string) => {
    const current = activeSessionRef.current;
    if (!current) return;
    const updated = { ...current, notes };
    activeSessionRef.current = updated;
    setActiveSession(updated);
  }, []);

  const startCourseSessionForActivity = useCallback(async (
    pending: PendingCourseSession,
    activity: StudySessionActivity,
  ) => {
    if (isStartingRef.current) return;
    isStartingRef.current = true;
    try {
      const session = await startSession({ type: 'topic', id: pending.topicId });
      if (!session) {
        toast.error('Could not start a study session for this topic.');
        return;
      }

      const newSession: ActiveCourseSession = {
        id: session.id,
        ...pending,
        elapsedSeconds: 0,
        lastActivitySeconds: 0,
        pausedDurationSeconds: 0,
        pauseStartedAtMs: null,
        pauseReason: null,
        isActive: true,
        activities: [activity],
        notes: '',
      };
      pendingCourseSessionRef.current = null;
      lastInteractionAtRef.current = Date.now();
      activeSessionRef.current = newSession;
      setActiveSession(newSession);
      setSessionElapsedBase(0);
      try {
        await persistOfflineSession(newSession);
      } catch (error) {
        console.error('Could not save the started session on this device:', error);
        toast.error('Session started, but offline recovery could not be enabled.');
      }
    } finally {
      isStartingRef.current = false;
    }
  }, [persistOfflineSession, startSession]);

  const recordCourseActivity = useCallback((
    type: StudySessionActivity['type'],
    courseId: string | undefined,
    topicId: string,
    score?: number,
    materialId?: string,
  ) => {
    const current = activeSessionRef.current;
    if (!current) {
      const pending = pendingCourseSessionRef.current;
      if (
        !pending ||
        !isMeaningfulStudyActivity(type) ||
        pending.topicId !== topicId ||
        (courseId && pending.courseId !== courseId)
      ) {
        return;
      }
      const activity: StudySessionActivity = {
        type,
        duration: 0,
        timestamp: new Date().toISOString(),
        ...(score === undefined ? {} : { score }),
        metadata: {
          topicId,
          durationSeconds: 0,
          ...(materialId ? { materialId } : {}),
        },
      };
      void startCourseSessionForActivity(pending, activity);
      return;
    }
    if (courseId && current.courseId !== courseId) return;
    lastInteractionAtRef.current = Date.now();
    const isMaterialOpen = type === 'material_opened';
    const segmentSeconds = isMaterialOpen
      ? 0
      : Math.max(0, current.elapsedSeconds - current.lastActivitySeconds);
    const updated = {
      ...current,
      topicId,
      lastActivitySeconds: isMaterialOpen
        ? current.lastActivitySeconds
        : current.elapsedSeconds,
      activities: [
        ...current.activities,
        {
          type,
          duration: segmentSeconds / 60,
          timestamp: new Date().toISOString(),
          ...(score === undefined ? {} : { score }),
          metadata: {
            topicId,
            durationSeconds: segmentSeconds,
            ...(materialId ? { materialId } : {}),
          },
        },
      ],
    };
    activeSessionRef.current = updated;
    setActiveSession(updated);
  }, [startCourseSessionForActivity]);

  const switchCourseTopic = useCallback((
    courseId: string,
    topicId: string,
    topicTitle: string,
  ) => {
    const current = activeSessionRef.current;
    if (!current || current.courseId !== courseId || current.topicId === topicId) return;
    const segmentSeconds = Math.max(0, current.elapsedSeconds - current.lastActivitySeconds);
    const updated = {
      ...current,
      topicId,
      topicTitle,
      lastActivitySeconds: current.elapsedSeconds,
      activities: [
        ...current.activities,
        {
          type: 'reading' as const,
          duration: segmentSeconds / 60,
          timestamp: new Date().toISOString(),
          metadata: {
            topicId: current.topicId,
            durationSeconds: segmentSeconds,
          },
        },
      ],
    };
    activeSessionRef.current = updated;
    setActiveSession(updated);
  }, []);

  const pauseCourseSession = useCallback((
    reason: NonNullable<ActiveCourseSession['pauseReason']> = 'manual',
  ) => {
    const current = activeSessionRef.current;
    if (!current) return;
    if (!current.isActive) {
      if (
        reason === 'navigation' &&
        (current.pauseReason === 'visibility' || current.pauseReason === 'idle')
      ) {
        const pausedForNavigation = { ...current, pauseReason: 'navigation' as const };
        isPausedByVisibilityRef.current = false;
        activeSessionRef.current = pausedForNavigation;
        setActiveSession(pausedForNavigation);
      }
      return;
    }
    isPausedByVisibilityRef.current = reason === 'visibility';
    const paused = {
      ...current,
      isActive: false,
      pauseReason: reason,
      pauseStartedAtMs: current.pauseStartedAtMs ?? Date.now(),
    };
    activeSessionRef.current = paused;
    setActiveSession(paused);
    setSessionElapsedBase(paused.elapsedSeconds);
  }, []);

  const resumeCourseSession = useCallback(() => {
    const current = activeSessionRef.current;
    if (!current || current.isActive) return;
    const pausedSeconds = current.pauseStartedAtMs === null
      ? 0
      : Math.max(0, Math.floor((Date.now() - current.pauseStartedAtMs) / 1000));
    const resumed = {
      ...current,
      isActive: true,
      pausedDurationSeconds: current.pausedDurationSeconds + pausedSeconds,
      pauseStartedAtMs: null,
      pauseReason: null,
    };
    lastInteractionAtRef.current = Date.now();
    activeSessionRef.current = resumed;
    setActiveSession(resumed);
  }, []);

  useEffect(() => {
    if (!activeSession?.isActive) return;
    const timer = window.setInterval(() => {
      const current = activeSessionRef.current;
      if (!current?.isActive) return;
      if (Date.now() - lastInteractionAtRef.current >= STUDY_IDLE_TIMEOUT_MS) {
        pauseCourseSession('idle');
        return;
      }
      const updated = { ...current, elapsedSeconds: current.elapsedSeconds + 1 };
      activeSessionRef.current = updated;
      setActiveSession(updated);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [activeSession?.isActive, pauseCourseSession]);

  useEffect(() => {
    const handleInteraction = () => {
      lastInteractionAtRef.current = Date.now();
      if (activeSessionRef.current?.pauseReason === 'idle') {
        resumeCourseSession();
      }
    };
    const interactionEvents = ['pointerdown', 'keydown', 'scroll', 'touchstart'] as const;
    for (const eventName of interactionEvents) {
      window.addEventListener(eventName, handleInteraction, { passive: true });
    }
    return () => {
      for (const eventName of interactionEvents) {
        window.removeEventListener(eventName, handleInteraction);
      }
    };
  }, [resumeCourseSession]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        if (activeSessionRef.current?.isActive) {
          isPausedByVisibilityRef.current = true;
          pauseCourseSession('visibility');
        }
      } else if (
        isPausedByVisibilityRef.current &&
        activeSessionRef.current?.pauseReason === 'visibility'
      ) {
        isPausedByVisibilityRef.current = false;
        resumeCourseSession();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    handleVisibilityChange();
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [pauseCourseSession, resumeCourseSession]);

  const endCourseSession = useCallback(async () => {
    const currentSession = activeSessionRef.current;
    if (!currentSession || isEndingRef.current) return null;
    isEndingRef.current = true;
    setIsEnding(true);
    const clearLocalSession = async () => {
      activeSessionRef.current = null;
      setActiveSession(null);
      try {
        await offlineService.removeOfflineStudySession(currentSession.id);
      } catch (cleanupError) {
        console.error('Could not remove the ended offline study session:', cleanupError);
        toast.warning('Session ended, but its saved offline copy could not be removed.');
      }
    };
    const currentPauseSeconds = currentSession.pauseStartedAtMs === null
      ? 0
      : Math.max(
          0,
          Math.floor((Date.now() - currentSession.pauseStartedAtMs) / 1000),
        );
    const pausedDurationSeconds =
      currentSession.pausedDurationSeconds + currentPauseSeconds;
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
        pausedDurationSeconds,
      );
      if (ended.isValid) {
        toast.success(`Course study session saved (${ended.duration ?? 0} minutes).`);
      } else {
        toast.info(`Session saved but did not count toward progress. ${ended.invalidReason ?? ''}`);
      }
      await clearLocalSession();
      return ended;
    } catch (error) {
      // apiClient may have already queued the end mutation; do not enqueue again.
      if (isOfflineQueuedError(error)) {
        await clearLocalSession();
        toast.success('Session and notes saved on this device. They will sync when you are back online.');
        return null;
      }
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
              pausedDurationSeconds,
            },
            { 'Content-Type': 'application/json' },
            Date.now(),
            currentSession.id,
            userId,
            'study_session_end',
          );
          await clearLocalSession();
          toast.success('Session and notes saved on this device. They will sync when you are back online.');
          return null;
        } catch (queueError) {
          console.error('Could not queue the offline study session:', queueError);
          toast.error('Session is still saved locally, but could not be queued to sync.');
          return null;
        }
      }
      if (getHttpStatus(error) === 404) {
        console.warn('The active course study session no longer exists on the server:', currentSession.id);
        await clearLocalSession();
        toast.info('This study session was already removed. You can continue studying.');
        return null;
      }
      console.error('Failed to save course study session:', error);
      toast.error('Could not save the course study session. Please try again.');
      return null;
    } finally {
      isEndingRef.current = false;
      setIsEnding(false);
    }
  }, [endSession, userId]);

  const ensureCourseSession = useCallback(async (
    courseId: string,
    topicId: string,
    topicTitle: string,
  ) => {
    if (!userId || sessionReadyUserId !== userId) return;

    const currentSession = activeSessionRef.current;
    if (currentSession?.courseId === courseId) {
      if (currentSession.topicId !== topicId) {
        switchCourseTopic(courseId, topicId, topicTitle);
      }
      if (
        !currentSession.isActive &&
        (currentSession.pauseReason === 'navigation' ||
          currentSession.pauseReason === 'visibility') &&
        document.visibilityState === 'visible'
      ) {
        resumeCourseSession();
      }
      return;
    }
    const pending = { courseId, topicId, topicTitle };
    if (isStartingRef.current) {
      pendingCourseSessionRef.current = pending;
      return;
    }

    isStartingRef.current = true;
    try {
      if (currentSession) {
        await endCourseSession();
        if (activeSessionRef.current) return;
      }
      pendingCourseSessionRef.current = pending;
    } finally {
      isStartingRef.current = false;
    }
  }, [
    endCourseSession,
    resumeCourseSession,
    sessionReadyUserId,
    switchCourseTopic,
    userId,
  ]);

  const activeSessionSummary = useMemo<ActiveCourseSessionSummary | null>(() => activeSession
    ? {
        id: activeSession.id,
        courseId: activeSession.courseId,
        topicId: activeSession.topicId,
        topicTitle: activeSession.topicTitle,
        elapsedSeconds: sessionElapsedBase,
        isActive: activeSession.isActive,
        pauseReason: activeSession.pauseReason,
        notes: activeSession.notes,
      }
    : null, [
    activeSession?.id,
    activeSession?.courseId,
    activeSession?.topicId,
    activeSession?.topicTitle,
    activeSession?.isActive,
    activeSession?.pauseReason,
    activeSession?.notes,
    sessionElapsedBase,
  ]);

  const contextValue = useMemo(() => ({
    activeSession: activeSessionSummary,
    isEnding,
    ensureCourseSession,
    recordCourseActivity,
    switchCourseTopic,
    pauseCourseSession,
    resumeCourseSession,
    endCourseSession,
    updateSessionNotes,
  }), [
    activeSessionSummary,
    endCourseSession,
    isEnding,
    pauseCourseSession,
    recordCourseActivity,
    resumeCourseSession,
    ensureCourseSession,
    switchCourseTopic,
    updateSessionNotes,
  ]);

  return (
    <CourseStudySessionContext.Provider value={contextValue}>
      {children}
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

export function CourseStudySessionIndicator({
  canResume = false,
}: {
  canResume?: boolean;
}) {
  const {
    activeSession,
    isEnding,
    pauseCourseSession,
    resumeCourseSession,
    endCourseSession,
    updateSessionNotes,
  } = useCourseStudySession();
  const [elapsedSeconds, setElapsedSeconds] = useState(
    activeSession?.elapsedSeconds ?? 0,
  );

  useEffect(() => {
    if (activeSession) setElapsedSeconds(activeSession.elapsedSeconds);
  }, [activeSession?.elapsedSeconds, activeSession?.id]);

  useEffect(() => {
    if (!activeSession?.isActive) return;
    const timer = window.setInterval(() => {
      setElapsedSeconds(current => current + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [activeSession?.id, activeSession?.isActive]);

  if (!activeSession) return null;

  return (
    <details className="relative">
      <summary
        className="flex min-h-11 list-none cursor-pointer items-center gap-1.5 rounded-md border border-border px-2 text-xs font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        aria-label="Study session controls"
        title={`Study time ${activeSession.isActive ? 'tracking' : 'paused'}: ${activeSession.topicTitle}`}
      >
        <span className={`h-2 w-2 rounded-full ${activeSession.isActive ? 'bg-emerald-500' : 'bg-muted-foreground'}`} />
        <Clock aria-hidden="true" className="h-4 w-4" />
        <span className="text-[11px] sm:hidden">Study</span>
        <span className="hidden sm:inline">Study time</span>
        <span className="font-mono tabular-nums" aria-live="off">
          {formatElapsedTime(elapsedSeconds)}
        </span>
      </summary>
      <div className="absolute right-0 top-full z-[70] mt-2 w-[min(20rem,calc(100vw-1.5rem))] rounded-xl border border-border bg-card p-3 shadow-xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {activeSession.isActive ? 'Study session' : 'Session paused'}
        </p>
        <p className="mt-1 truncate font-semibold text-foreground">{activeSession.topicTitle}</p>
        {!activeSession.isActive && !canResume && (
          <p className="mt-2 text-xs text-muted-foreground">
            Open a topic to resume tracking.
          </p>
        )}
        <label htmlFor="course-session-notes" className="mt-3 block text-xs font-medium text-muted-foreground">
          Session notes
        </label>
        <Textarea
          id="course-session-notes"
          value={activeSession.notes}
          onChange={event => updateSessionNotes(event.target.value)}
          placeholder="Capture key ideas or questions."
          className="mt-1 min-h-20 resize-y text-sm"
        />
        <p className="mt-1 text-[11px] text-muted-foreground">
          Notes save on this device and sync with your session.
        </p>
        <div className="mt-3 flex gap-2">
          {activeSession.isActive ? (
            <Button type="button" variant="outline" size="sm" onClick={() => pauseCourseSession()}>
              <Pause className="mr-1.5 h-4 w-4" /> Pause
            </Button>
          ) : canResume ? (
            <Button type="button" variant="outline" size="sm" onClick={resumeCourseSession}>
              <Play className="mr-1.5 h-4 w-4" /> Resume
            </Button>
          ) : null}
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={() => void endCourseSession()}
            disabled={isEnding}
          >
            <Square className="mr-1.5 h-4 w-4" />
            {isEnding ? 'Saving…' : 'End session'}
          </Button>
        </div>
      </div>
    </details>
  );
}
