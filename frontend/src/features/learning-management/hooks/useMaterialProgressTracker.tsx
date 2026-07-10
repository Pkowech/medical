import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import progressService from '@/features/learning-management/services/progressService';
import api from '@/features/auth/services/apiClient';
import offlineSync, {
  ProgressQueueItem,
} from '@/features/learning-management/services/offlineProgressSync';
import { useXapi } from '@/lib/xapi/useXapi';

type Options = {
  materialId?: string;
  unitId?: string | null;
  courseId?: string | null;
  computePercent?: () => number; // optional callback to compute current progress percent (0-100)
  intervalMs?: number; // how often to send updates
};

export default function useMaterialProgressTracker(options: Options) {
  const { materialId, unitId, courseId: _courseId, computePercent, intervalMs = 60000 } = options;
  const [isTracking, setIsTracking] = useState(false);
  const timeStartedRef = useRef<number | null>(null);
  const intervalRef = useRef<number | null>(null);
  const lastPercentRef = useRef<number>(0);
  const lastSyncTimeRef = useRef<number>(0);
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
  async function sendProgress(percent: number, elapsedMinutes: number) {
    const now = Date.now();
    // Throttling: Ensure at least 15s between syncs even for significant deltas
    if (now - lastSyncTimeRef.current < 15000 && percent < 100) {
      return;
    }

    try {
      if (unitId) {
        await progressService.updateUnitProgress(
          unitId,
          percent >= 100 ? 'completed' : 'inProgress',
          percent,
          elapsedMinutes
        );
        lastPercentRef.current = percent;
        lastSyncTimeRef.current = now;
      } else if (materialId && percent >= 100) {
        // If no unit id, mark material as read (completion event)
        await api.post(`/progress/materials/${materialId}/read`);
        lastSyncTimeRef.current = now;
      }

      // xAPI Progress/Completion tracking
      if (materialId) {
        const verb = percent >= 100 ? XAPI_VERBS.COMPLETED : XAPI_VERBS.PROGRESSED;
        trackAction(verb, {
          id: `https://medtrackhub.com/materials/${materialId}`,
          definition: {
            name: { 'en-US': `Material ${materialId}` },
            type: 'http://adlnet.gov/expapi/activities/media',
          },
        }, {
          completion: percent >= 100,
          score: { scaled: percent / 100 },
          duration: `PT${elapsedMinutes}M`,
        });
      }
    } catch (err) {
      console.error('Failed to send material progress', err);
      // Non-blocking; queue for offline sync
      const queueItem: ProgressQueueItem = {
        unitId: unitId || undefined,
        materialId: materialId || undefined,
        percent,
        timeSpentMinutes: elapsedMinutes,
        status: percent >= 100 ? 'completed' : 'inProgress',
      };
      await offlineSync.addToQueue(queueItem);
      // Only toast on severe errors, not on rate limiting which is handled by sync queue
    }
  }

  function computeCurrentPercent(): number {
    if (typeof computePercent === 'function') {
      try {
        const p = computePercent();
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
  }

  const startTracking = () => {
    if (isTracking) return;
    timeStartedRef.current = Date.now();
    setIsTracking(true);

    // Initial state
    const initialPercent = computeCurrentPercent();
    setCurrentPercent(initialPercent);
    setElapsedSeconds(0);
    lastPercentRef.current = initialPercent;
    lastSyncTimeRef.current = Date.now(); // Mark start time as "last sync" to delay first interval sync

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
        
        if (p === 100 && lastPercentRef.current < 100) {
          toast.success('Material completed!', {
            icon: '✅',
            duration: 3000,
          });
        }
      }
    }, 1000) as unknown as number;
  };

  const stopTracking = async () => {
    if (!isTracking) return;
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    const elapsedMin = Math.max(
      0,
      Math.round((Date.now() - (timeStartedRef.current || Date.now())) / 60000)
    );
    const p = computeCurrentPercent();
    await sendProgress(p >= 100 ? 100 : p, elapsedMin);
    setIsTracking(false);
    timeStartedRef.current = null;
    setElapsedSeconds(0);
  };

  // auto-cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
  }, []);

  return {
    isTracking,
    startTracking,
    stopTracking,
    computeCurrentPercent,
    elapsedSeconds,
    currentPercent,
  };
}
