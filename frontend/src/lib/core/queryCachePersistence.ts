import { dehydrate, hydrate, type DehydratedState, type QueryClient } from '@tanstack/react-query';

const CACHE_VERSION = 1;
const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const CACHE_KEY_PREFIX = 'medtrack-query-cache:v1:';

interface PersistedQueryCache {
  version: number;
  savedAt: number;
  state: DehydratedState;
}

export function getPersistentQueryCacheKey(userId: string): string {
  return `${CACHE_KEY_PREFIX}${encodeURIComponent(userId)}`;
}

export function restorePersistentQueryCache(
  queryClient: QueryClient,
  cacheKey: string,
): void {
  if (typeof window === 'undefined') return;

  try {
    const serialized = window.localStorage.getItem(cacheKey);
    if (!serialized) return;

    const persisted = JSON.parse(serialized) as Partial<PersistedQueryCache>;
    if (
      persisted.version !== CACHE_VERSION ||
      typeof persisted.savedAt !== 'number' ||
      Date.now() - persisted.savedAt > CACHE_MAX_AGE_MS ||
      !persisted.state ||
      !Array.isArray(persisted.state.queries)
    ) {
      window.localStorage.removeItem(cacheKey);
      return;
    }

    hydrate(queryClient, persisted.state);
  } catch (error) {
    console.warn('[QueryCache] Failed to restore cached queries:', error);
  }
}

export function persistPersistentQueryCache(
  queryClient: QueryClient,
  cacheKey: string,
): void {
  if (typeof window === 'undefined') return;

  try {
    const state = dehydrate(queryClient, {
      shouldDehydrateQuery: query =>
        query.meta?.persist === true && query.state.status === 'success',
      shouldDehydrateMutation: () => false,
    });

    if (state.queries.length === 0) {
      window.localStorage.removeItem(cacheKey);
      return;
    }

    const persisted: PersistedQueryCache = {
      version: CACHE_VERSION,
      savedAt: Date.now(),
      state,
    };
    window.localStorage.setItem(cacheKey, JSON.stringify(persisted));
  } catch (error) {
    console.warn('[QueryCache] Failed to persist cached queries:', error);
  }
}
