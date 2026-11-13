import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import progressService, {
  isProgressConflict,
} from '@/features/learning-management/services/progressService';
import { isOfflineQueuedError } from '@/lib/core/offline/offlineQueuedError';
import { useXapi } from '@/lib/xapi/useXapi';
import { URLS } from '@/lib/urls';
import { useAuthStore } from '@/features/auth/store/useAuthStore';

type Options = {
  materialId?: string;
  topicId?: string | null;
  unitId?: string | null;
  courseId?: string | null;
  studySessionId?: string | null;
  materialTitle?: string;
  computePercent?: () => number; // optional callback to compute current progress percent (0-100)
  intervalMs?: number; // how often to send updates
};

export default function useMaterialProgressTracker(options: Options) {
  const {
    materialId,
    topicId,
    unitId,
    courseId,
    studySessionId,
    materialTitle,
    computePercent,
    intervalMs = 60000,
  } = options;
  const userId = useAuthStore(state => state.user?.id);
  const [isTracking, setIsTracking] = useState(false);
  const intervalRef = useRef<number | null>(null);
  const isTrackingRef = useRef(false);
  const computePercentRef = useRef(computePercent);
  computePercentRef.current = computePercent;
  const lastPercentRef = useRef<number>(0);
  const lastSyncTimeRef = useRef<number>(0);
  const activeElapsedMsRef = useRef(0);
  const lastTickAtRef = useRef<number | null>(null);
  const lastReportedMinutesRef = useRef(0);
  const progressRevisionRef = useRef(0);
  const progressRevisionLoadRef = useRef<Promise<void>>(Promise.resolve());
  const progressConflictRef = useRef(false);
  const sendInFlightRef = useRef<Promise<void> | null>(null);
  const isCompletedRef = useRef(false);
  const isCompletingRef = useRef(false);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [currentPercent, setCurrentPercent] = useState<number>(0);

  const { trackAction, XAPI_VERBS } = useXapi();

  useEffect(() => {
    if (!userId || (!materialId && !topicId)) return;
    let active = true;
    progressRevisionRef.current = 0;
    progressConflictRef.current = false;
    const revisionLoad = progressService
      .getUserProgress(userId)
      .then(rows => {
        const row = rows.find(
          progress =>
            progress.materialId === (materialId ?? null) &&
            progress.topicId === (topicId ?? null) &&
            progress.unitId === (unitId ?? null) &&
            progress.courseId === (courseId ?? null),
        );
        if (active) {
          progressRevisionRef.current =
            typeof row?.revision === 'number' && Number.isSafeInteger(row.revision)
              ? row.revision
              : 0;
        }
      })
      .catch(error => {
        if (active) {
          console.warn('Could not load material progress revision:', error);
        }
      });
    progressRevisionLoadRef.current = revisionLoad;
    return () => {
      active = false;
    };
  }, [courseId, materialId, topicId, unitId, userId]);

  useEffect(() => {
    const resetActiveClock = () => {
      lastTickAtRef.current = document.visibilityState === 'visible'
        ? Date.now()
        : null;
    };
    document.addEventListener('visibilitychange', resetActiveClock);
    return () => document.removeEventListener('visibilitychange', resetActiveClock);
  }, []);

  // Internal helper to send progress
  const sendProgress = useCallback(
    async (percent: number, elapsedMinutes: number, force = false): Promise<boolean> => {
      while (sendInFlightRef.current) {
        await sendInFlightRef.current;
      }
      if (progressConflictRef.current) return false;

      const now = Date.now();
      await progressRevisionLoadRef.current;
      // Throttling: Ensure at least 15s between syncs even for significant deltas
      if (
        percent >= 100 &&
        lastPercentRef.current >= 100 &&
        elapsedMinutes <= lastReportedMinutesRef.current
      ) {
        return true;
      }
      if (!force && now - lastSyncTimeRef.current < 15000 && percent < 100) {
        return true;
      }
      let finishSend!: () => void;
      const sendPromise = new Promise<void>(resolve => {
        finishSend = resolve;
      });
      sendInFlightRef.current = sendPromise;
      try {
        lastSyncTimeRef.current = now;
        const unreportedMinutes = studySessionId
          ? 0
          : Math.max(0, elapsedMinutes - lastReportedMinutesRef.current);
        let progressSaved = !(materialId || topicId);

        if (materialId || topicId) {
          try {
            await progressService.updateContentProgress({
              materialId,
              topicId,
              unitId,
              courseId,
              status: percent >= 100 ? 'completed' : 'inProgress',
              progressPercentage: percent,
              timeSpentMinutes: unreportedMinutes,
              expectedRevision: progressRevisionRef.current,
            });
            progressSaved = true;
          } catch (err) {
            if (isOfflineQueuedError(err)) {
              progressSaved = true;
            } else if (isProgressConflict(err)) {
              progressConflictRef.current = true;
              console.error('Material progress changed on another device', err);
              toast.error(
                'Progress changed elsewhere. Refresh this page before saving again.',
              );
            } else {
              console.error('Failed to send material progress', err);
              toast.error('Material progress could not be saved.');
            }
          }
          if (progressSaved) {
            progressRevisionRef.current += 1;
            lastReportedMinutesRef.current = elapsedMinutes;
          }
        }
        if (progressSaved) {
          lastPercentRef.current = percent;
        }

        if (materialId) {
          try {
            const verb = percent >= 100 ? XAPI_VERBS.COMPLETED : XAPI_VERBS.PROGRESSED;
            await trackAction(
              verb,
              {
                id: `${URLS.BASE}/materials/${materialId}`,
                definition: {
                  name: { 'en-US': materialTitle || `Material ${materialId}` },
                  type: 'http://adlnet.gov/expapi/activities/media',
                },
              },
              {
                completion: percent >= 100,
                duration: `PT${unreportedMinutes}M`,
                extensions: {
                  'http://id.tincanapi.com/extension/progress': percent,
                },
              },
              {
                extensions: {
                  [URLS.XAPI_EXTENSIONS.COURSE_ID]: courseId,
                  [URLS.XAPI_EXTENSIONS.UNIT_ID]: unitId,
                  [URLS.XAPI_EXTENSIONS.TOPIC_ID]: topicId,
                  [URLS.XAPI_EXTENSIONS.STUDY_SESSION_ID]: studySessionId,
                },
              }
            );
          } catch (err) {
            console.error('Failed to track material progress in xAPI', err);
          }
        }
        return progressSaved;
      } finally {
        sendInFlightRef.current = null;
        finishSend();
      }
    },
    [courseId, materialId, materialTitle, studySessionId, topicId, trackAction, unitId, XAPI_VERBS]
  );

  const computeCurrentPercent = useCallback((): number => {
    const currentComputePercent = computePercentRef.current;
    if (typeof currentComputePercent === 'function') {
      try {
        const p = currentComputePercent();
        return Math.max(0, Math.min(100, Math.round(p)));
      } catch (err) {
        console.warn('computePercent callback failed', err);
      }
    }
    return 0;
  }, []);

  const startTracking = useCallback(() => {
    if (isTrackingRef.current) return;
    isTrackingRef.current = true;
    isCompletedRef.current = false;
    isCompletingRef.current = false;
    activeElapsedMsRef.current = 0;
    lastTickAtRef.current = document.visibilityState === 'visible'
      ? Date.now()
      : null;
    setIsTracking(true);

    // Initial state
    const initialPercent = computeCurrentPercent();
    setCurrentPercent(initialPercent);
    setElapsedSeconds(0);
    lastPercentRef.current = initialPercent;
    lastSyncTimeRef.current = Date.now(); // Mark start time as "last sync" to delay first interval sync
    lastReportedMinutesRef.current = 0;

    // Repeating updates (every 1s for UI smoothness, but sync happens less frequently)
    intervalRef.current = window.setInterval(async () => {
      const tickAt = Date.now();
      const previousTickAt = lastTickAtRef.current;
      lastTickAtRef.current = tickAt;
      if (previousTickAt !== null && document.visibilityState === 'visible') {
        activeElapsedMsRef.current += Math.min(tickAt - previousTickAt, 5000);
      }

      const p = computeCurrentPercent();
      const elapsedMin = Math.floor(activeElapsedMsRef.current / 60000);

      setCurrentPercent(p);
      setElapsedSeconds(Math.floor(activeElapsedMsRef.current / 1000));
      if (isCompletedRef.current || isCompletingRef.current) return;

      const now = Date.now();
      const isNewlyCompleted = p === 100 && lastPercentRef.current < 100;
      const isSignificantDelta = Math.abs(p - lastPercentRef.current) >= 10;
      const isTimeForSync = now - lastSyncTimeRef.current >= intervalMs;

      if (isNewlyCompleted || isSignificantDelta || isTimeForSync) {
        const progressSaved = await sendProgress(p, elapsedMin);

        if (isNewlyCompleted && progressSaved) {
          toast.success('Material completed!', {
            icon: '✅',
            duration: 3000,
          });
        }
      }
    }, 1000) as unknown as number;
  }, [computeCurrentPercent, intervalMs, sendProgress]);

  const stopTracking = useCallback(async () => {
    if (!isTrackingRef.current) return;
    isTrackingRef.current = false;
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (lastTickAtRef.current !== null && document.visibilityState === 'visible') {
      activeElapsedMsRef.current += Math.min(Date.now() - lastTickAtRef.current, 5000);
    }
    lastTickAtRef.current = null;
    const elapsedMin = Math.floor(activeElapsedMsRef.current / 60000);
    const p = isCompletedRef.current ? 100 : computeCurrentPercent();
    await sendProgress(p, elapsedMin, true);
    setIsTracking(false);
    setElapsedSeconds(0);
  }, [computeCurrentPercent, sendProgress]);

  const markComplete = useCallback(async () => {
    if (!materialId) return;
    if (isCompletedRef.current || isCompletingRef.current) return;
    isCompletingRef.current = true;
    const elapsedMin = Math.floor(activeElapsedMsRef.current / 60000);
    try {
      if (await sendProgress(100, elapsedMin, true)) {
        isCompletedRef.current = true;
        setCurrentPercent(100);
      }
    } finally {
      isCompletingRef.current = false;
    }
  }, [materialId, sendProgress]);

  // Flush the final unreported duration when the reader unmounts.
  useEffect(() => {
    return () => {
      void stopTracking();
    };
  }, [stopTracking]);

  return {
    isTracking,
    startTracking,
    stopTracking,
    markComplete,
    computeCurrentPercent,
    elapsedSeconds,
    currentPercent,
  };
}
