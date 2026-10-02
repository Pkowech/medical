import { useState, useEffect } from 'react';
import { syncService } from '@/lib/core/offline/syncService';
import { initializeOfflineQueue } from '@/features/learning-management/services/offlineProgressSync';

export function useConnectivity() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [pendingChanges, setPendingChanges] = useState(0);
  const [failedChanges, setFailedChanges] = useState(0);
  const [isFlushing, setIsFlushing] = useState(false);
  const [statusError, setStatusError] = useState<string | undefined>();

  useEffect(() => {
    let disposed = false;
    const refreshStatus = async () => {
      const status = await syncService.getSyncStatus();
      if (disposed) return;
      setPendingChanges(status.pendingChanges);
      setFailedChanges(status.failedChanges);
      setIsFlushing(status.isFlushing);
      setStatusError(status.statusError);
      if (status.isOnline !== isOnline) setIsOnline(status.isOnline);
      if (status.isOnline && status.readyToSync && !status.isFlushing) {
        void syncService.syncOutbox();
      }
    };

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
      void syncService.syncOutbox();
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
  }, [isOnline]);

  return {
    isOnline,
    pendingChanges,
    failedChanges,
    isFlushing,
    statusError,
    triggerSync: () => syncService.syncOutbox(),
    retryFailed: () => syncService.retryAllFailedItems(),
  };
}
