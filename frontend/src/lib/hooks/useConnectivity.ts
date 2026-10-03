import { useState, useEffect, useCallback } from 'react';
import { syncService } from '@/lib/core/offline/syncService';
import { initializeOfflineQueue } from '@/features/learning-management/services/offlineProgressSync';

export function useConnectivity() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [pendingChanges, setPendingChanges] = useState(0);
  const [failedChanges, setFailedChanges] = useState(0);
  const [retryableFailedChanges, setRetryableFailedChanges] = useState(0);
  const [isFlushing, setIsFlushing] = useState(false);
  const [statusError, setStatusError] = useState<string | undefined>();
  const [latestFailure, setLatestFailure] = useState<string | undefined>();

  const refreshStatus = useCallback(async () => {
    const status = await syncService.getSyncStatus();
    setPendingChanges(status.pendingChanges);
    setFailedChanges(status.failedChanges);
    setRetryableFailedChanges(status.retryableFailedChanges);
    setIsFlushing(status.isFlushing);
    setStatusError(status.statusError);
    setLatestFailure(status.latestFailure);
    if (status.isOnline !== isOnline) setIsOnline(status.isOnline);
    if (status.isOnline && status.readyToSync && !status.isFlushing) {
      void syncService.syncOutbox().catch(error => {
        setStatusError(error instanceof Error ? error.message : String(error));
      });
    }
  }, [isOnline]);

  useEffect(() => {
    let disposed = false;
    void initializeOfflineQueue()
      .then(refreshStatus)
      .catch(error => {
        if (!disposed) {
          setStatusError(error instanceof Error ? error.message : String(error));
        }
      });

    // 1. Online/Offline Listeners
    const handleOnline = () => {
      setIsOnline(true);
      // Trigger sync when coming back online
      void syncService.syncOutbox().catch(error => {
        if (!disposed) {
          setStatusError(error instanceof Error ? error.message : String(error));
        }
      });
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // 2. Poll Sync Status (Simple approach since SyncService doesn't emit events)
    // Detailed event-bus integration can be added later if polling proves expensive.
    const intervalId = setInterval(() => void refreshStatus(), 5000);

    return () => {
      disposed = true;
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(intervalId);
    };
  }, [isOnline, refreshStatus]);

  return {
    isOnline,
    pendingChanges,
    failedChanges,
    retryableFailedChanges,
    isFlushing,
    statusError,
    latestFailure,
    retryFailed: async () => {
      try {
        await syncService.retryAllFailedItems();
        await refreshStatus();
      } catch (error) {
        setStatusError(error instanceof Error ? error.message : String(error));
      }
    },
    discardFailed: async () => {
      try {
        await syncService.discardAllFailedItems();
        await refreshStatus();
      } catch (error) {
        setStatusError(error instanceof Error ? error.message : String(error));
      }
    },
    triggerSync: async () => {
      try {
        await syncService.syncOutbox();
        await refreshStatus();
      } catch (error) {
        setStatusError(error instanceof Error ? error.message : String(error));
      }
    },
  };
}
