import { dehydrate, hydrate, type DehydratedState, type QueryClient } from '@tanstack/react-query';
import { initDB, type PersistedQueryCacheEntry } from './offline/db';

const CACHE_VERSION = 1;
const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const CACHE_KEY_PREFIX = 'medtrack-query-cache:v1:';

export function getPersistentQueryCacheKey(userId: string): string {
  return `${CACHE_KEY_PREFIX}${encodeURIComponent(userId)}`;
}

function isValidPersistedCache(
  value: unknown,
): value is PersistedQueryCacheEntry & { state: DehydratedState } {
  if (!value || typeof value !== 'object') return false;

  const persisted = value as Partial<PersistedQueryCacheEntry>;
  return (
    persisted.version === CACHE_VERSION &&
    typeof persisted.savedAt === 'number' &&
    Date.now() - persisted.savedAt <= CACHE_MAX_AGE_MS &&
    !!persisted.state &&
    typeof persisted.state === 'object' &&
    Array.isArray((persisted.state as DehydratedState).queries)
  );
}

export async function restorePersistentQueryCache(
  queryClient: QueryClient,
  cacheKey: string,
  signal?: AbortSignal,
): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    const db = await initDB();
    if (signal?.aborted) return;

    let persisted = await db.get('queryCache', cacheKey);
    if (signal?.aborted) return;

    if (!persisted) {
      const legacySerialized = window.localStorage.getItem(cacheKey);
      if (legacySerialized) {
        try {
          const legacyEntry: unknown = JSON.parse(legacySerialized);
          if (isValidPersistedCache(legacyEntry)) {
            persisted = { ...legacyEntry, key: cacheKey };
            await db.put('queryCache', persisted);
            window.localStorage.removeItem(cacheKey);
          } else {
            window.localStorage.removeItem(cacheKey);
          }
        } catch (error) {
          window.localStorage.removeItem(cacheKey);
          console.warn('[QueryCache] Failed to migrate legacy cached queries:', error);
        }
      }
    }

    if (!persisted) return;
    if (!isValidPersistedCache(persisted)) {
      await db.delete('queryCache', cacheKey);
      return;
    }

    if (signal?.aborted) return;
    hydrate(queryClient, persisted.state);
  } catch (error) {
    console.warn('[QueryCache] Failed to restore cached queries:', error);
  }
}

export async function persistPersistentQueryCache(
  queryClient: QueryClient,
  cacheKey: string,
): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    const state = dehydrate(queryClient, {
      shouldDehydrateQuery: query =>
        query.meta?.persist === true &&
        query.state.data !== undefined &&
        Date.now() - query.state.dataUpdatedAt <= CACHE_MAX_AGE_MS,
      shouldDehydrateMutation: () => false,
    });

    const db = await initDB();
    if (state.queries.length === 0) {
      await db.delete('queryCache', cacheKey);
      window.localStorage.removeItem(cacheKey);
      return;
    }

    const persisted: PersistedQueryCacheEntry = {
      key: cacheKey,
      version: CACHE_VERSION,
      savedAt: Date.now(),
      state,
    };
    await db.put('queryCache', persisted);
    window.localStorage.removeItem(cacheKey);
  } catch (error) {
    console.warn('[QueryCache] Failed to persist cached queries:', error);
  }
}
