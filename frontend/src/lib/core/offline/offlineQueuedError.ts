export const OFFLINE_QUEUED_CODE = 'OFFLINE_QUEUED';

export class OfflineQueuedError extends Error {
  readonly code = OFFLINE_QUEUED_CODE;
  readonly queued = true as const;
  readonly isRetryable = false;
  readonly errorType = 'network' as const;
  readonly status = 0;
  readonly url?: string;
  readonly method?: string;

  constructor(message = 'Saved on this device. It will sync when you are back online.', details?: { url?: string; method?: string }) {
    super(message);
    this.name = 'OfflineQueuedError';
    this.url = details?.url;
    this.method = details?.method;
  }
}

export function isOfflineQueuedError(error: unknown): error is OfflineQueuedError {
  return Boolean(
    error &&
      typeof error === 'object' &&
      'queued' in error &&
      (error as { queued?: unknown }).queued === true
  );
}
