import { useState, useEffect } from 'react';
import { syncService } from '@/lib/core/offline/syncService';

export function useConnectivity() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [pendingChanges, setPendingChanges] = useState(0);
  const [isFlushing, setIsFlushing] = useState(false);

  useEffect(() => {
    // 1. Online/Offline Listeners
    const handleOnline = () => {
      setIsOnline(true);
      // Trigger sync when coming back online
      syncService.syncOutbox(); 
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // 2. Poll Sync Status (Simple approach since SyncService doesn't emit events)
    // Detailed event-bus integration can be added later if polling proves expensive.
    const intervalId = setInterval(async () => {
      const status = await syncService.getSyncStatus();
      setPendingChanges(status.pendingChanges);
      setIsFlushing(status.isFlushing);
      // Double check online status from service source of truth
      if (status.isOnline !== isOnline) {
        setIsOnline(status.isOnline);
      }
      
      // Auto-trigger sync if online and pending changes exist (Seamless Sync)
      if (status.isOnline && status.pendingChanges > 0 && !status.isFlushing) {
        syncService.syncOutbox();
      }
    }, 2000); // Check every 2 seconds

    // Initial check
    syncService.getSyncStatus().then((status) => {
      setPendingChanges(status.pendingChanges);
      setIsFlushing(status.isFlushing);
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(intervalId);
    };
  }, [isOnline]);

  return {
    isOnline,
    pendingChanges,
    isFlushing,
    triggerSync: () => syncService.syncOutbox(),
  };
}
