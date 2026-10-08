import React, { useState, useEffect, useRef } from 'react';
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
import { Play, Pause, Square, BookOpen, Sparkles, ScrollText, Maximize2, Minimize2 } from 'lucide-react';
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
interface StudySessionProps {
  topicId?: string;
  context?: StudySessionContext;
  contextLabel?: string;
  onSessionEnd: (session: StudySessionResponse) => void;
  onSessionStarted?: () => void;
}

type Activity = {
  type: 'reading' | 'quiz' | 'notes';
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
  const [isSaving, setIsSaving] = useState(false);
  const [sessionGoal, setSessionGoal] = useState('');
  const [focusGoalMinutes, setFocusGoalMinutes] = useState(25);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const elapsedTimeRef = useRef(0);
  const lastActivitySecondsRef = useRef(0);
  const activeReadingRef = useRef<{ materialId: string; startedAtSeconds: number } | null>(null);

  useEffect(() => {
    elapsedTimeRef.current = elapsedTime;
  }, [elapsedTime]);

  useEffect(() => {
    let timer: number | undefined;
    if (isActive) {
      timer = window.setInterval(() => {
        setElapsedTime((prev: number) => {
          const next = prev + 1;
          elapsedTimeRef.current = next;
          return next;
        });
      }, 1000);
    }
    return () => {
      if (timer) window.clearInterval(timer);
    };
  }, [isActive]);

  useEffect(() => {
    if (!sessionId || !studyCourseId) {
      setCourseMaterials([]);
      setMaterialsError(null);
      return;
    }

    let isCurrent = true;
    setIsLoadingMaterials(true);
    setMaterialsError(null);
    materialService.getMaterialsPaginated({
      page: 1,
      limit: 50,
      courseId: studyCourseId,
      scope: 'enrolled',
    }).then(result => {
      if (isCurrent) setCourseMaterials(result.items);
    }).catch(error => {
      console.error('Could not load course materials for the study session:', error);
      if (isCurrent) setMaterialsError('Course materials could not be loaded. Please try again.');
    }).finally(() => {
      if (isCurrent) setIsLoadingMaterials(false);
    });

    return () => {
      isCurrent = false;
    };
  }, [materialsLoadAttempt, sessionId, studyCourseId]);

  useEffect(() => {
    if (isActive && elapsedTime === focusGoalMinutes * 60) {
      toast.success(`${focusGoalMinutes}-minute focus goal reached. Keep going or wrap up.`);
    }
  }, [elapsedTime, focusGoalMinutes, isActive]);

  useEffect(() => {
    if (!isFocusMode) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !selectedMaterialId) setIsFocusMode(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFocusMode, selectedMaterialId]);

  const handleStart = async () => {
    if (sessionId) {
      setSessionError(null);
      setIsActive(true);
      return;
    }

    try {
      setSessionError(null);
      const session = await startSession(studyContext);
      if (session) {
        setSessionId(session.id);
        setIsActive(true);
        onSessionStarted?.();
      } else {
        setSessionError('Could not start this session. Please try again.');
      }
    } catch (error) {
      console.error('Error starting session:', error);
      setSessionError('Could not start this session. Please try again.');
    }
  };

  const handlePause = () => {
    setIsActive(false);
  };

  const handleStop = () => {
    setIsFocusMode(false);
    setShowEndDialog(true);
  };

  const recordActivity = (
    type: Activity['type'],
    metadata?: Record<string, unknown>,
    durationSeconds = Math.max(0, elapsedTimeRef.current - lastActivitySecondsRef.current),
  ) => {
    setActivities(prev => [
      ...prev,
      { type, durationSeconds, timestamp: new Date(), ...(metadata ? { metadata } : {}) },
    ]);
    lastActivitySecondsRef.current = elapsedTimeRef.current;
  };

  const takeOpenMaterialActivity = (): Activity | null => {
    const activeReading = activeReadingRef.current;
    if (!activeReading) return null;

    const durationSeconds = Math.max(
      0,
      elapsedTimeRef.current - activeReading.startedAtSeconds,
    );
    const material = courseMaterials.find(item => String(item.id) === activeReading.materialId);
    activeReadingRef.current = null;
    lastActivitySecondsRef.current = elapsedTimeRef.current;
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
      startedAtSeconds: elapsedTimeRef.current,
    };
    lastActivitySecondsRef.current = elapsedTimeRef.current;
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
      const sessionNotes = [
        sessionGoal.trim() ? `Session goal: ${sessionGoal.trim()}` : '',
        notes.trim(),
      ].filter(Boolean).join('\n\n');
      const endedSession = await endSession(sessionId, sessionNotes, sessionActivities, elapsedTime);
      const durationLabel = `${endedSession.duration ?? Math.floor(elapsedTime / 60)} min`;
      if (endedSession.isValid) {
        toast.success(
          `${durationLabel} study session saved${contextLabel ? ` for ${contextLabel}` : ''} and counted toward your learning progress.`,
        );
      } else {
        const reason = endedSession.invalidReason ? ` ${endedSession.invalidReason}.` : '';
        toast.info(
          `${durationLabel} study session saved${contextLabel ? ` for ${contextLabel}` : ''}, but was not counted toward progress or streaks.${reason}`,
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

  const addActivity = (type: Activity['type']) => {
    recordActivity(type);
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatActivityDuration = (seconds: number) => seconds < 60
    ? `${seconds} sec`
    : `${Math.floor(seconds / 60)} min`;

  const renderCourseMaterials = (focusMode = false) => {
    if (!studyCourseId || !sessionId) return null;

    return (
      <section className={`space-y-3 rounded-xl border p-4 ${focusMode ? 'border-slate-700 bg-slate-900/70 text-white' : 'bg-muted/20'}`}>
        <div>
          <h3 className={`font-semibold ${focusMode ? 'text-white' : ''}`}>Course materials</h3>
          <p className={`mt-1 text-xs ${focusMode ? 'text-slate-400' : 'text-muted-foreground'}`}>
            Open a resource here; reading time and material progress are tracked during the session.
          </p>
        </div>
        {isLoadingMaterials ? (
          <p className={`text-sm ${focusMode ? 'text-slate-300' : 'text-muted-foreground'}`} role="status">
            Loading course materials…
          </p>
        ) : materialsError ? (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-red-500" role="alert">{materialsError}</p>
            <Button
              type="button"
              size="sm"
              variant={focusMode ? 'secondary' : 'outline'}
              onClick={() => setMaterialsLoadAttempt(attempt => attempt + 1)}
            >
              Retry
            </Button>
          </div>
        ) : courseMaterials.length === 0 ? (
          <p className={`text-sm ${focusMode ? 'text-slate-300' : 'text-muted-foreground'}`}>
            No materials are linked to this course yet.
          </p>
        ) : (
          <ScrollArea className="max-h-52 rounded-md">
            <div className="space-y-2 pr-3">
              {courseMaterials.map(material => (
                <div
                  key={material.id}
                  className={`flex items-center justify-between gap-3 rounded-lg border p-3 ${focusMode ? 'border-slate-700 bg-slate-950/70' : 'bg-background'}`}
                >
                  <div className="min-w-0">
                    <p className={`truncate text-sm font-medium ${focusMode ? 'text-white' : ''}`}>{material.title}</p>
                    <p className={`mt-0.5 text-xs capitalize ${focusMode ? 'text-slate-400' : 'text-muted-foreground'}`}>
                      {material.type || material.contentType}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant={focusMode ? 'secondary' : 'outline'}
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
      {isFocusMode && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="focus-mode-title"
          className="fixed inset-0 z-[60] flex min-h-screen flex-col items-center justify-center overflow-y-auto bg-slate-950 px-6 py-10 text-white"
        >
          {selectedMaterialId ? (
            <div className="h-dvh w-full">
              <MaterialPreviewModal
                materialId={selectedMaterialId}
                isOpen
                onClose={closeMaterial}
                materials={courseMaterials}
                onNavigate={openMaterial}
                inline
                topicId={courseMaterials.find(item => String(item.id) === selectedMaterialId)?.topicId}
                userId={userId}
                fallbackMaterial={courseMaterials.find(item => String(item.id) === selectedMaterialId)}
              />
            </div>
          ) : (
            <>
              <div className="absolute right-6 top-6">
                <Button variant="outline" onClick={() => setIsFocusMode(false)} className="border-slate-700 bg-slate-900 text-white hover:bg-slate-800">
                  <Minimize2 className="mr-2 h-4 w-4" />
                  Exit focus mode
                </Button>
              </div>
              <div className="w-full max-w-2xl text-center">
                <p className="text-sm font-semibold uppercase tracking-[0.25em] text-indigo-300">Focus session</p>
                <h2 id="focus-mode-title" className="mt-4 text-3xl font-semibold">One thing at a time.</h2>
                {sessionGoal.trim() && (
                  <p className="mx-auto mt-4 max-w-xl text-lg text-slate-300">{sessionGoal.trim()}</p>
                )}
                <p className="mt-12 font-mono text-7xl font-semibold tabular-nums sm:text-8xl" aria-live="off">
                  {formatTime(Math.max(0, focusGoalMinutes * 60 - elapsedTime))}
                </p>
                <p className="mt-3 text-slate-400">
                  {elapsedTime >= focusGoalMinutes * 60
                    ? `${formatTime(elapsedTime)} focused · goal reached`
                    : `${formatTime(elapsedTime)} focused · ${focusGoalMinutes}-minute goal`}
                </p>
                <div className="mt-10 flex justify-center gap-3">
                  {isActive ? (
                    <Button variant="outline" onClick={handlePause} className="border-slate-700 bg-slate-900 text-white hover:bg-slate-800">
                      <Pause className="mr-2 h-4 w-4" />
                      Pause
                    </Button>
                  ) : (
                    <Button onClick={handleStart}>
                      <Play className="mr-2 h-4 w-4" />
                      Resume session
                    </Button>
                  )}
                  <Button variant="destructive" onClick={handleStop}>
                    <Square className="mr-2 h-4 w-4" />
                    End session
                  </Button>
                </div>
                <p className="mt-8 text-sm text-slate-500">Press Escape to leave focus mode. Your session timer keeps its place.</p>
              </div>
              <div className="mt-8 w-full max-w-2xl text-left">
                {renderCourseMaterials(true)}
              </div>
            </>
          )}
        </div>
      )}
      <Card>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold">{studyContext ? 'Course study session' : 'General focus session'}</h2>
              {contextLabel && (
                <p className="mt-1 text-sm text-muted-foreground">{contextLabel}</p>
              )}
              <p className="mt-1 text-xs text-muted-foreground">
                Sessions under 5 minutes are saved but do not count toward progress or streaks.
              </p>
            </div>
            <div className="text-3xl font-mono text-blue-600 dark:text-blue-400">
              {formatTime(elapsedTime)}
            </div>
          </div>

          {sessionGoal.trim() && (
            <div className="rounded-lg border border-indigo-100 bg-indigo-50/70 px-4 py-3 text-sm text-indigo-950 dark:border-indigo-900 dark:bg-indigo-950/30 dark:text-indigo-100">
              <span className="font-semibold">Session goal:</span> {sessionGoal.trim()}
            </div>
          )}

          {!sessionId && (
            <div className="space-y-3 rounded-xl border bg-muted/20 p-4">
              <div className="space-y-2">
                <Label htmlFor="study-session-goal">What will you accomplish?</Label>
                <Textarea
                  id="study-session-goal"
                  value={sessionGoal}
                  onChange={event => setSessionGoal(event.target.value)}
                  placeholder="For example: explain the renin-angiotensin system from memory"
                  className="min-h-20"
                />
              </div>
              <div>
                <Label>Focus interval</Label>
                <div className="mt-2 flex gap-2">
                  {[25, 50].map(minutes => (
                    <Button
                      key={minutes}
                      type="button"
                      size="sm"
                      variant={focusGoalMinutes === minutes ? 'default' : 'outline'}
                      aria-pressed={focusGoalMinutes === minutes}
                      onClick={() => setFocusGoalMinutes(minutes)}
                    >
                      {minutes} minutes
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-center gap-4">
            {!isActive ? (
              <Button onClick={handleStart} className="w-40">
                <Play className="h-4 w-4 mr-2" />
                {sessionId ? 'Resume Session' : 'Start Session'}
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={handlePause} className="w-32">
                  <Pause className="h-4 w-4 mr-2" />
                  Pause
                </Button>
                <Button variant="destructive" onClick={handleStop} className="w-32">
                  <Square className="h-4 w-4 mr-2" />
                  End Session
                </Button>
              </>
            )}
          </div>

          {sessionId && (
            <div className="flex justify-center">
              <Button variant="outline" onClick={() => setIsFocusMode(true)}>
                <Maximize2 className="mr-2 h-4 w-4" />
                Enter focus mode
              </Button>
            </div>
          )}

          {sessionError && <p role="alert" className="text-center text-sm text-red-600">{sessionError}</p>}

          <div className="flex justify-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => addActivity('reading')}
              disabled={!sessionId || !isActive}
              title="Add Reading Activity"
              aria-label="Add reading activity"
              className="h-10 w-10"
            >
              <BookOpen className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => addActivity('quiz')}
              disabled={!sessionId || !isActive}
              title="Add Quiz Activity"
              aria-label="Add quiz activity"
              className="h-10 w-10"
            >
              <Sparkles className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => addActivity('notes')}
              disabled={!sessionId || !isActive}
              title="Add Notes Activity"
              aria-label="Add notes activity"
              className="h-10 w-10"
            >
              <ScrollText className="h-5 w-5" />
            </Button>
          </div>

          {renderCourseMaterials()}

          {activities.length > 0 && (
            <div>
              <h3 className="text-lg font-medium mb-2">Activities</h3>
              <ScrollArea className="h-50 rounded-md border p-4">
                <div className="space-y-2">
                  {activities.map((activity, index) => (
                    <div key={index} className="flex items-center gap-2 text-sm">
                      {activity.type === 'reading' && <BookOpen className="h-4 w-4" />}
                      {activity.type === 'quiz' && <Sparkles className="h-4 w-4" />}
                      {activity.type === 'notes' && <ScrollText className="h-4 w-4" />}
                      <span>
                        {activity.type.charAt(0).toUpperCase() + activity.type.slice(1)} -{' '}
                        {formatActivityDuration(activity.durationSeconds)}
                        {typeof activity.metadata?.materialTitle === 'string'
                          ? ` · ${activity.metadata.materialTitle}`
                          : ''}
                      </span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showEndDialog} onOpenChange={open => setShowEndDialog(open)}>
        <DialogContent>
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
            <Button variant="outline" onClick={() => setShowEndDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleEndSession} disabled={isSaving}>
              {isSaving ? 'Saving…' : 'End Session'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {!isFocusMode && selectedMaterialId && (
        <MaterialPreviewModal
          materialId={selectedMaterialId}
          isOpen
          onClose={closeMaterial}
          materials={courseMaterials}
          onNavigate={openMaterial}
          topicId={courseMaterials.find(item => String(item.id) === selectedMaterialId)?.topicId}
          userId={userId}
          fallbackMaterial={courseMaterials.find(item => String(item.id) === selectedMaterialId)}
        />
      )}
    </div>
  );
};
