const QUEUEABLE_POST_PATHS = new Set([
  '/progress/sync',
  '/progress/log',
  '/progress/statements',
  '/learning/progress',
  '/quizzes/submit',
]);

const OFFLINE_PRACTICE_ATTEMPT_PATH =
  /^\/quizzes\/topic\/[^/]+\/offline-attempts$/;
const STUDY_SESSION_END_PATH = /^\/study\/session\/[^/]+\/end$/;

export function isOfflineQueueableRequest(method?: string, url?: string): boolean {
  const normalizedMethod = method?.toUpperCase();
  if (!normalizedMethod || !url) return false;

  let pathname: string;
  try {
    pathname = new URL(url, 'http://localhost').pathname;
  } catch {
    return false;
  }

  pathname = pathname
    .replace(/^\/api\/backend(?=\/|$)/, '')
    .replace(/^\/v1(?=\/|$)/, '');

  if (normalizedMethod === 'PUT') {
    return STUDY_SESSION_END_PATH.test(pathname);
  }
  if (normalizedMethod !== 'POST') return false;

  return (
    QUEUEABLE_POST_PATHS.has(pathname) ||
    OFFLINE_PRACTICE_ATTEMPT_PATH.test(pathname) ||
    /^\/progress\/materials\/[^/]+\/read$/.test(pathname)
  );
}
