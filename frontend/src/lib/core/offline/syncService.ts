import { useAuthStore } from '@/features/auth/store/useAuthStore';
import { getSession } from 'next-auth/react';
import { initDB, SyncQueueItem } from './db';
import { normalizeApiUrl } from './normalizeApiUrl';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

const SYNC_STORE_NAME = 'syncQueue' as const;
const MAX_SYNC_ATTEMPTS = 3;

class SyncService {
  private isFlushing = false; // Concurrency lock to prevent parallel flushes

  private async getDb() {
    return initDB();
  }

  async getQueueItems(): Promise<SyncQueueItem[]> {
    const db = await this.getDb();
    return db.getAll(SYNC_STORE_NAME);
  }

  async importQueueItem(item: SyncQueueItem): Promise<void> {
    const db = await this.getDb();
    await db.put(SYNC_STORE_NAME, item);
  }

  async removeQueueItem(id: string): Promise<void> {
    const db = await this.getDb();
    await db.delete(SYNC_STORE_NAME, id);
  }

  private normalizeUrl(url: string): string {
    return normalizeApiUrl(url, window.location.origin);
  }

  async addToOutbox(
    url: string,
    method: HttpMethod,
    body?: unknown,
    headers?: Record<string, string>,
    lastUpdated?: number,
    id?: string,
  ): Promise<void> {
    const now = Date.now();
    const db = await this.getDb();
    const item: SyncQueueItem = {
      id: id || crypto.randomUUID(),
      url: this.normalizeUrl(url),
      method,
      headers,
      body,
      createdAt: now,
      timestamp: now,
      lastUpdated: lastUpdated || now,
      attempts: 0,
      status: 'pending',
    };
    await db.put(SYNC_STORE_NAME, item);
    // Request a background sync
    if (
      typeof navigator !== 'undefined' &&
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      'SyncManager' in window
    ) {
      void navigator.serviceWorker.ready
        .then(registration => {
          const regWithSync = registration as ServiceWorkerRegistration & {
            sync?: { register: (tag: string) => Promise<void> };
          };
          return regWithSync.sync?.register('sync-outbox');
        })
        .catch(error => console.error('Background sync registration failed', error));
    }

    // Auto-trigger sync if online (Seamless Sync)
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      // We don't await this so the UI returns immediately
      this.syncOutbox().catch(err => console.error('Auto-sync failed:', err));
    }
  }

  async getSyncStatus(): Promise<{
    lastSyncTimestamp: number;
    isOnline: boolean;
    pendingChanges: number;
    failedChanges: number;
    isFlushing: boolean;
    readyToSync: boolean;
    latestFailure?: string;
    statusError?: string;
  }> {
    try {
      const items = await this.getQueueItems();
      const pendingItems = items.filter(item => item.status !== 'failed');
      const failedChanges = items.filter(item => item.status === 'failed').length;
      const count = pendingItems.length;
      return {
        lastSyncTimestamp: Date.now(), // This should ideally come from actual last sync, but for now, current time
        isOnline: typeof navigator !== 'undefined' ? navigator.onLine : false,
        pendingChanges: count,
        failedChanges,
        isFlushing: this.isFlushing, // Expose flush lock status
        readyToSync: pendingItems.some(item => (item.nextAttemptAt ?? 0) <= Date.now()),
        latestFailure: items.find(item => item.status === 'failed')?.lastError,
      };
    } catch (error) {
      console.warn('Failed to get sync status from IndexedDB. Connection may be closing.', error);
      return {
        lastSyncTimestamp: Date.now(),
        isOnline: typeof navigator !== 'undefined' ? navigator.onLine : false,
        pendingChanges: 0,
        failedChanges: 0,
        isFlushing: this.isFlushing,
        readyToSync: false,
        latestFailure: undefined,
        statusError: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Strict Serial Flush with Concurrency Lock & Error Handling
   * 
   * Rules:
   * 1. Only one flush can run at a time (isFlushing lock)
   * 2. If an item fails (except 400 Bad Request), STOP processing and keep item queued
   * 3. 400 errors are treated as unrecoverable (delete and skip)
   * 4. Include lastUpdated timestamp with each sync for server-side conflict resolution
   * 5. Update item status to track sync progress
   */
  async syncOutbox(): Promise<void> {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;

    // Prevent parallel flush executions (concurrency lock)
    if (this.isFlushing) {
      console.warn('Sync already in progress, skipping concurrent flush');
      return;
    }

    this.isFlushing = true;
    let db: Awaited<ReturnType<typeof initDB>> | undefined;
    let lockOwner: string | undefined;
    let leaseTimer: ReturnType<typeof setInterval> | undefined;
    try {
      db = await this.getDb();

      lockOwner = crypto.randomUUID();
      const lockTx = db.transaction('syncLocks', 'readwrite');
      const existingLock = await lockTx.store.get('outbox');
      if (existingLock && existingLock.expiresAt > Date.now()) {
        await lockTx.done;
        return;
      }
      await lockTx.store.put({
        name: 'outbox',
        owner: lockOwner,
        expiresAt: Date.now() + 90_000,
      });
      await lockTx.done;

      leaseTimer = setInterval(() => {
        if (db && lockOwner) {
          this.renewLease(db, lockOwner).catch(error =>
            console.error('[SyncService] Failed to renew sync lease:', error),
          );
        }
      }, 30_000);
      
      // 1. Get all pending items
      const items = await db.getAll(SYNC_STORE_NAME);

      // Only retry active items. Failed records remain available for diagnostics
      // but must not keep the global pending indicator or retry forever.
      const pendingItems = items.filter(
        item =>
        item.status !== 'failed' &&
        (item.attempts ?? 0) < MAX_SYNC_ATTEMPTS &&
        (item.nextAttemptAt ?? 0) <= Date.now(),
      );

      // Optimization: Fetch session once at start of flush
      const session = await getSession();
      const sessionToken = session?.user?.accessToken;

      for (const item of pendingItems) {
        try {
          await this.renewLease(db, lockOwner);

          if (!item.url) {
            item.url =
              item.type === 'quiz_submission'
                ? '/api/backend/quizzes/submit?type=full'
                : '/api/backend/progress/sync';
            item.method = 'POST';
            item.body = item.data;
          }

          // Migrate legacy records to the same-origin proxy at send time.
          item.url = this.normalizeUrl(item.url);

          // Prepare headers: STRIP any existing auth headers from previous attempts to ensure clean override
          const cleanHeaders = { ...item.headers };
          delete cleanHeaders['Authorization'];
          delete cleanHeaders['authorization'];

          const storeToken = useAuthStore.getState().user?.accessToken;
          const token = storeToken || sessionToken;

          if (!token) {
            await db.put(SYNC_STORE_NAME, {
              ...item,
              nextAttemptAt: Date.now() + 15_000,
              lastError: 'Waiting for an authenticated session',
            });
            continue;
          }

          const headers = {
            ...cleanHeaders,
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
            'X-Client-Timestamp': String(item.lastUpdated || item.createdAt),
            'Content-Type': 'application/json',
          };

          console.warn(`[SyncService] Attempting to sync item ${item.id} to ${item.url}`, {
             method: item.method,
             hasToken: !!token
          });

          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 30_000);
          let response: Response;
          try {
            response = await fetch(item.url, {
              method: item.method,
              headers,
              body: item.body === undefined ? undefined : JSON.stringify(item.body),
              credentials: 'include',
              cache: 'no-store',
              signal: controller.signal,
            });
          } finally {
            clearTimeout(timeout);
          }

          if (response.ok) {
            // Success: mark as synced and delete
            // Using atomic operations to avoid transaction timeouts
            await db.delete(SYNC_STORE_NAME, item.id);
            console.warn(`✅ Synced item ${item.id} to ${item.url}`);
          } else if (response.status === 401) {
            await db.put(SYNC_STORE_NAME, {
              ...item,
              nextAttemptAt: Date.now() + 15_000,
              lastError: 'Waiting for an authenticated session',
            });
            continue;
          } else if (
            response.status === 403 ||
            response.status === 404 ||
            response.status === 400 ||
            response.status === 422
          ) {
            // 404/400 are treated as unrecoverable errors for the queue.
            // (e.g. endpoint renamed/removed, or data is invalid for current schema)
            console.error(
              `❌ Unrecoverable error ${response.status} for item ${item.id} - skipping to avoid queue blockage`
            );
            await db.put(SYNC_STORE_NAME, {
              ...item,
              status: 'failed',
              lastError: `${response.status} Client Error - Payload or Endpoint invalid`,
              nextAttemptAt: undefined,
            });
          } else {
            // Other errors (5xx, 3xx, etc.): STOP flush and keep item queued
            const errorMsg = `Server error ${response.status}`;
            const attempts = (item.attempts ?? 0) + 1;
            console.error(
              `❌ Failed to sync item ${item.id} (${response.status}). Stopping flush to preserve causal order.`
            );
            await db.put(SYNC_STORE_NAME, {
              ...item,
              status: attempts >= MAX_SYNC_ATTEMPTS ? 'failed' : 'pending',
              lastError: errorMsg,
              attempts,
              nextAttemptAt:
                attempts >= MAX_SYNC_ATTEMPTS
                  ? undefined
                  : Date.now() + Math.min(60_000, 5_000 * 2 ** (attempts - 1)),
            });
            return; // BREAK - stop processing to preserve causal order
          }

        } catch (error) {
          const errorMsg =
            error instanceof Error && error.name === 'AbortError'
              ? 'Request timed out'
              : error instanceof Error
                ? error.message
                : String(error);
          console.error(
            `❌ Network error syncing item ${item.id}: ${errorMsg}. Stopping flush to preserve causal order.`
          );
          
          const attempts = (item.attempts ?? 0) + 1;
          await db.put(SYNC_STORE_NAME, {
            ...item,
            status: attempts >= MAX_SYNC_ATTEMPTS ? 'failed' : 'pending',
            lastError: errorMsg,
            attempts,
            nextAttemptAt:
              attempts >= MAX_SYNC_ATTEMPTS
                ? undefined
                : Date.now() + Math.min(60_000, 5_000 * 2 ** (attempts - 1)),
          });
          
          return; // BREAK - stop processing on network errors
        }

      }

      console.warn('✅ Sync flush completed successfully');
    } finally {
      if (leaseTimer) clearInterval(leaseTimer);
      if (db && lockOwner) {
        try {
          const lock = await db.get('syncLocks', 'outbox');
          if (lock?.owner === lockOwner) await db.delete('syncLocks', 'outbox');
        } catch (error) {
          console.error('[SyncService] Failed to release sync lease:', error);
        }
      }
      // Always release the lock
      this.isFlushing = false;
    }
  }

  private async renewLease(
    db: Awaited<ReturnType<typeof initDB>>,
    owner: string,
  ): Promise<void> {
    const tx = db.transaction('syncLocks', 'readwrite');
    const lock = await tx.store.get('outbox');
    if (lock?.owner !== owner) {
      await tx.done;
      throw new Error('Sync lease was lost');
    }
    await tx.store.put({ ...lock, expiresAt: Date.now() + 90_000 });
    await tx.done;
  }

  // Lightweight progress helpers to support the frontend sync API used by the stores.
  // These are intentionally permissive and return simple shapes so the frontend
  // can call them even when an actual backend sync endpoint is not available.
  async getProgress(userId: string): Promise<Record<string, unknown>[]> {
    try {
      // If there's a backend sync endpoint, prefer calling it when online.
      if (typeof window !== 'undefined' && navigator.onLine) {
        try {
          const storeToken = useAuthStore.getState().user?.accessToken;
          const session = !storeToken ? await getSession() : null;
          const token = storeToken || session?.user?.accessToken;

          const res = await fetch(this.normalizeUrl(`/progress/sync?userId=${encodeURIComponent(userId)}`), {
            headers: {
               ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
               'Content-Type': 'application/json',
            }
          });
          if (res.ok) return (await res.json()) || [];
        } catch {
          // ignore and fall through to local store fallback
        }
      }

      // Fallback: return empty progress list (frontend will initialize local state)
      return [];
    } catch (error) {
      console.error('syncService.getProgress error', error);
      return [];
    }
  }

  async saveProgress(progress: unknown, lastUpdated?: number): Promise<void> {
    try {
      // Queue the save operation in the outbox so it can be synced when online.
      await this.addToOutbox(
        '/progress/sync',
        'POST',
        progress,
        {
          'Content-Type': 'application/json',
        },
        lastUpdated
      );
    } catch (error) {
      console.error('syncService.saveProgress error', error);
    }
  }

  /**
   * Get pending items with errors for UI debugging
   */
  async getFailedItems(): Promise<SyncQueueItem[]> {
    const allItems = await this.getQueueItems();
    return allItems.filter(item => item.status === 'failed');
  }

  /**
   * Manually retry a failed item
   */
  async retryFailedItem(id: string): Promise<void> {
    const db = await this.getDb();
    const item = await db.get(SYNC_STORE_NAME, id);

    if (item) {
      await db.put(SYNC_STORE_NAME, {
        ...item,
        status: 'pending',
        attempts: 0,
        lastError: undefined,
        nextAttemptAt: undefined,
      });
    }
    
    // Trigger a new flush
    await this.syncOutbox();
  }

  async retryAllFailedItems(): Promise<void> {
    const db = await this.getDb();
    const items = await this.getQueueItems();
    const tx = db.transaction(SYNC_STORE_NAME, 'readwrite');
    for (const item of items) {
      if (item.status === 'failed') {
        await tx.store.put({
          ...item,
          status: 'pending',
          attempts: 0,
          lastError: undefined,
          nextAttemptAt: undefined,
        });
      }
    }
    await tx.done;
    await this.syncOutbox();
  }
}

export const syncService = new SyncService();
