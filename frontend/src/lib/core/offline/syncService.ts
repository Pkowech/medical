import { useAuthStore } from '@/features/auth/store/useAuthStore';
import { getSession } from 'next-auth/react';
import { initDB, SyncQueueItem } from './db';
import {
  LAST_SYNC_META_KEY,
  canReachBackend,
  getSyncRetryDelay,
  isOfflineQueueableRequest,
  normalizeApiUrl,
} from './offlineQueueShared.js';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

const SYNC_STORE_NAME = 'syncQueue' as const;
const SYNC_META_STORE = 'syncMeta' as const;

function isRetryableFailedItem(item: SyncQueueItem): boolean {
  if (!isOfflineQueueableRequest(item.method, item.url)) return false;

  const statusMatch = item.lastError?.match(/^(\d{3}) Client Error\b/);
  if (!statusMatch) return true;

  const status = Number(statusMatch[1]);
  return status === 408 || status === 425 || status === 429;
}

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
    userId?: string,
    type?: SyncQueueItem['type']
  ): Promise<void> {
    const normalizedUrl = this.normalizeUrl(url);
    if (!isOfflineQueueableRequest(method, normalizedUrl)) {
      throw new Error(
        'This action is not safe to replay automatically. Please perform it again while online.'
      );
    }

    const now = Date.now();
    const db = await this.getDb();
    const studySessionMatch = normalizedUrl.match(/\/study\/session\/([^/]+)\/end(?:\?|$)/);
    const item: SyncQueueItem = {
      id: id || studySessionMatch?.[1] || crypto.randomUUID(),
      type: type || (studySessionMatch ? 'study_session_end' : undefined),
      userId,
      url: normalizedUrl,
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
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      void navigator.serviceWorker.ready
        .then(registration => {
          const regWithSync = registration as ServiceWorkerRegistration & {
            sync?: { register: (tag: string) => Promise<void> };
          };
          return regWithSync.sync?.register('sync-outbox');
        })
        .catch(error => console.error('Background sync registration failed', error));
    }

    // Auto-trigger sync when the browser reports online; syncOutbox probes reachability.
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      this.syncOutbox().catch(err => console.error('Auto-sync failed:', err));
    }
  }

  private async recordLastSync(db: Awaited<ReturnType<typeof initDB>>): Promise<void> {
    await db.put(SYNC_META_STORE, {
      key: LAST_SYNC_META_KEY,
      lastSyncTimestamp: Date.now(),
    });
  }

  private async readLastSyncTimestamp(db: Awaited<ReturnType<typeof initDB>>): Promise<number> {
    const meta = await db.get(SYNC_META_STORE, LAST_SYNC_META_KEY);
    return meta?.lastSyncTimestamp ?? 0;
  }

  async getSyncStatus(): Promise<{
    lastSyncTimestamp: number;
    isOnline: boolean;
    pendingChanges: number;
    failedChanges: number;
    retryableFailedChanges: number;
    isFlushing: boolean;
    readyToSync: boolean;
    latestFailure?: string;
    statusError?: string;
  }> {
    try {
      const db = await this.getDb();
      const items = await db.getAll(SYNC_STORE_NAME);
      const pendingItems = items.filter(item => item.status !== 'failed');
      const failedItems = items.filter(item => item.status === 'failed');
      const failedChanges = failedItems.length;
      const retryableFailedChanges = failedItems.filter(isRetryableFailedItem).length;
      const count = pendingItems.length;
      const browserOnline = typeof navigator !== 'undefined' ? navigator.onLine : false;
      const reachable =
        typeof window !== 'undefined' && browserOnline
          ? await canReachBackend(fetch, window.location.origin)
          : false;
      return {
        lastSyncTimestamp: await this.readLastSyncTimestamp(db),
        isOnline: reachable,
        pendingChanges: count,
        failedChanges,
        retryableFailedChanges,
        isFlushing: this.isFlushing,
        readyToSync: reachable && pendingItems.some(item => (item.nextAttemptAt ?? 0) <= Date.now()),
        latestFailure: items
          .filter(item => item.lastError)
          .sort((a, b) => b.createdAt - a.createdAt)[0]?.lastError,
      };
    } catch (error) {
      console.warn('Failed to get sync status from IndexedDB. Connection may be closing.', error);
      return {
        lastSyncTimestamp: 0,
        isOnline: typeof navigator !== 'undefined' ? navigator.onLine : false,
        pendingChanges: 0,
        failedChanges: 0,
        retryableFailedChanges: 0,
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
  async syncOutbox(forceRetry = false): Promise<void> {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    if (typeof window !== 'undefined') {
      const reachable = await canReachBackend(fetch, window.location.origin);
      if (!reachable) return;
    }

    // Prevent parallel flush executions (concurrency lock)
    if (this.isFlushing) {
      console.warn('Sync already in progress, skipping concurrent flush');
      return;
    }

    this.isFlushing = true;
    let db: Awaited<ReturnType<typeof initDB>> | undefined;
    let lockOwner: string | undefined;
    let leaseTimer: ReturnType<typeof setInterval> | undefined;
    let syncedActivity = false;
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
            console.error('[SyncService] Failed to renew sync lease:', error)
          );
        }
      }, 30_000);

      // 1. Get all pending items
      const items = (await db.getAll(SYNC_STORE_NAME)).sort(
        (first, second) =>
          first.createdAt - second.createdAt ||
          first.timestamp - second.timestamp ||
          first.id.localeCompare(second.id)
      );

      // Permanent client errors stay failed; transient errors remain queued with
      // capped backoff so temporary outages do not strand learning activity.
      const pendingItems = items.filter(
        item => item.status !== 'failed' && (forceRetry || (item.nextAttemptAt ?? 0) <= Date.now())
      );

      // Optimization: Fetch session once at start of flush
      const session = await getSession();
      const sessionToken = session?.user?.accessToken;

      for (const item of pendingItems) {
        if (!isOfflineQueueableRequest(item.method, item.url)) {
          await db.put(SYNC_STORE_NAME, {
            ...item,
            status: 'failed',
            lastError:
              'This action is not safe to replay automatically. Please perform it again while online.',
            nextAttemptAt: undefined,
          });
          continue;
        }

        try {
          await this.renewLease(db, lockOwner);

          if (!item.url) {
            if (item.type === 'quiz_submission') {
              await db.put(SYNC_STORE_NAME, {
                ...item,
                status: 'failed',
                lastError:
                  'High-stakes quiz submissions cannot be replayed offline. Please submit again while online.',
                nextAttemptAt: undefined,
              });
              continue;
            }
            item.url = '/api/backend/progress/sync';
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
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            'X-Client-Timestamp': String(item.lastUpdated || item.createdAt),
            'Content-Type': 'application/json',
          };

          console.warn(`[SyncService] Attempting to sync item ${item.id} to ${item.url}`, {
            method: item.method,
            hasToken: !!token,
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

          if (response.ok || response.status === 409) {
            if (response.ok && item.type === 'offline_practice_submission') {
              const receipt = (await response.clone().json()) as {
                attemptId?: unknown;
                score?: unknown;
                formative?: unknown;
              };
              if (
                receipt.attemptId !== item.id ||
                typeof receipt.score !== 'number' ||
                receipt.formative !== true
              ) {
                throw new Error('The server returned an invalid practice-attempt receipt');
              }
              const attempt = await db.get('offlinePracticeAttempts', item.id);
              if (attempt) {
                await db.put('offlinePracticeAttempts', {
                  ...attempt,
                  status: 'synced',
                  score: receipt.score,
                  lastError: undefined,
                  lastUpdated: Date.now(),
                });
              }
            }
            // Success or server-newer conflict: dequeue and record last success.
            await db.delete(SYNC_STORE_NAME, item.id);
            await this.recordLastSync(db);
            syncedActivity = true;
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
            response.status === 422 ||
            (response.status >= 400 &&
              response.status < 500 &&
              ![408, 425, 429].includes(response.status)) ||
            response.status === 501
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
            await this.updateOfflinePracticeAttempt(
              db,
              item,
              'failed',
              `${response.status} Client Error`
            );
          } else {
            // Transient server errors: keep the item queued and respect Retry-After.
            const errorMsg = `Server error ${response.status}`;
            const attempts = (item.attempts ?? 0) + 1;
            console.error(
              `❌ Failed to sync item ${item.id} (${response.status}). Stopping flush to preserve causal order.`
            );
            await db.put(SYNC_STORE_NAME, {
              ...item,
              status: 'pending',
              lastError: errorMsg,
              attempts,
              nextAttemptAt:
                Date.now() + getSyncRetryDelay(attempts, response.headers.get('Retry-After')),
            });
            await this.updateOfflinePracticeAttempt(db, item, 'pending', errorMsg);
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
            status: 'pending',
            lastError: errorMsg,
            attempts,
            nextAttemptAt: Date.now() + getSyncRetryDelay(attempts),
          });
          await this.updateOfflinePracticeAttempt(db, item, 'pending', errorMsg);

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
      if (syncedActivity && typeof window !== 'undefined') {
        window.dispatchEvent(new Event('learning:offline-sync-complete'));
      }
    }
  }

  async retryQueueItem(id: string): Promise<void> {
    const db = await this.getDb();
    const item = await db.get(SYNC_STORE_NAME, id);
    if (!item || item.status !== 'failed') return;
    await db.put(SYNC_STORE_NAME, {
      ...item,
      status: 'pending',
      attempts: 0,
      lastError: undefined,
      nextAttemptAt: undefined,
    });
    await this.updateOfflinePracticeAttempt(db, item, 'pending');
    await this.syncOutbox();
  }

  private async updateOfflinePracticeAttempt(
    db: Awaited<ReturnType<typeof initDB>>,
    item: SyncQueueItem,
    status: 'pending' | 'failed',
    lastError?: string
  ): Promise<void> {
    if (item.type !== 'offline_practice_submission') return;
    const attempt = await db.get('offlinePracticeAttempts', item.id);
    if (attempt) {
      await db.put('offlinePracticeAttempts', {
        ...attempt,
        status,
        lastError,
        lastUpdated: Date.now(),
      });
    }
  }

  private async renewLease(db: Awaited<ReturnType<typeof initDB>>, owner: string): Promise<void> {
    const tx = db.transaction('syncLocks', 'readwrite');
    const lock = await tx.store.get('outbox');
    if (lock?.owner !== owner) {
      await tx.done;
      throw new Error('Sync lease was lost');
    }
    await tx.store.put({ ...lock, expiresAt: Date.now() + 90_000 });
    await tx.done;
  }

  async retryAllFailedItems(): Promise<void> {
    const db = await this.getDb();
    const items = await this.getQueueItems();
    const tx = db.transaction(SYNC_STORE_NAME, 'readwrite');
    for (const item of items) {
      if (item.status === 'failed' && isRetryableFailedItem(item)) {
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

  async discardAllFailedItems(): Promise<void> {
    const db = await this.getDb();
    const tx = db.transaction(SYNC_STORE_NAME, 'readwrite');
    const items = await tx.store.getAll();
    for (const item of items) {
      if (item.status === 'failed') {
        await tx.store.delete(item.id);
      }
    }
    await tx.done;
  }
}

export const syncService = new SyncService();
