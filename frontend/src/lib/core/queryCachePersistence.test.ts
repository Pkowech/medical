import { QueryClient } from '@tanstack/react-query';
import { initDB, type PersistedQueryCacheEntry } from './offline/db';
import {
  getPersistentQueryCacheKey,
  persistPersistentQueryCache,
  restorePersistentQueryCache,
} from './queryCachePersistence';

jest.mock('./offline/db', () => ({
  initDB: jest.fn(),
}));

const CACHE_KEY = getPersistentQueryCacheKey('user-1');
const cacheEntries = new Map<string, PersistedQueryCacheEntry>();
const mockDb = {
  get: jest.fn(async (_store: string, key: string) => cacheEntries.get(key)),
  put: jest.fn(async (_store: string, entry: PersistedQueryCacheEntry) => {
    cacheEntries.set(entry.key, entry);
  }),
  delete: jest.fn(async (_store: string, key: string) => {
    cacheEntries.delete(key);
  }),
};

describe('persistent query cache', () => {
  beforeEach(() => {
    window.localStorage.clear();
    cacheEntries.clear();
    jest.mocked(initDB).mockResolvedValue(mockDb as never);
  });

  it('restores opted-in successful queries after reload', async () => {
    const sourceClient = new QueryClient();
    sourceClient.setQueryDefaults(['courseModules'], {
      meta: { persist: true },
    });
    sourceClient.setQueryData(['courseModules', 'course-1'], [{ id: 'module-1' }]);
    sourceClient.setQueryData(['privateProgress', 'user-1'], [{ id: 'progress-1' }]);

    await persistPersistentQueryCache(sourceClient, CACHE_KEY);

    const restoredClient = new QueryClient();
    await restorePersistentQueryCache(restoredClient, CACHE_KEY);

    expect(restoredClient.getQueryData(['courseModules', 'course-1'])).toEqual([
      { id: 'module-1' },
    ]);
    expect(restoredClient.getQueryData(['privateProgress', 'user-1'])).toBeUndefined();
  });

  it('discards expired cache entries', async () => {
    cacheEntries.set(CACHE_KEY, {
      key: CACHE_KEY,
      version: 1,
      savedAt: Date.now() - 25 * 60 * 60 * 1000,
      state: { queries: [] },
    });

    await restorePersistentQueryCache(new QueryClient(), CACHE_KEY);

    expect(cacheEntries.has(CACHE_KEY)).toBe(false);
  });

  it('migrates an existing localStorage cache to IndexedDB', async () => {
    const sourceClient = new QueryClient();
    sourceClient.setQueryDefaults(['courseModules'], { meta: { persist: true } });
    sourceClient.setQueryData(['courseModules', 'course-1'], [{ id: 'module-1' }]);
    await persistPersistentQueryCache(sourceClient, CACHE_KEY);

    const entry = cacheEntries.get(CACHE_KEY);
    cacheEntries.delete(CACHE_KEY);
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(entry));

    const restoredClient = new QueryClient();
    await restorePersistentQueryCache(restoredClient, CACHE_KEY);

    expect(restoredClient.getQueryData(['courseModules', 'course-1'])).toEqual([
      { id: 'module-1' },
    ]);
    expect(cacheEntries.has(CACHE_KEY)).toBe(true);
    expect(window.localStorage.getItem(CACHE_KEY)).toBeNull();
  });

  it('keeps successful cached data when its refetch fails', async () => {
    const sourceClient = new QueryClient();
    sourceClient.setQueryDefaults(['courseModules'], { meta: { persist: true } });
    sourceClient.setQueryData(['courseModules', 'course-1'], [{ id: 'module-1' }]);
    const query = sourceClient.getQueryCache().find({
      queryKey: ['courseModules', 'course-1'],
    });
    query?.setState({
      status: 'error',
      error: new Error('Backend unavailable'),
      fetchFailureCount: 1,
      fetchFailureReason: new Error('Backend unavailable'),
    });

    await persistPersistentQueryCache(sourceClient, CACHE_KEY);

    const restoredClient = new QueryClient();
    await restorePersistentQueryCache(restoredClient, CACHE_KEY);

    expect(restoredClient.getQueryData(['courseModules', 'course-1'])).toEqual([
      { id: 'module-1' },
    ]);
  });
});
