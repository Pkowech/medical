const QUEUEABLE_POST_PATHS = new Set([
  '/progress/sync',
  '/progress/log',
  '/progress/statements',
  '/learning/progress',
]);

const OFFLINE_PRACTICE_ATTEMPT_PATH = /^\/quizzes\/topic\/[^/]+\/offline-attempts$/;
const STUDY_SESSION_END_PATH = /^\/study\/session\/[^/]+\/end$/;
const MATERIAL_READ_PATH = /^\/progress\/materials\/[^/]+\/read$/;

const INITIAL_RETRY_DELAY_MS = 5_000;
const MAX_RETRY_DELAY_MS = 60 * 60 * 1_000;
const MAX_EXPONENTIAL_DELAY_MS = 5 * 60 * 1_000;
const CONNECTIVITY_TIMEOUT_MS = 4_000;
const LAST_SYNC_META_KEY = 'lastSuccess';

function pathnameFromUrl(url) {
  const pathname = new URL(url, 'http://localhost').pathname
    .replace(/^\/api\/backend(?=\/|$)/, '')
    .replace(/^\/v1(?=\/|$)/, '');
  return pathname === '/progress/log' ? '/progress/sync' : pathname;
}

function isOfflineQueueableRequest(method, url) {
  const normalizedMethod = method?.toUpperCase();
  if (!normalizedMethod || !url) return false;

  let pathname;
  try {
    pathname = pathnameFromUrl(url);
  } catch {
    return false;
  }

  if (normalizedMethod === 'PUT') {
    return STUDY_SESSION_END_PATH.test(pathname);
  }
  if (normalizedMethod !== 'POST') return false;

  return (
    QUEUEABLE_POST_PATHS.has(pathname) ||
    OFFLINE_PRACTICE_ATTEMPT_PATH.test(pathname) ||
    MATERIAL_READ_PATH.test(pathname)
  );
}

function normalizeApiUrl(url, origin) {
  const parsed = new URL(url, origin);
  const path = pathnameFromUrl(parsed.href);
  return `/api/backend${path || '/'}${parsed.search}`;
}

function resolveQueueRequest(item, origin) {
  const url = item.url || '/progress/sync';
  const method = String(item.method || 'POST').toUpperCase();
  if (!isOfflineQueueableRequest(method, url)) {
    throw new Error(
      'This action is not safe to replay automatically. Please perform it again while online.'
    );
  }
  const normalized = normalizeApiUrl(url, origin);
  const parsed = new URL(normalized, origin);
  return {
    method,
    target: `${parsed.pathname}${parsed.search}`,
  };
}

function getSyncRetryDelay(attempts, retryAfter = null, now = Date.now()) {
  if (retryAfter) {
    const retryAfterSeconds = Number(retryAfter);
    const retryAfterDate = Date.parse(retryAfter);
    const serverDelay = Number.isFinite(retryAfterSeconds)
      ? retryAfterSeconds * 1_000
      : Number.isFinite(retryAfterDate)
        ? retryAfterDate - now
        : Number.NaN;

    if (Number.isFinite(serverDelay)) {
      return Math.min(MAX_RETRY_DELAY_MS, Math.max(1_000, serverDelay));
    }
  }

  const exponent = Math.min(Math.max(Math.floor(attempts) - 1, 0), 10);
  return Math.min(MAX_EXPONENTIAL_DELAY_MS, INITIAL_RETRY_DELAY_MS * 2 ** exponent);
}

async function canReachBackend(fetchImpl, origin) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CONNECTIVITY_TIMEOUT_MS);
  try {
    const response = await fetchImpl(new URL('/api/connectivity', origin).toString(), {
      method: 'GET',
      cache: 'no-store',
      credentials: 'omit',
      signal: controller.signal,
    });
    return response.ok || response.status === 204;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

export {
  LAST_SYNC_META_KEY,
  canReachBackend,
  getSyncRetryDelay,
  isOfflineQueueableRequest,
  normalizeApiUrl,
  resolveQueueRequest,
};
