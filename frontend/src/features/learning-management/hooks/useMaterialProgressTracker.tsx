import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import progressService from '@/features/learning-management/services/progressService';
import offlineSync from '@/features/learning-management/services/offlineProgressSync';
import { useXapi } from '@/lib/xapi/useXapi';
import { URLS } from '@/lib/urls';

type Options = {
  materialId?: string;
  topicId?: string | null;
  unitId?: string | null;
  courseId?: string | null;
  computePercent?: () => number; // optional callback to compute current progress percent (0-100)
  intervalMs?: number; // how often to send updates
};

export default function useMaterialProgressTracker(options: Options) {
  const { materialId, topicId, unitId, courseId, computePercent, intervalMs = 60000 } = options;
  const [isTracking, setIsTracking] = useState(false);
  const timeStartedRef = useRef<number | null>(null);
  const intervalRef = useRef<number | null>(null);
  const isTrackingRef = useRef(false);
  const computePercentRef = useRef(computePercent);
  computePercentRef.current = computePercent;
  const lastPercentRef = useRef<number>(0);
  const lastSyncTimeRef = useRef<number>(0);
  const lastReportedMinutesRef = useRef(0);
  const isSendingRef = useRef(false);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [currentPercent, setCurrentPercent] = useState<number>(0);

  const { trackAction, XAPI_VERBS } = useXapi();
  const materialTitleFetched = useRef<string | null>(null);

  // Fetch material title for xAPI if not provided
  useEffect(() => {
    if (materialId && !materialTitleFetched.current) {
      // We don't have the title here easily, but we can assume the caller might provide it
      // or we can fetch it once. For now, we'll rely on the caller or use a generic title.
    }
  }, [materialId]);

  // Internal helper to send progress
  const sendProgress = useCallback(async (percent: number, elapsedMinutes: number) => {
    const now = Date.now();
    if (isSendingRef.current) return;
    // Throttling: Ensure at least 15s between syncs even for significant deltas
    if (percent >= 100 && lastPercentRef.current >= 100) {
      return;
    }
    if (now - lastSyncTimeRef.current < 15000 && percent < 100) {
      return;
    }
    isSendingRef.current = true;
    lastSyncTimeRef.current = now;
    const unreportedMinutes = Math.max(0, elapsedMinutes - lastReportedMinutesRef.current);
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
        });
        progressSaved = true;
      } catch (err) {
        console.error('Failed to send material progress', err);
        try {
          await offlineSync.addToQueue({
            unitId: unitId || undefined,
            topicId: topicId || undefined,
            courseId: courseId || undefined,
            materialId: materialId || undefined,
            percent,
            timeSpentMinutes: unreportedMinutes,
            status: percent >= 100 ? 'completed' : 'inProgress',
          });
          progressSaved = true;
        } catch (queueError) {
          console.error('Failed to queue material progress for offline sync', queueError);
          toast.error('Material progress could not be saved.');
        }
      }
      if (progressSaved) {
        lastReportedMinutesRef.current = elapsedMinutes;
      }
    }
    if (progressSaved) {
      lastPercentRef.current = percent;
    }

    if (materialId) {
      try {
        const verb = percent >= 100 ? XAPI_VERBS.COMPLETED : XAPI_VERBS.PROGRESSED;
        await trackAction(verb, {
          id: `${URLS.BASE}/materials/${materialId}`,
          definition: {
            name: { 'en-US': `Material ${materialId}` },
            type: 'http://adlnet.gov/expapi/activities/media',
          },
        }, {
          completion: percent >= 100,
          score: { scaled: percent / 100 },
          duration: `PT${elapsedMinutes}M`,
        });
      } catch (err) {
        console.error('Failed to track material progress in xAPI', err);
      }
    }
    isSendingRef.current = false;
  }, [courseId, materialId, topicId, trackAction, unitId, XAPI_VERBS]);

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
    // fallback: increment gently based on time elapsed
    const start = timeStartedRef.current || Date.now();
    const minutes = Math.max(0, (Date.now() - start) / 60000);
    const estimate = Math.min(100, Math.round((minutes / 10) * 100));
    return estimate; // assumes 10 minutes ~ 100% heuristic
  }, []);

  const startTracking = useCallback(() => {
    if (isTrackingRef.current) return;
    isTrackingRef.current = true;
    timeStartedRef.current = Date.now();
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
      const p = computeCurrentPercent();
      const now = Date.now();
      const elapsedMilli = now - (timeStartedRef.current || now);
      const elapsedMin = Math.max(0, Math.floor(elapsedMilli / 60000));
      
      setCurrentPercent(p);
      setElapsedSeconds(Math.max(0, Math.floor(elapsedMilli / 1000)));

      // Trigger server sync if 100% reached or significant delta (10%) OR interval elapsed
      const isNewlyCompleted = p === 100 && lastPercentRef.current < 100;
      const isSignificantDelta = Math.abs(p - lastPercentRef.current) >= 10;
      const isTimeForSync = (now - lastSyncTimeRef.current) >= intervalMs;

      if (isNewlyCompleted || isSignificantDelta || isTimeForSync) {
        await sendProgress(p, elapsedMin);

        if (isNewlyCompleted) {
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
    const elapsedMin = Math.max(
      0,
      Math.round((Date.now() - (timeStartedRef.current || Date.now())) / 60000),
    );
    const p = computeCurrentPercent();
    await sendProgress(p >= 100 ? 100 : p, elapsedMin);
    setIsTracking(false);
    timeStartedRef.current = null;
    setElapsedSeconds(0);
  }, [computeCurrentPercent, sendProgress]);

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
    computeCurrentPercent,
    elapsedSeconds,
    currentPercent,
  };
}
