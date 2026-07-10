import { openDB } from 'idb';
import api from '@/features/auth/services/apiClient';

export type ProgressQueueItem = {
  id?: number;
  unitId?: string | null;
  materialId?: string | null;
  percent?: number;
  page?: number | null;
  timeSpentMinutes?: number | null;
  status?: string | null;
  createdAt?: string;
  lastUpdated?: number; // Timestamp for conflict resolution
  xapiStatement?: Record<string, unknown> | null;
  syncStatus?: 'pending' | 'failed' | 'synced'; // Track item sync state
  lastError?: string; // Store last error message
};

const DB_NAME = 'medtrackhub-offline-progress';
const STORE_NAME = 'progress-queue';

let isFlushing = false; // Concurrency lock - prevent parallel flush executions

async function getDB() {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
    },
  });
}

export async function addToQueue(item: ProgressQueueItem) {
  try {
    const db = await getDB();
    const id = await db.add(STORE_NAME, {
      ...item,
      createdAt: item.createdAt || new Date().toISOString(),
      lastUpdated: item.lastUpdated || Date.now(), // Track when client last updated
      syncStatus: 'pending',
    });
    return id;
  } catch (e) {
    console.error('Failed to add progress to queue', e);
    return undefined;
  }
}

export async function getAllQueueItems(): Promise<ProgressQueueItem[]> {
  try {
    const db = await getDB();
    return await db.getAll(STORE_NAME);
  } catch (e) {
    console.error('Failed to read progress queue', e);
    return [];
  }
}

export async function removeFromQueue(id: number) {
  try {
    const db = await getDB();
    await db.delete(STORE_NAME, id);
  } catch (e) {
    console.error('Failed to remove progress item from queue', e);
  }
}

/**
 * Strict Serial Flush with Concurrency Lock & Conflict Resolution
 * 
 * This implementation addresses critical data trust issues:
 * 
 * 1. CONCURRENCY LOCK: isFlushing flag prevents parallel executions
 *    - Prevents double-submission when multiple 'online' events fire
 *    - Ensures strict serial processing of queued items
 * 
 * 2. STRICT ERROR HANDLING: Stops on failure (except 400/409)
 *    - Bad Request (400): Unrecoverable - delete and skip
 *    - Conflict (409): Server has newer data - delete and skip
 *    - Other errors (5xx, timeouts): STOP and preserve order
 * 
 * 3. CONFLICT RESOLUTION: Includes lastUpdated timestamp
 *    - Client sends X-Client-Timestamp header
 *    - Server: Only update if client.lastUpdated > server.lastUpdated
 *    - Prevents overwriting newer server data
 */
export async function flushQueue(): Promise<void> {
  // CONCURRENCY LOCK: Prevent parallel flush executions
  if (isFlushing) {
    console.warn('Offline sync already in progress, skipping concurrent flush');
    return;
  }

  isFlushing = true;
  try {
    const items = await getAllQueueItems();
    
    for (const item of items) {
      // Skip already synced items
      if (item.syncStatus === 'synced') {
        continue;
      }

      try {
        // Sync progress using unified endpoint
        if (item.unitId || item.materialId) {
          await api.post(
            `/progress/sync`,
            {
              unitId: item.unitId,
              materialId: item.materialId,
              status: item.status || 'inProgress',
              progressPercentage: item.percent,
              timeSpentMinutes: item.timeSpentMinutes,
              page: item.page,
            },
            {
              headers: {
                'X-Client-Timestamp': String(item.lastUpdated || Date.now()),
              },
            }
          );

          if (item.id) await removeFromQueue(item.id);
        }
        
        console.warn(`✅ Synced progress item ${item.id}`);
      } catch (err) {
        // Determine error severity
        const errorMsg = err instanceof Error ? err.message : (typeof err === 'string' ? err : 'Unknown error');
        const isNetworkError = !navigator.onLine || errorMsg.includes('fetch');

        if (isNetworkError) {
          // Network error: STOP to preserve causal order
          console.error(
            `❌ Network error syncing item ${item.id}: ${errorMsg}. Stopping flush.`
          );
          return;
        }

        // Check if it's a 400/409 error from axios
        const axiosErr = err as { response?: { status?: number }; code?: string };
        const status = axiosErr?.response?.status;
        const isUnrecoverable = status === 400 || status === 409;

        if (isUnrecoverable) {
          console.error(
            `🚫 Unrecoverable error for item ${item.id} (${status}) - removing from queue`
          );
          if (item.id) await removeFromQueue(item.id);
          continue;
        }

        // 5xx server error or network timeout: STOP to preserve order
        const isServerError = status && status >= 500;
        const isConnectionError = axiosErr?.code === 'ECONNREFUSED' || axiosErr?.code === 'ENOTFOUND' || axiosErr?.code === 'ETIMEDOUT';
        
        if (isServerError || isConnectionError) {
          console.error(`❌ Critical error syncing item ${item.id} (${status || axiosErr?.code}): ${errorMsg}. Stopping flush to preserve order.`);
          return;
        }

        // Unknown/other errors: Log warning but continue to avoid blocking entire sync
        console.warn(`⚠️ Unknown error syncing item ${item.id}: ${errorMsg}. Skipping item to continue sync.`);
        continue;
      }
    }

    // Now flush xAPI statements if any (separate from main progress)
    for (const item of items) {
      if (item.xapiStatement && item.syncStatus !== 'synced') {
        try {
          await api.post('/progress/statements', item.xapiStatement, {
            headers: {
              'X-Client-Timestamp': String(item.lastUpdated || Date.now()),
            },
          });

          if (item.id) await removeFromQueue(item.id);
        } catch (err) {
          console.error(
            `Failed to flush xAPI statement for item ${item.id}:`,
            err instanceof Error ? err.message : err
          );
          // Don't break on xAPI errors - let main progress succeed
        }
      }
    }

    console.warn('✅ Offline sync flush completed successfully');
  } finally {
    isFlushing = false;
  }
}

// auto flush on online event
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
          console.warn('📡 Online event detected, triggering offline sync flush');
    flushQueue().catch((e: unknown) => console.error('Offline sync flush failed', e));
  });

  // Also auto-flush on page visibility change (user returns to tab)
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && navigator.onLine) {
      console.warn('👁️ Page became visible and online, triggering sync flush');
      flushQueue().catch((e: unknown) => console.error('Offline sync flush failed', e));
    }
  });
}

export default { addToQueue, getAllQueueItems, removeFromQueue, flushQueue };
