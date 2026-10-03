import { QueryClient } from '@tanstack/react-query';
import {
  getPersistentQueryCacheKey,
  persistPersistentQueryCache,
  restorePersistentQueryCache,
} from './queryCachePersistence';

const CACHE_KEY = getPersistentQueryCacheKey('user-1');

describe('persistent query cache', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('restores opted-in successful queries after reload', () => {
    const sourceClient = new QueryClient();
    sourceClient.setQueryDefaults(['courseModules'], {
      meta: { persist: true },
    });
    sourceClient.setQueryData(['courseModules', 'course-1'], [{ id: 'module-1' }]);
    sourceClient.setQueryData(['privateProgress', 'user-1'], [{ id: 'progress-1' }]);

    persistPersistentQueryCache(sourceClient, CACHE_KEY);

    const restoredClient = new QueryClient();
    restorePersistentQueryCache(restoredClient, CACHE_KEY);

    expect(restoredClient.getQueryData(['courseModules', 'course-1'])).toEqual([
      { id: 'module-1' },
    ]);
    expect(restoredClient.getQueryData(['privateProgress', 'user-1'])).toBeUndefined();
  });

  it('discards expired cache entries', () => {
    window.localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({
        version: 1,
        savedAt: Date.now() - 25 * 60 * 60 * 1000,
        state: { queries: [] },
      })
    );

    restorePersistentQueryCache(new QueryClient(), CACHE_KEY);

    expect(window.localStorage.getItem(CACHE_KEY)).toBeNull();
  });
});
