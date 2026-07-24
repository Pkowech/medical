import { openDB, IDBPDatabase } from 'idb';
import { useAuthStore } from '@/features/auth/store/useAuthStore';
import { getSession } from 'next-auth/react';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface OutboxItem {
  id?: number; // IndexedDB will auto-increment this
  url: string;
  method: HttpMethod;
  headers?: Record<string, string>;
  body?: unknown;
  createdAt: number;
  lastUpdated?: number; // Timestamp for conflict resolution (client-side)
  attempts: number;
  status?: 'pending' | 'failed' | 'synced'; // Track state of each item
  lastError?: string; // Store last error message
}

const DB_NAME = 'medical-education-db';
const DB_VERSION = 2; // Bumped version for schema migration
const SYNC_STORE_NAME = 'syncQueue';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || '';
const API_BASE_URL = `${BACKEND_URL}/v1`;

class SyncService {
  private db: IDBPDatabase | null = null;
  private isFlushing = false; // Concurrency lock to prevent parallel flushes

  private async getDb(): Promise<IDBPDatabase> {
    if (!this.db) {
      this.db = await openDB(DB_NAME, DB_VERSION, {
        upgrade(db) {
          if (!db.objectStoreNames.contains(SYNC_STORE_NAME)) {
            db.createObjectStore(SYNC_STORE_NAME, { keyPath: 'id', autoIncrement: true });
          }
        },
      });
    }
    return this.db;
  }

  async addToOutbox(
    url: string,
    method: HttpMethod,
    body?: unknown,
    headers?: Record<string, string>,
    lastUpdated?: number
  ): Promise<void> {
    // Ensure URL is relative to API base if it starts with /
    const fullUrl = url.startsWith('/') ? `${API_BASE_URL}${url}` : url;
    
    const db = await this.getDb();
    await db.add(SYNC_STORE_NAME, {
      url: fullUrl,
      method,
      headers,
      body,
      createdAt: Date.now(),
      lastUpdated: lastUpdated || Date.now(), // Store timestamp for conflict resolution
      attempts: 0,
      status: 'pending',
    });
    // Request a background sync
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
      try {
        const registration = await navigator.serviceWorker.ready;
        // `sync` is not present on all TS DOM lib versions; use a safe check and cast.
        const regAny = registration as ServiceWorkerRegistration & { sync?: { register: (tag: string) => Promise<void> } };
        if (regAny && regAny.sync && typeof regAny.sync.register === 'function') {
          await regAny.sync.register('sync-outbox');
        } else {
          console.warn('Background Sync not supported in this browser.');
        }
      } catch (error) {
        console.error('Background sync registration failed', error);
      }
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
    isFlushing: boolean;
  }> {
    try {
      const db = await this.getDb();
      const count = await db.count(SYNC_STORE_NAME);
      return {
        lastSyncTimestamp: Date.now(), // This should ideally come from actual last sync, but for now, current time
        isOnline: typeof navigator !== 'undefined' ? navigator.onLine : false,
        pendingChanges: count,
        isFlushing: this.isFlushing, // Expose flush lock status
      };
    } catch (error) {
      console.warn('Failed to get sync status from IndexedDB. Connection may be closing.', error);
      this.db = null; // Reset db connection so it reopens next time
      return {
        lastSyncTimestamp: Date.now(),
        isOnline: typeof navigator !== 'undefined' ? navigator.onLine : false,
        pendingChanges: 0,
        isFlushing: this.isFlushing,
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
    // Prevent parallel flush executions (concurrency lock)
    if (this.isFlushing) {
      console.warn('Sync already in progress, skipping concurrent flush');
      return;
    }

    this.isFlushing = true;
    try {
      const db = await this.getDb();
      
      // 1. Get all pending items
      const items = await db.getAll(SYNC_STORE_NAME);

      // Filter to pending or failed items (retry mechanism)
      const pendingItems = items.filter(item => item.status !== 'synced');

      // Optimization: Fetch session once at start of flush
      const session = await getSession();
      const sessionToken = session?.user?.accessToken;

      for (const item of pendingItems) {
        try {
          // --- ARCHITECTURAL MIGRATION FIX: Sanitization ---
          // 1. Correct redundant path naming (/sync/progress -> /sync)
          if (item.url.includes('/sync/progress')) {
            item.url = item.url.replace('/sync/progress', '/sync');
          }
          if (item.url.includes('/v1/quiz/')) {
            item.url = item.url.replace('/v1/quiz/', '/v1/quizzes/');
          }
          // 2. Correct environment port mismatches (don't hit frontend port for API)
          // Replace any frontend URL references with the API backend URL
          if (item.url.includes('localhost:3000/v1') || item.url.includes('127.0.0.1:3000/v1')) {
            const apiUrl = BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || '';
            if (apiUrl) {
              item.url = item.url.replace(/https?:\/\/(localhost|127\.0\.0\.1):3000\/v1/, `${apiUrl}/v1`);
            }
          }
          // 3. Ensure API_BASE_URL prefix if relative (v1 fallback)
          if (!item.url.startsWith('http')) {
             const cleanPath = item.url.startsWith('/') ? item.url : `/${item.url}`;
             if (API_BASE_URL) {
               item.url = `${API_BASE_URL}${cleanPath}`;
             }
          }

          // Prepare headers: STRIP any existing auth headers from previous attempts to ensure clean override
          const cleanHeaders = { ...item.headers };
          delete cleanHeaders['Authorization'];
          delete cleanHeaders['authorization'];

          const storeToken = useAuthStore.getState().user?.accessToken;
          const token = storeToken || sessionToken;

          if (!token) {
            console.warn(`[SyncService] No token available for item ${item.id}. Sync might fail with 401.`);
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

          const response = await fetch(item.url, {
            method: item.method,
            headers,
            body: item.body ? JSON.stringify(item.body) : undefined,
            credentials: 'include', // Ensure cookies are included if needed
          });

          if (response.ok) {
            // Success: mark as synced and delete
            // Using atomic operations to avoid transaction timeouts
            await db.put(SYNC_STORE_NAME, { ...item, status: 'synced' });
            await db.delete(SYNC_STORE_NAME, item.id!);
            console.warn(`✅ Synced item ${item.id} to ${item.url}`);
          } else if (response.status === 404 || response.status === 400) {
            // 404/400 are treated as unrecoverable errors for the queue.
            // (e.g. endpoint renamed/removed, or data is invalid for current schema)
            console.error(
              `❌ Unrecoverable error ${response.status} for item ${item.id} - skipping to avoid queue blockage`
            );
            await db.put(SYNC_STORE_NAME, {
              ...item,
              status: 'failed',
              lastError: `${response.status} Client Error - Payload or Endpoint invalid`,
            });
            await db.delete(SYNC_STORE_NAME, item.id!);
          } else {
            // Other errors (5xx, 3xx, etc.): STOP flush and keep item queued
            const errorMsg = `Server error ${response.status}`;
            console.error(
              `❌ Failed to sync item ${item.id} (${response.status}). Stopping flush to preserve causal order.`
            );
            await db.put(SYNC_STORE_NAME, {
              ...item,
              status: 'failed',
              lastError: errorMsg,
              attempts: item.attempts + 1,
            });
            return; // BREAK - stop processing to preserve causal order
          }

        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          console.error(
            `❌ Network error syncing item ${item.id}: ${errorMsg}. Stopping flush to preserve causal order.`
          );
          
          await db.put(SYNC_STORE_NAME, {
            ...item,
            status: 'failed',
            lastError: errorMsg,
            attempts: item.attempts + 1,
          });
          
          return; // BREAK - stop processing on network errors
        }
      }

      console.warn('✅ Sync flush completed successfully');
    } finally {
      // Always release the lock
      this.isFlushing = false;
    }
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

          const res = await fetch(`${API_BASE_URL}/progress/sync?userId=${encodeURIComponent(userId)}`, {
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
  async getFailedItems(): Promise<OutboxItem[]> {
    const db = await this.getDb();
    const allItems = await db.getAll(SYNC_STORE_NAME);
    return allItems.filter(item => item.status === 'failed');
  }

  /**
   * Manually retry a failed item
   */
  async retryFailedItem(id: number): Promise<void> {
    const db = await this.getDb();
    const tx = db.transaction(SYNC_STORE_NAME, 'readwrite');
    const store = tx.objectStore(SYNC_STORE_NAME);
    const item = await store.get(id);

    if (item) {
      store.put({ ...item, status: 'pending', attempts: 0 });
    }
    await tx.done;
    
    // Trigger a new flush
    await this.syncOutbox();
  }
}

export const syncService = new SyncService();
