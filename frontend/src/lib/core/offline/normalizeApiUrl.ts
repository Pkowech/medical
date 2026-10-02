export function normalizeApiUrl(url: string, origin: string): string {
  if (/^\/api\/backend(?:\/|$)/.test(url)) return url;

  const parsed = new URL(url, origin);
  const path = parsed.pathname.replace(/^\/v1(?=\/|$)/, '');
  return `/api/backend${path || '/'}${parsed.search}`;
}
