import { Injectable } from '@nestjs/common';

/**
 * Request deduplication service to prevent duplicate concurrent requests.
 *
 * This service maintains a map of in-flight requests keyed by a deduplication key.
 * If the same request is made twice within a time window, it reuses the in-flight
 * promise instead of making duplicate calls.
 *
 * Example usage:
 * - User makes request for profile
 * - Request is sent to Rust service
 * - Before response returns, same user makes identical request
 * - Second request reuses the first promise instead of calling Rust again
 */
@Injectable()
export class RequestDeduplicationService {
  private inFlightRequests: Map<string, Promise<any>> = new Map();
  private requestTimestamps: Map<string, number> = new Map();
  private readonly DEFAULT_DEDUP_WINDOW_MS = 1000; // 1 second

  /**
   * Get or execute a request with deduplication.
   *
   * @param key - Unique key for the request (e.g., "profile:user123")
   * @param executor - Async function that executes the request
   * @param dedupWindowMs - Time window for deduplication (default: 1000ms)
   * @returns The result of the request, either fresh or from in-flight cache
   */
  async executeWithDedup<T>(
    key: string,
    executor: () => Promise<T>,
    dedupWindowMs: number = this.DEFAULT_DEDUP_WINDOW_MS,
  ): Promise<T> {
    const now = Date.now();
    const lastRequestTime = this.requestTimestamps.get(key) ?? 0;

    // Check if we have a recent in-flight request
    if (
      this.inFlightRequests.has(key) &&
      now - lastRequestTime < dedupWindowMs
    ) {
      // Reuse the in-flight request
      return this.inFlightRequests.get(key) as Promise<T>;
    }

    // Create new request promise
    const requestPromise = executor()
      .catch((error) => {
        // Clean up on error
        this.inFlightRequests.delete(key);
        this.requestTimestamps.delete(key);
        throw error;
      })
      .finally(() => {
        // Clean up after request completes
        // But check if dedup window has expired
        if (Date.now() - now > dedupWindowMs) {
          this.inFlightRequests.delete(key);
          this.requestTimestamps.delete(key);
        }
      });

    // Store the request promise
    this.inFlightRequests.set(key, requestPromise);
    this.requestTimestamps.set(key, now);

    return requestPromise;
  }

  /**
   * Invalidate cached request to force a fresh execution on next call
   */
  invalidate(key: string): void {
    this.inFlightRequests.delete(key);
    this.requestTimestamps.delete(key);
  }

  /**
   * Invalidate all cached requests matching a pattern
   *
   * @param pattern - Prefix pattern (e.g., "profile:*" matches "profile:user123")
   */
  invalidatePattern(pattern: string): void {
    const prefix = pattern.replace('*', '');

    for (const key of this.inFlightRequests.keys()) {
      if (key.startsWith(prefix)) {
        this.inFlightRequests.delete(key);
        this.requestTimestamps.delete(key);
      }
    }
  }

  /**
   * Clear all cached requests
   */
  clear(): void {
    this.inFlightRequests.clear();
    this.requestTimestamps.clear();
  }

  /**
   * Get statistics about deduplication cache
   */
  getStats(): {
    activeRequests: number;
    cachedKeys: string[];
  } {
    return {
      activeRequests: this.inFlightRequests.size,
      cachedKeys: Array.from(this.inFlightRequests.keys()),
    };
  }
}
