import { openDB } from 'idb';
import {
  syncService,
} from '@/lib/core/offline/syncService';
import type { SyncQueueItem } from '@/lib/core/offline/db';

export type ProgressQueueItem = {
  id?: number | string;
  unitId?: string | null;
  topicId?: string | null;
  courseId?: string | null;
  materialId?: string | null;
  percent?: number;
  page?: number | null;
  timeSpentMinutes?: number | null;
  status?: string | null;
  createdAt?: string;
  lastUpdated?: number;
  xapiStatement?: Record<string, unknown> | null;
  syncStatus?: 'pending' | 'failed' | 'synced';
  lastError?: string;
  attempts?: number;
};

interface LegacyProgressDatabase {
  'progress-queue': {
    key: number;
    value: ProgressQueueItem;
  };
}

const LEGACY_DB_NAME = 'medtrackhub-offline-progress';
const LEGACY_STORE_NAME = 'progress-queue';

let migrationPromise: Promise<void> | null = null;

async function migrateLegacyQueue(): Promise<void> {
  if (typeof indexedDB === 'undefined') return;

  if (!(await legacyDatabaseExists())) return;

  const legacyDb = await openDB<LegacyProgressDatabase>(LEGACY_DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(LEGACY_STORE_NAME)) {
        db.createObjectStore(LEGACY_STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    },
  });

  try {
    const legacyItems = await legacyDb.getAll(LEGACY_STORE_NAME);
    for (let index = 0; index < legacyItems.length; index += 1) {
      const legacyItem = legacyItems[index];
      const id = legacyItem.id ?? index;
      const parsedCreatedAt = legacyItem.createdAt
        ? new Date(legacyItem.createdAt).getTime()
        : Number.NaN;
      const createdAt = Number.isFinite(parsedCreatedAt) ? parsedCreatedAt : Date.now();
      const common = {
        createdAt,
        timestamp: createdAt,
        lastUpdated: legacyItem.lastUpdated ?? createdAt,
        attempts: legacyItem.attempts ?? 0,
        status: legacyItem.syncStatus === 'failed' ? 'failed' as const : 'pending' as const,
        lastError: legacyItem.lastError,
      };

      if (legacyItem.syncStatus !== 'synced' && (legacyItem.unitId || legacyItem.topicId || legacyItem.materialId)) {
        const progressItem: SyncQueueItem = {
          ...common,
          id: `legacy-progress-${id}`,
          url: '/api/backend/progress/sync',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: {
            unitId: legacyItem.unitId,
            topicId: legacyItem.topicId,
            courseId: legacyItem.courseId,
            materialId: legacyItem.materialId,
            status: legacyItem.status || 'inProgress',
            progressPercentage: legacyItem.percent,
            timeSpentMinutes: legacyItem.timeSpentMinutes,
            page: legacyItem.page,
          },
        };
        await syncService.importQueueItem(progressItem);
      }

      if (legacyItem.syncStatus !== 'synced' && legacyItem.xapiStatement) {
        const statementItem: SyncQueueItem = {
          ...common,
          id: `legacy-progress-${id}-xapi`,
          url: '/api/backend/progress/statements',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: legacyItem.xapiStatement,
        };
        await syncService.importQueueItem(statementItem);
      }

    }

    const tx = legacyDb.transaction(LEGACY_STORE_NAME, 'readwrite');
    await tx.store.clear();
    await tx.done;
  } finally {
    legacyDb.close();
  }
}

async function legacyDatabaseExists(): Promise<boolean> {
  if (typeof indexedDB.databases === 'function') {
    const databases = await indexedDB.databases();
    return databases.some(database => database.name === LEGACY_DB_NAME);
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(LEGACY_DB_NAME);
    let missing = false;
    request.onupgradeneeded = event => {
      if (event.oldVersion === 0) {
        missing = true;
        request.transaction?.abort();
      }
    };
    request.onsuccess = () => {
      request.result.close();
      resolve(!missing);
    };
    request.onerror = () => {
      if (missing && request.error?.name === 'AbortError') {
        resolve(false);
      } else {
        reject(request.error ?? new Error('Unable to inspect legacy offline database'));
      }
    };
  });
}

function ensureMigration(): Promise<void> {
  migrationPromise ??= migrateLegacyQueue().catch(error => {
    migrationPromise = null;
    console.error('[OfflineProgressSync] Legacy queue migration failed:', error);
    throw error;
  });
  return migrationPromise;
}

export function initializeOfflineQueue(): Promise<void> {
  return ensureMigration();
}

export async function addToQueue(item: ProgressQueueItem): Promise<void> {
  await ensureMigration();
  const createdAt = item.createdAt ? new Date(item.createdAt).getTime() : Date.now();
  const commonHeaders = { 'Content-Type': 'application/json' };

  if (item.unitId || item.topicId || item.materialId) {
    await syncService.addToOutbox(
      '/progress/sync',
      'POST',
      {
        unitId: item.unitId,
        topicId: item.topicId,
        courseId: item.courseId,
        materialId: item.materialId,
        status: item.status || 'inProgress',
        progressPercentage: item.percent,
        timeSpentMinutes: item.timeSpentMinutes,
        page: item.page,
      },
      commonHeaders,
      item.lastUpdated ?? createdAt,
    );
  }

  if (item.xapiStatement) {
    await syncService.addToOutbox(
      '/progress/statements',
      'POST',
      item.xapiStatement,
      commonHeaders,
      item.lastUpdated ?? createdAt,
    );
  }
}

export async function getAllQueueItems(): Promise<ProgressQueueItem[]> {
  await ensureMigration();
  const items = await syncService.getQueueItems();
  return items
    .filter(item => item.url.includes('/progress/sync'))
    .map(item => {
      const body = item.body as Record<string, unknown> | undefined;
      return {
        id: item.id,
        unitId: typeof body?.unitId === 'string' ? body.unitId : undefined,
        topicId: typeof body?.topicId === 'string' ? body.topicId : undefined,
        courseId: typeof body?.courseId === 'string' ? body.courseId : undefined,
        materialId: typeof body?.materialId === 'string' ? body.materialId : undefined,
        percent: typeof body?.progressPercentage === 'number' ? body.progressPercentage : undefined,
        page: typeof body?.page === 'number' ? body.page : undefined,
        timeSpentMinutes:
          typeof body?.timeSpentMinutes === 'number' ? body.timeSpentMinutes : undefined,
        status: typeof body?.status === 'string' ? body.status : undefined,
        lastUpdated: item.lastUpdated,
        syncStatus: item.status,
        lastError: item.lastError,
      };
    });
}

export async function removeFromQueue(id: number | string): Promise<void> {
  await ensureMigration();
  const queueId = typeof id === 'number' ? `legacy-progress-${id}` : id;
  await syncService.removeQueueItem(queueId);
}

export async function flushQueue(): Promise<void> {
  await ensureMigration();
  await syncService.syncOutbox();
}

export default { addToQueue, getAllQueueItems, removeFromQueue, flushQueue };
