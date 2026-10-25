export const LAST_SYNC_META_KEY: 'lastSuccess';

export function isOfflineQueueableRequest(method?: string, url?: string): boolean;

export function normalizeApiUrl(url: string, origin: string): string;

export function resolveQueueRequest(
  item: { url?: string; method?: string },
  origin: string
): { method: string; target: string };

export function getSyncRetryDelay(
  attempts: number,
  retryAfter?: string | null,
  now?: number
): number;

export function canReachBackend(
  fetchImpl: typeof fetch,
  origin: string
): Promise<boolean>;
