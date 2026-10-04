'use client';

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { offlineService } from './offlineService';
import { syncService } from './syncService';

export function OfflineSessionManager() {
  const { data: session, status } = useSession();
  const userId = session?.user?.id;

  useEffect(() => {
    if (status !== 'authenticated' || !userId) return;

    let active = true;
    const activateUser = async () => {
      const previousUserId = offlineService.getActiveOfflineUserId();
      if (previousUserId && previousUserId !== userId) {
        try {
          await offlineService.clearUserOfflineContent(previousUserId);
        } catch (error) {
          console.error('[OfflineCache] Could not clear the previous user’s offline cache:', error);
          if (active) offlineService.setActiveOfflineUserId(userId);
          return;
        }
      }
      if (active) offlineService.setActiveOfflineUserId(userId);
    };
    void activateUser().catch(error => {
      console.error('[OfflineCache] Could not prepare the current user’s offline cache:', error);
    });

    return () => {
      active = false;
    };
  }, [status, userId]);

  useEffect(() => {
    if (status !== 'authenticated' || !userId) return;
    const syncWhenOnline = () => {
      void syncService.syncOutbox().catch(error => {
        console.error('[OfflineSync] Failed to flush queued study activity:', error);
      });
    };
    window.addEventListener('online', syncWhenOnline);
    if (navigator.onLine) syncWhenOnline();
    return () => window.removeEventListener('online', syncWhenOnline);
  }, [status, userId]);

  return null;
}
