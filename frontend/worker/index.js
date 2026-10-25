import {
  LAST_SYNC_META_KEY,
  canReachBackend,
  getSyncRetryDelay,
  resolveQueueRequest,
} from '../src/lib/core/offline/offlineQueueShared.js';

const OFFLINE_DB_NAME = 'medical-education-db';
const SYNC_QUEUE_STORE = 'syncQueue';
const PRIVATE_RUNTIME_CACHES = ['medtrack-rsc-v1', 'medtrack-pages-v1'];

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed.'));
  });
}

function transactionComplete(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error('IndexedDB transaction failed.'));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error('IndexedDB transaction was aborted.'));
  });
}

function openOfflineDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(OFFLINE_DB_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error('Could not open the offline sync database.'));
    request.onblocked = () => reject(new Error('The offline sync database is blocked.'));
  });
}

function retryDelay(attempts, retryAfter) {
  return getSyncRetryDelay(attempts, retryAfter);
}

async function acquireSyncLease(db) {
  if (!db.objectStoreNames.contains('syncLocks')) return undefined;
  const transaction = db.transaction('syncLocks', 'readwrite');
  const complete = transactionComplete(transaction);
  const store = transaction.objectStore('syncLocks');
  const lock = await requestResult(store.get('outbox'));
  if (lock && lock.expiresAt > Date.now()) {
    await complete;
    return undefined;
  }
  const owner = crypto.randomUUID();
  store.put({ name: 'outbox', owner, expiresAt: Date.now() + 90_000 });
  await complete;
  return owner;
}

async function releaseSyncLease(db, owner) {
  const transaction = db.transaction('syncLocks', 'readwrite');
  const complete = transactionComplete(transaction);
  const store = transaction.objectStore('syncLocks');
  const lock = await requestResult(store.get('outbox'));
  if (lock?.owner === owner) store.delete('outbox');
  await complete;
}

async function renewSyncLease(db, owner) {
  const transaction = db.transaction('syncLocks', 'readwrite');
  const complete = transactionComplete(transaction);
  const store = transaction.objectStore('syncLocks');
  const lock = await requestResult(store.get('outbox'));
  if (lock?.owner !== owner) {
    await complete;
    throw new Error('Background sync lease was lost.');
  }
  store.put({ ...lock, expiresAt: Date.now() + 90_000 });
  await complete;
}

async function writeQueueItem(db, item) {
  const transaction = db.transaction(SYNC_QUEUE_STORE, 'readwrite');
  const complete = transactionComplete(transaction);
  transaction.objectStore(SYNC_QUEUE_STORE).put(item);
  await complete;
}

async function recordLastSync(db) {
  if (!db.objectStoreNames.contains('syncMeta')) return;
  const transaction = db.transaction('syncMeta', 'readwrite');
  const complete = transactionComplete(transaction);
  transaction.objectStore('syncMeta').put({
    key: LAST_SYNC_META_KEY,
    lastSyncTimestamp: Date.now(),
  });
  await complete;
}

async function removeQueueItem(db, id) {
  const transaction = db.transaction(SYNC_QUEUE_STORE, 'readwrite');
  const complete = transactionComplete(transaction);
  transaction.objectStore(SYNC_QUEUE_STORE).delete(id);
  await complete;
}

async function updatePracticeAttempt(db, item, status, details = {}) {
  if (item.type !== 'offline_practice_submission') return;
  const transaction = db.transaction('offlinePracticeAttempts', 'readwrite');
  const complete = transactionComplete(transaction);
  const store = transaction.objectStore('offlinePracticeAttempts');
  const attempt = await requestResult(store.get(item.id));
  if (attempt) {
    store.put({
      ...attempt,
      ...details,
      status,
      lastUpdated: Date.now(),
    });
  }
  await complete;
}

async function flushOutboxFromWorker(db, owner, onSynced) {
  const transaction = db.transaction(SYNC_QUEUE_STORE, 'readonly');
  const complete = transactionComplete(transaction);
  const items = await requestResult(transaction.objectStore(SYNC_QUEUE_STORE).getAll());
  await complete;
  items.sort(
    (first, second) =>
      first.createdAt - second.createdAt ||
      first.timestamp - second.timestamp ||
      first.id.localeCompare(second.id)
  );

  const dueItems = items.filter(
    item => item.status !== 'failed' && (item.nextAttemptAt ?? 0) <= Date.now()
  );
  let syncedActivity = false;
  for (const item of dueItems) {
    await renewSyncLease(db, owner);
    let target;
    let method;
    try {
      if (!item.url) {
        item.url = '/progress/sync';
        item.method = 'POST';
        item.body = item.data;
      }
      ({ target, method } = resolveQueueRequest(item, self.location.origin));
    } catch (error) {
      item.status = 'failed';
      item.lastError = error instanceof Error ? error.message : String(error);
      item.nextAttemptAt = undefined;
      await writeQueueItem(db, item);
      await updatePracticeAttempt(db, item, 'failed', { lastError: item.lastError });
      continue;
    }

    const headers = new Headers(item.headers ?? {});
    headers.delete('authorization');
    headers.set('X-Client-Timestamp', String(item.lastUpdated || item.createdAt));
    headers.set('Content-Type', 'application/json');

    let response;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    try {
      response = await fetch(target, {
        method,
        headers,
        body: item.body === undefined ? undefined : JSON.stringify(item.body),
        credentials: 'include',
        cache: 'no-store',
        signal: controller.signal,
      });
    } catch (error) {
      const attempts = (item.attempts ?? 0) + 1;
      item.status = 'pending';
      item.attempts = attempts;
      item.lastError =
        error instanceof Error && error.name === 'AbortError'
          ? 'Request timed out'
          : error instanceof Error
            ? error.message
            : String(error);
      item.nextAttemptAt = Date.now() + retryDelay(attempts);
      await writeQueueItem(db, item);
      await updatePracticeAttempt(db, item, 'pending', { lastError: item.lastError });
      throw new Error(`Background sync failed for queued item ${item.id}.`);
    } finally {
      clearTimeout(timeout);
    }

    if (response.ok) {
      if (item.type === 'offline_practice_submission') {
        try {
          const receipt = await response.clone().json();
          if (
            receipt.attemptId !== item.id ||
            typeof receipt.score !== 'number' ||
            receipt.formative !== true
          ) {
            throw new Error('The server returned an invalid practice-attempt receipt.');
          }
          await updatePracticeAttempt(db, item, 'synced', {
            score: receipt.score,
            lastError: undefined,
          });
        } catch (error) {
          const attempts = (item.attempts ?? 0) + 1;
          item.status = 'pending';
          item.attempts = attempts;
          item.lastError = error instanceof Error ? error.message : String(error);
          item.nextAttemptAt = Date.now() + retryDelay(attempts);
          await writeQueueItem(db, item);
          await updatePracticeAttempt(db, item, 'pending', { lastError: item.lastError });
          throw new Error(`Background sync could not confirm practice attempt ${item.id}.`);
        }
      }
      await removeQueueItem(db, item.id);
      await recordLastSync(db);
      syncedActivity = true;
      onSynced();
      continue;
    }

    if (response.status === 409) {
      await removeQueueItem(db, item.id);
      await recordLastSync(db);
      syncedActivity = true;
      onSynced();
      continue;
    }

    if (response.status === 401) {
      item.lastError = 'Waiting for an authenticated session';
      item.nextAttemptAt = Date.now() + 15_000;
      await writeQueueItem(db, item);
      continue;
    }

    const temporary =
      response.status === 408 ||
      response.status === 425 ||
      response.status === 429 ||
      (response.status >= 500 && response.status !== 501);
    if (temporary) {
      const attempts = (item.attempts ?? 0) + 1;
      item.status = 'pending';
      item.attempts = attempts;
      item.lastError = `Server error ${response.status}`;
      item.nextAttemptAt = Date.now() + retryDelay(attempts, response.headers.get('Retry-After'));
      await writeQueueItem(db, item);
      await updatePracticeAttempt(db, item, 'pending', { lastError: item.lastError });
      throw new Error(`Background sync received server error ${response.status}.`);
    }

    item.status = 'failed';
    item.lastError = `${response.status} Client Error - Payload or Endpoint invalid`;
    item.nextAttemptAt = undefined;
    await writeQueueItem(db, item);
    await updatePracticeAttempt(db, item, 'failed', { lastError: item.lastError });
  }

  const remainingTransaction = db.transaction(SYNC_QUEUE_STORE, 'readonly');
  const remainingComplete = transactionComplete(remainingTransaction);
  const remainingItems = await requestResult(
    remainingTransaction.objectStore(SYNC_QUEUE_STORE).getAll()
  );
  await remainingComplete;
  if (remainingItems.some(item => item.status !== 'failed')) {
    throw new Error('Background sync deferred while queued changes await retry.');
  }
  return syncedActivity;
}

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(names =>
      Promise.all(
        names
          .filter(name => PRIVATE_RUNTIME_CACHES.includes(name))
          .map(name => caches.delete(name))
      )
    )
  );
});

self.addEventListener('sync', event => {
  if (event.tag !== 'sync-outbox') return;
  event.waitUntil(
    (async () => {
      const reachable = await canReachBackend(fetch, self.location.origin);
      if (!reachable) return;

      const db = await openOfflineDatabase();
      if (!db.objectStoreNames.contains(SYNC_QUEUE_STORE)) {
        db.close();
        return;
      }

      let owner;
      let syncedActivity = false;
      try {
        owner = await acquireSyncLease(db);
        if (!owner) return;
        await flushOutboxFromWorker(db, owner, () => {
          syncedActivity = true;
        });
      } finally {
        try {
          if (owner) await releaseSyncLease(db, owner);
        } finally {
          db.close();
          if (syncedActivity) {
            const clients = await self.clients.matchAll({
              type: 'window',
              includeUncontrolled: true,
            });
            for (const client of clients) {
              client.postMessage({ type: 'SYNC_OUTBOX_COMPLETE' });
            }
          }
        }
      }
    })()
  );
});

self.addEventListener('push', event => {
  let payload = {};
  try {
    payload = event.data?.json() ?? {};
  } catch {
    payload = { body: event.data?.text() ?? '' };
  }

  const title = typeof payload.title === 'string' ? payload.title : 'MedTrack Hub';
  const body = typeof payload.body === 'string' ? payload.body : 'You have a new notification.';
  const url =
    typeof payload.url === 'string' && payload.url.length <= 512 ? payload.url : '/notifications';

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/android-chrome-192x192.png',
      badge: '/android-chrome-192x192.png',
      data: { url },
      tag: 'medtrack-notification',
      renotify: false,
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();

  let targetUrl = new URL('/notifications', self.location.origin);
  try {
    const requestedUrl = new URL(event.notification.data?.url ?? '/', self.location.origin);
    if (requestedUrl.origin === self.location.origin) targetUrl = requestedUrl;
  } catch {
    targetUrl = new URL('/notifications', self.location.origin);
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async clients => {
      for (const client of clients) {
        if (new URL(client.url).origin === targetUrl.origin && 'focus' in client) {
          await client.navigate(targetUrl.href);
          return client.focus();
        }
      }
      return self.clients.openWindow(targetUrl.href);
    })
  );
});
