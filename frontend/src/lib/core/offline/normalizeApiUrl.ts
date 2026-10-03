export function normalizeApiUrl(url: string, origin: string): string {
  const parsed = new URL(url, origin);
  const path = parsed.pathname.replace(/^\/api\/backend(?=\/|$)/, '').replace(/^\/v1(?=\/|$)/, '');
  const apiPath = path === '/progress/log' ? '/progress/sync' : path;
  return `/api/backend${apiPath || '/'}${parsed.search}`;
}
