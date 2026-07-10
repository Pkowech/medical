import { offlineService } from './offlineService';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';
const API_BASE_URL = `${BACKEND_URL}/v1`;

class SyncManager {
  private isOnline: boolean = navigator.onLine;
  private syncInProgress: boolean = false;
  private maxRetries: number = 3;

  constructor() {
    this.setupNetworkListeners();
  }

  private setupNetworkListeners() {
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);
  }

  private handleOnline = async () => {
    this.isOnline = true;
    await this.syncPendingItems();
  };

  private handleOffline = () => {
    this.isOnline = false;
  };

  async syncPendingItems() {
    if (this.syncInProgress || !this.isOnline) return;

    try {
      this.syncInProgress = true;
      const items = await offlineService.getSyncQueueItems();

      for (const item of items) {
        if (item.attempts >= this.maxRetries) {
          // Remove items that have exceeded max retries
          await offlineService.removeFromSyncQueue(item.id);
          continue;
        }

        try {
          await this.processSyncItem(item);
          await offlineService.removeFromSyncQueue(item.id);
        } catch (error) {
          console.error(`Failed to sync item ${item.id}:`, error);
          await offlineService.incrementSyncAttempt(item.id);
        }
      }
    } finally {
      this.syncInProgress = false;
    }
  }

  private async processSyncItem(item: { type: string; data: unknown }) {
    switch (item.type) {
      case 'quiz_submission':
        await this.syncQuizSubmission(item.data);
        break;
      case 'progress_log':
        await this.syncProgressLog(item.data);
        break;
      default:
        throw new Error(`Unknown sync item type: ${item.type}`);
    }
  }

  private async syncQuizSubmission(data: unknown) {
    const response = await fetch(`${API_BASE_URL}/quizzes/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...(data as Record<string, unknown>),
        syncedAt: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to sync quiz submission');
    }
  }

  private async syncProgressLog(data: unknown) {
    const response = await fetch(`${API_BASE_URL}/progress/log`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...(data as Record<string, unknown>),
        syncedAt: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to sync progress log');
    }
  }

  // Public methods
  async queueQuizSubmission(quizData: unknown) {
    await offlineService.addToSyncQueue({
      type: 'quiz_submission',
      data: quizData,
      timestamp: Date.now(),
    });

    if (this.isOnline) {
      await this.syncPendingItems();
    }
  }

  async queueProgressLog(progressData: unknown) {
    await offlineService.addToSyncQueue({
      type: 'progress_log',
      data: progressData,
      timestamp: Date.now(),
    });

    if (this.isOnline) {
      await this.syncPendingItems();
    }
  }

  isCurrentlyOnline() {
    return this.isOnline;
  }
}

export const syncManager = new SyncManager();
