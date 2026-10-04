const DB_NAME = 'medical-education-db';
const LOCK_NAME = 'outbox';
const MAX_ATTEMPTS = 3;
const QUEUEABLE_POST_PATHS = new Set([
  '/progress/sync',
  '/progress/log',
  '/progress/statements',
  '/learning/progress',
  '/quizzes/submit',
]);
const OFFLINE_PRACTICE_ATTEMPT_PATH =
  /^\/quizzes\/topic\/[^/]+\/offline-attempts$/;
const OBSOLETE_CACHES = new Set([
  'api-data-cache',
  'sync-requests-cache',
  'user-data-cache',
  'offline-cache',
]);

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('sync', event => {
  if (event.tag === 'sync-outbox') {
    event.waitUntil(flushOutbox());
  }
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames =>
      Promise.all(
        cacheNames
          .filter(cacheName => OBSOLETE_CACHES.has(cacheName))
          .map(cacheName => caches.delete(cacheName)),
      ),
    ),
  );
});

function isQueueableRequest(item) {
  if (item.method?.toUpperCase() !== 'POST') return false;

  try {
    const pathname = new URL(item.url, self.location.origin).pathname
      .replace(/^\/api\/backend(?=\/|$)/, '')
      .replace(/^\/v1(?=\/|$)/, '');
    return (
      QUEUEABLE_POST_PATHS.has(pathname) ||
      OFFLINE_PRACTICE_ATTEMPT_PATH.test(pathname) ||
      /^\/progress\/materials\/[^/]+\/read$/.test(pathname)
    );
  } catch {
    return false;
  }
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function markPracticeAttempt(database, id, status, score, lastError) {
  const transaction = database.transaction('offlinePracticeAttempts', 'readwrite');
  const store = transaction.objectStore('offlinePracticeAttempts');
  const attempt = await requestResult(store.get(id));
  if (attempt) {
    store.put({
      ...attempt,
      status,
      ...(score === undefined ? {} : { score }),
      lastError,
      lastUpdated: Date.now(),
    });
  }
  await transactionDone(transaction);
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = resolve;
    transaction.onabort = () => reject(transaction.error);
    transaction.onerror = () => reject(transaction.error);
  });
}

async function flushOutbox() {
  const database = await requestResult(indexedDB.open(DB_NAME));
  const owner = crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const lockTransaction = database.transaction('syncLocks', 'readwrite');
  const locks = lockTransaction.objectStore('syncLocks');
  const lock = await requestResult(locks.get(LOCK_NAME));

  if (lock && lock.expiresAt > Date.now()) {
    await transactionDone(lockTransaction);
    database.close();
    throw new Error('Another client is syncing the outbox');
  }

  locks.put({ name: LOCK_NAME, owner, expiresAt: Date.now() + 90_000 });
  await transactionDone(lockTransaction);

  try {
    const readTransaction = database.transaction('syncQueue', 'readonly');
    const items = await requestResult(readTransaction.objectStore('syncQueue').getAll());
    await transactionDone(readTransaction);

    for (const item of items) {
      if (item.status === 'failed' || item.attempts >= MAX_ATTEMPTS) continue;
      if ((item.nextAttemptAt || 0) > Date.now()) continue;
      if (!isQueueableRequest(item)) {
        await updateItem(database, item.id, {
          ...item,
          status: 'failed',
          lastError: 'This action is not safe to replay automatically. Please perform it again while online.',
          nextAttemptAt: undefined,
        });
        continue;
      }
      await renewLock(database, owner);

      const url = normalizeUrl(item.url, item.type);
      const cleanHeaders = new Headers(item.headers || {});
      cleanHeaders.delete('authorization');
      cleanHeaders.delete('content-length');
      cleanHeaders.set('content-type', 'application/json');
      cleanHeaders.set('x-client-timestamp', String(item.lastUpdated || item.createdAt || Date.now()));
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30_000);

      try {
        const response = await fetch(url, {
          method: item.method || 'POST',
          headers: cleanHeaders,
          body: item.body === undefined && item.data === undefined
            ? undefined
            : JSON.stringify(item.body ?? item.data),
          credentials: 'same-origin',
          cache: 'no-store',
          signal: controller.signal,
        });

        if (response.ok) {
          if (item.type === 'offline_practice_submission') {
            let receipt;
            try {
              receipt = await response.clone().json();
            } catch {
              await markPracticeAttempt(database, item.id, 'failed', undefined, 'Invalid server receipt');
              await updateItem(database, item.id, {
                ...item,
                status: 'failed',
                lastError: 'The server returned an invalid practice-attempt receipt.',
                nextAttemptAt: undefined,
              });
              continue;
            }
            if (
              receipt?.attemptId !== item.id ||
              typeof receipt.score !== 'number' ||
              receipt.formative !== true
            ) {
              await markPracticeAttempt(database, item.id, 'failed', undefined, 'Invalid server receipt');
              await updateItem(database, item.id, {
                ...item,
                status: 'failed',
                lastError: 'The server returned an invalid practice-attempt receipt.',
                nextAttemptAt: undefined,
              });
              continue;
            }
            await markPracticeAttempt(database, item.id, 'synced', receipt.score);
          }
          await updateItem(database, item.id, undefined);
          continue;
        }

        if ([400, 403, 404, 422].includes(response.status)) {
          await markPracticeAttempt(database, item.id, 'failed', undefined, `Client error ${response.status}`);
          await updateItem(database, item.id, {
            ...item,
            status: 'failed',
            lastError: `Client error ${response.status}`,
            nextAttemptAt: undefined,
          });
          continue;
        }

        if (response.status === 401) {
          await updateItem(database, item.id, {
            ...item,
            nextAttemptAt: Date.now() + 15_000,
            lastError: 'Waiting for an authenticated session',
          });
          continue;
        }

        await recordRetry(database, item, `Server error ${response.status}`);
        throw new Error(`Outbox request failed (${response.status})`);
      } catch (error) {
          if (error instanceof TypeError || error?.name === 'AbortError') {
          await recordRetry(database, item, error.message || 'Request timed out');
        }
        throw error;
      } finally {
        clearTimeout(timeout);
      }
    }
  } finally {
    const releaseTransaction = database.transaction('syncLocks', 'readwrite');
    const releaseStore = releaseTransaction.objectStore('syncLocks');
    const currentLock = await requestResult(releaseStore.get(LOCK_NAME));
    if (currentLock?.owner === owner) releaseStore.delete(LOCK_NAME);
    await transactionDone(releaseTransaction);
    database.close();
  }
}

async function renewLock(database, owner) {
  const transaction = database.transaction('syncLocks', 'readwrite');
  const store = transaction.objectStore('syncLocks');
  const lock = await requestResult(store.get(LOCK_NAME));
  if (lock?.owner !== owner) {
    await transactionDone(transaction);
    throw new Error('Background sync lease was lost');
  }
  store.put({ ...lock, expiresAt: Date.now() + 90_000 });
  await transactionDone(transaction);
}

function normalizeUrl(url, type) {
  if (!url) {
    return type === 'quiz_submission'
      ? '/api/backend/quizzes/submit?type=full'
      : '/api/backend/progress/sync';
  }

  const parsed = new URL(url, self.location.origin);
  const path = parsed.pathname
    .replace(/^\/api\/backend(?=\/|$)/, '')
    .replace(/^\/v1(?=\/|$)/, '');
  const apiPath = path === '/progress/log' ? '/progress/sync' : path;
  return `/api/backend${apiPath || '/'}${parsed.search}`;
}

async function updateItem(database, id, value) {
  const transaction = database.transaction('syncQueue', 'readwrite');
  const store = transaction.objectStore('syncQueue');
  if (value) store.put(value);
  else store.delete(id);
  await transactionDone(transaction);
}

async function recordRetry(database, item, errorMessage) {
  const attempts = (item.attempts || 0) + 1;
  const status = attempts >= MAX_ATTEMPTS ? 'failed' : 'pending';
  await updateItem(database, item.id, {
    ...item,
    status,
    attempts,
    lastError: errorMessage,
    nextAttemptAt:
      attempts >= MAX_ATTEMPTS
        ? undefined
        : Date.now() + Math.min(60_000, 5_000 * 2 ** (attempts - 1)),
  });
}
