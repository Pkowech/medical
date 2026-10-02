import { syncService } from './syncService';

/**
 * Compatibility facade for callers that use the older semantic queue API.
 * All records are stored and flushed by SyncService.
 */
class SyncManager {
  async syncPendingItems(): Promise<void> {
    await syncService.syncOutbox();
  }

  async queueQuizSubmission(quizData: unknown): Promise<void> {
    await syncService.addToOutbox(
      '/quizzes/submit?type=full',
      'POST',
      { ...(quizData as Record<string, unknown>), syncedAt: new Date().toISOString() },
      { 'Content-Type': 'application/json' },
    );
  }

  async queueProgressLog(progressData: unknown): Promise<void> {
    await syncService.addToOutbox(
      '/progress/log',
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
