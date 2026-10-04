const QUEUEABLE_POST_PATHS = new Set([
  '/progress/sync',
  '/progress/log',
  '/progress/statements',
  '/learning/progress',
  '/quizzes/submit',
]);

const OFFLINE_PRACTICE_ATTEMPT_PATH =
  /^\/quizzes\/topic\/[^/]+\/offline-attempts$/;

export function isOfflineQueueableRequest(method?: string, url?: string): boolean {
  if (method?.toUpperCase() !== 'POST' || !url) return false;

  let pathname: string;
  try {
    pathname = new URL(url, 'http://localhost').pathname;
  } catch {
    return false;
  }

  pathname = pathname
    .replace(/^\/api\/backend(?=\/|$)/, '')
    .replace(/^\/v1(?=\/|$)/, '');

  return (
    QUEUEABLE_POST_PATHS.has(pathname) ||
    OFFLINE_PRACTICE_ATTEMPT_PATH.test(pathname) ||
    /^\/progress\/materials\/[^/]+\/read$/.test(pathname)
  );
}
