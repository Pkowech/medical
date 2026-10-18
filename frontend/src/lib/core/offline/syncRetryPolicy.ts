const INITIAL_RETRY_DELAY_MS = 5_000;
const MAX_RETRY_DELAY_MS = 60 * 60 * 1_000;
const MAX_EXPONENTIAL_DELAY_MS = 5 * 60 * 1_000;

export function getSyncRetryDelay(
  attempts: number,
  retryAfter: string | null = null,
  now = Date.now(),
): number {
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
