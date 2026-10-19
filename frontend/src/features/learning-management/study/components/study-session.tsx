import React, { useCallback, useState, useEffect, useRef } from 'react';
import { useStudy } from '../hooks/useStudy';
import { Card, CardContent } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Label } from '@/shared/components/ui/label';
import { Textarea } from '@/shared/components/ui/textarea';
import { ScrollArea } from '@/shared/components/ui/scroll-area';
import { Play, Pause, Square, BookOpen } from 'lucide-react';
import materialService from '@/features/courses/services/materialService';
import { MaterialPreviewModal } from '@/features/courses/components/MaterialPreviewModal';
import { useAuthStore } from '@/features/auth/store/useAuthStore';
import type { Material } from '@/shared/types/materialInterface';
import type {
  StudySession as StudySessionResponse,
  StudySessionActivity,
  StudySessionContext,
} from '@/shared/types/studyInterface';
import { toast } from 'sonner';
import { useXapi } from '@/lib/xapi/useXapi';
import { URLS } from '@/lib/urls';
interface StudySessionProps {
  topicId?: string;
  context?: StudySessionContext;
  contextLabel?: string;
  onSessionEnd: (session: StudySessionResponse) => void;
  onSessionStarted?: () => void;
}

type Activity = {
  type: 'reading';
  durationSeconds: number;
  timestamp: Date;
  metadata?: Record<string, unknown>;
};

export const StudySession: React.FC<StudySessionProps> = ({
  topicId,
  context,
  contextLabel,
  onSessionEnd,
  onSessionStarted,
}) => {
  const { startSession, endSession } = useStudy();
  const { trackAction, XAPI_VERBS } = useXapi();
  const userId = useAuthStore(state => state.user?.id);
  const studyContext = context ?? (topicId ? { type: 'topic' as const, id: topicId } : undefined);
  const studyCourseId = studyContext?.type === 'course' ? studyContext.id : undefined;

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [courseMaterials, setCourseMaterials] = useState<Material[]>([]);
  const [isLoadingMaterials, setIsLoadingMaterials] = useState(false);
  const [materialsError, setMaterialsError] = useState<string | null>(null);
  const [materialsLoadAttempt, setMaterialsLoadAttempt] = useState(0);
  const [selectedMaterialId, setSelectedMaterialId] = useState<string | null>(null);
  const [showEndDialog, setShowEndDialog] = useState(false);
  const [notes, setNotes] = useState('');
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const elapsedMillisecondsRef = useRef(0);
  const activeSegmentStartedAtRef = useRef<number | null>(null);
  const activeReadingRef = useRef<{ materialId: string; startedAtSeconds: number } | null>(null);
  const pauseStartedAtRef = useRef<number | null>(null);
  const pausedDurationMsRef = useRef(0);
  const getElapsedSeconds = useCallback(
    () =>
      Math.floor(
        (elapsedMillisecondsRef.current +
          (activeSegmentStartedAtRef.current === null
            ? 0
            : performance.now() - activeSegmentStartedAtRef.current)) /
          1000,
      ),
    [],
  );

  const getSessionXapiContext = (activeSessionId: string, material?: Material) => {
    const courseId =
      material?.courseId ?? (studyContext?.type === 'course' ? studyContext.id : undefined);
    const unitId =
      material?.unitId ?? (studyContext?.type === 'unit' ? studyContext.id : undefined);
    const topicId =
      material?.topicId ?? (studyContext?.type === 'topic' ? studyContext.id : undefined);
    const extensions: Record<string, unknown> = {
      [URLS.XAPI_EXTENSIONS.STUDY_SESSION_ID]: activeSessionId,
      [URLS.XAPI_EXTENSIONS.COURSE_ID]: courseId,
      [URLS.XAPI_EXTENSIONS.UNIT_ID]: unitId,
      [URLS.XAPI_EXTENSIONS.TOPIC_ID]: topicId,
    };

    return {
      extensions,
      ...(courseId
        ? {
            contextActivities: {
              parent: [
                {
                  id: URLS.COURSE(courseId),
                  definition: {
                    name: { 'en-US': `Course ${courseId}` },
                    type: 'http://adlnet.gov/expapi/activities/course',
                  },
                },
              ],
            },
          }
        : {}),
    };
  };

  const studySessionXapiObject = (activeSessionId: string) => ({
    id: `${URLS.BASE}/study-sessions/${activeSessionId}`,
    definition: {
      name: { 'en-US': contextLabel || 'Study session' },
      type: 'http://adlnet.gov/expapi/activities/session',
    },
  });

  useEffect(() => {
    if (!isActive) return;
    const timer = window.setInterval(
      () => setElapsedTime(getElapsedSeconds()),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [getElapsedSeconds, isActive]);

  useEffect(() => {
    if (!sessionId || !studyCourseId) {
      setCourseMaterials([]);
      setMaterialsError(null);
      return;
    }

    let isCurrent = true;
    setIsLoadingMaterials(true);
    setMaterialsError(null);
    materialService
      .getMaterialsPaginated({
        page: 1,
        limit: 50,
        courseId: studyCourseId,
        scope: 'enrolled',
      })
      .then(result => {
        if (isCurrent) setCourseMaterials(result.items);
      })
      .catch(error => {
        console.error('Could not load course materials for the study session:', error);
        if (isCurrent) setMaterialsError('Course materials could not be loaded. Please try again.');
      })
      .finally(() => {
        if (isCurrent) setIsLoadingMaterials(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [materialsLoadAttempt, sessionId, studyCourseId]);

  const handleStart = async () => {
    if (sessionId) {
      setSessionError(null);
      const now = performance.now();
      if (pauseStartedAtRef.current !== null) {
        pausedDurationMsRef.current += now - pauseStartedAtRef.current;
        pauseStartedAtRef.current = null;
      }
      activeSegmentStartedAtRef.current = now;
      setIsActive(true);
      return;
    }

    if (isStarting) return;

    setIsStarting(true);
    try {
      setSessionError(null);
      const session = await startSession(studyContext);
      if (session) {
        setSessionId(session.id);
        activeSegmentStartedAtRef.current = performance.now();
        setIsActive(true);
        void trackAction(
          XAPI_VERBS.LAUNCHED,
          studySessionXapiObject(session.id),
          undefined,
          getSessionXapiContext(session.id)
        );
        onSessionStarted?.();
      } else {
        setSessionError('Could not start this session. Please try again.');
      }
    } catch (error) {
      console.error('Error starting session:', error);
      setSessionError('Could not start this session. Please try again.');
    } finally {
      setIsStarting(false);
    }
  };

  const handlePause = () => {
    if (isActive && activeSegmentStartedAtRef.current !== null) {
      const now = performance.now();
      elapsedMillisecondsRef.current += now - activeSegmentStartedAtRef.current;
      activeSegmentStartedAtRef.current = null;
      pauseStartedAtRef.current = now;
      setElapsedTime(Math.floor(elapsedMillisecondsRef.current / 1000));
    }
    setIsActive(false);
  };

  const handleStop = () => {
    handlePause();
    setShowEndDialog(true);
  };

  const getPausedDurationSeconds = () => {
    const currentPauseMs =
      pauseStartedAtRef.current === null
        ? 0
        : performance.now() - pauseStartedAtRef.current;
    return Math.floor((pausedDurationMsRef.current + currentPauseMs) / 1000);
  };

  const takeOpenMaterialActivity = (): Activity | null => {
    const activeReading = activeReadingRef.current;
    if (!activeReading) return null;

    const durationSeconds = Math.max(
      0,
      getElapsedSeconds() - activeReading.startedAtSeconds,
    );
    const material = courseMaterials.find(item => String(item.id) === activeReading.materialId);
    activeReadingRef.current = null;
    return {
      type: 'reading',
      durationSeconds,
      timestamp: new Date(),
      metadata: {
        courseId: studyCourseId,
        materialId: activeReading.materialId,
        materialTitle: material?.title,
        topicId: material?.topicId,
        durationSeconds,
      },
    };
  };

  const recordOpenMaterialTime = () => {
    const activity = takeOpenMaterialActivity();
    if (activity) setActivities(prev => [...prev, activity]);
    return activity;
  };

  const openMaterial = (materialId: string) => {
    if (!sessionId || !isActive) return;
    recordOpenMaterialTime();
    activeReadingRef.current = {
      materialId,
      startedAtSeconds: getElapsedSeconds(),
    };
    setSelectedMaterialId(materialId);
  };

  const closeMaterial = () => {
    recordOpenMaterialTime();
    setSelectedMaterialId(null);
  };

  const handleEndSession = async () => {
    if (!sessionId || isSaving) return;

    try {
      setIsSaving(true);
      setSessionError(null);
      const finalMaterialActivity = recordOpenMaterialTime();
      const sessionActivities: StudySessionActivity[] = [
        ...activities,
        ...(finalMaterialActivity ? [finalMaterialActivity] : []),
      ].map(activity => ({
        type: activity.type,
        duration: activity.durationSeconds / 60,
        timestamp: activity.timestamp.toISOString(),
        ...(activity.metadata ? { metadata: activity.metadata } : {}),
      }));
      const elapsedSeconds = getElapsedSeconds();
      const endedSession = await endSession(
        sessionId,
        notes.trim(),
        sessionActivities,
        elapsedSeconds,
        getPausedDurationSeconds()
      );
      void trackAction(
        XAPI_VERBS.COMPLETED,
        studySessionXapiObject(sessionId),
        {
          completion: true,
          duration: `PT${elapsedSeconds}S`,
        },
        getSessionXapiContext(sessionId)
      );
      const durationLabel = `${endedSession.duration ?? Math.floor(elapsedSeconds / 60)} min`;
      if (endedSession.isValid) {
        toast.success(
          `${durationLabel} study session saved${contextLabel ? ` for ${contextLabel}` : ''} and counted toward your learning progress.`
        );
      } else {
        const reason = endedSession.invalidReason ? ` ${endedSession.invalidReason}.` : '';
        toast.info(
          `${durationLabel} study session saved${contextLabel ? ` for ${contextLabel}` : ''}, but was not counted toward progress or streaks.${reason}`
        );
      }
      setShowEndDialog(false);
      onSessionEnd(endedSession);
    } catch (error) {
      console.error('Error ending session:', error);
      setSessionError('Could not save this session. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const renderCourseMaterials = () => {
    if (!studyCourseId || !sessionId) return null;

    return (
      <section className="space-y-3 rounded-xl border bg-muted/20 p-4">
        <div>
          <h3 className="font-semibold">Course materials</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Open a resource here; reading time and material progress are tracked during the session.
          </p>
        </div>
        {isLoadingMaterials ? (
          <p className="text-sm text-muted-foreground" role="status">
            Loading course materials…
          </p>
        ) : materialsError ? (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-red-500" role="alert">
              {materialsError}
            </p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setMaterialsLoadAttempt(attempt => attempt + 1)}
            >
              Retry
            </Button>
          </div>
        ) : courseMaterials.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No materials are linked to this course yet.
          </p>
        ) : (
          <ScrollArea className="max-h-52 rounded-md">
            <div className="space-y-2 pr-3">
              {courseMaterials.map(material => (
                <div
                  key={material.id}
                  className="flex items-center justify-between gap-3 rounded-lg border bg-background p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{material.title}</p>
                    <p className="mt-0.5 text-xs capitalize text-muted-foreground">
                      {material.type || material.contentType}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => openMaterial(String(material.id))}
                    disabled={!isActive}
                    aria-label={`Read ${material.title}`}
                  >
                    <BookOpen className="mr-2 h-4 w-4" />
                    Read
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </section>
    );
  };

  return (
    <div>
      <Card>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold">
                {studyContext ? 'Course study session' : 'Study session'}
              </h2>
              {contextLabel && <p className="mt-1 text-sm text-muted-foreground">{contextLabel}</p>}
              <p className="mt-1 text-xs text-muted-foreground">
                Sessions under 5 minutes are saved but do not count toward progress or streaks.
              </p>
            </div>
            <div
              className="font-mono text-3xl tabular-nums text-blue-600 dark:text-blue-400"
              aria-live="off"
            >
              {formatTime(elapsedTime)}
            </div>
          </div>

          <div className="flex justify-center gap-4">
            {!sessionId ? (
              <Button
                onClick={handleStart}
                className="w-40"
                disabled={isStarting}
              >
                <Play className="h-4 w-4 mr-2" />
                {isStarting ? 'Starting…' : 'Start session'}
              </Button>
            ) : (
              <>
                {isActive ? (
                  <Button variant="outline" onClick={handlePause} className="w-32">
                    <Pause className="h-4 w-4 mr-2" />
                    Pause
                  </Button>
                ) : (
                  <Button onClick={handleStart} className="w-32">
                    <Play className="h-4 w-4 mr-2" />
                    Resume
                  </Button>
                )}
                <Button variant="destructive" onClick={handleStop} className="w-32">
                  <Square className="h-4 w-4 mr-2" />
                  End Session
                </Button>
              </>
            )}
          </div>

          {sessionError && (
            <p role="alert" className="text-center text-sm text-red-600">
              {sessionError}
            </p>
          )}

          {renderCourseMaterials()}
        </CardContent>
      </Card>

      <Dialog
        open={showEndDialog}
        onOpenChange={open => {
          if (!open && !isSaving) setShowEndDialog(false);
        }}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>End Study Session</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Session Duration</Label>
              <p className="text-lg font-mono text-blue-600 dark:text-blue-400">
                {formatTime(elapsedTime)}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Session Notes</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Write your session notes here..."
                className="min-h-25"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowEndDialog(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button onClick={handleEndSession} disabled={isSaving}>
              {isSaving ? 'Saving…' : 'End Session'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {selectedMaterialId && (
        <MaterialPreviewModal
          materialId={selectedMaterialId}
          isOpen
          onClose={closeMaterial}
          materials={courseMaterials}
          onNavigate={openMaterial}
          topicId={courseMaterials.find(item => String(item.id) === selectedMaterialId)?.topicId}
          userId={userId}
          studySessionId={sessionId ?? undefined}
          fallbackMaterial={courseMaterials.find(item => String(item.id) === selectedMaterialId)}
        />
      )}
    </div>
  );
};
