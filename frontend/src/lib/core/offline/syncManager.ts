import { syncService } from './syncService';

/**
 * Compatibility facade for callers that use the older semantic queue API.
 * All records are stored and flushed by SyncService.
 */
class SyncManager {
  async syncPendingItems(): Promise<void> {
    await syncService.syncOutbox();
  }

  async queueProgressLog(progressData: unknown): Promise<void> {
    await syncService.addToOutbox(
      '/progress/sync',
      'POST',
      { ...(progressData as Record<string, unknown>), syncedAt: new Date().toISOString() },
      { 'Content-Type': 'application/json' },
    );
  }

  isCurrentlyOnline(): boolean {
    return typeof navigator !== 'undefined' && navigator.onLine;
  }
}

export const syncManager = new SyncManager();
