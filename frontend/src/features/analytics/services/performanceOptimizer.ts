import { UserFlashcardProgress } from '../../assessment/services/flashcardApi';

export class PerformanceOptimizer {
  private static readonly BATCH_SIZE = 50;
  private static readonly CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes
  private static readonly MAX_CACHE_SIZE = 1000;

  private static cache: Map<string, { data: unknown; timestamp: number }> = new Map();

  static async batchProcess<T>(items: T[], processFn: (item: T) => Promise<void>): Promise<void> {
    for (let i = 0; i < items.length; i += this.BATCH_SIZE) {
      const batch = items.slice(i, i + this.BATCH_SIZE);
      await Promise.all(batch.map(processFn));
    }
  }

  static setCache(key: string, data: unknown): void {
    this.cleanCache();
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  static getCache<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    if (Date.now() - cached.timestamp > this.CACHE_EXPIRY) {
      this.cache.delete(key);
      return null;
    }

    return cached.data as T;
  }

  static optimizeFlashcards(cards: UserFlashcardProgress[]): UserFlashcardProgress[] {
    // Sort cards by next review date
    return cards.sort((a, b) => {
      const dateA = new Date(a.nextReviewDate);
      const dateB = new Date(b.nextReviewDate);
      return dateA.getTime() - dateB.getTime();
    });
  }

  static debounce<T extends (...args: unknown[]) => unknown>(
    func: T,
    wait: number
  ): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout;

    return (...args: Parameters<T>) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  }

  static throttle<T extends (...args: unknown[]) => unknown>(
    func: T,
    limit: number
  ): (...args: Parameters<T>) => void {
    let inThrottle: boolean;
    let lastFunc: NodeJS.Timeout;
    let lastRan: number;

    return (...args: Parameters<T>) => {
      if (!inThrottle) {
        func(...args);
        lastRan = Date.now();
        inThrottle = true;
      } else {
        clearTimeout(lastFunc);
        lastFunc = setTimeout(
          () => {
            if (Date.now() - lastRan >= limit) {
              func(...args);
              lastRan = Date.now();
            }
          },
          limit - (Date.now() - lastRan)
        );
      }
    };
  }

  static async prefetchData<T>(fetchFn: () => Promise<T>, key: string): Promise<void> {
    try {
      const data = await fetchFn();
      this.setCache(key, data);
    } catch (error) {
      console.error('Prefetch failed:', error);
    }
  }

  private static cleanCache(): void {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > this.CACHE_EXPIRY) {
        this.cache.delete(key);
      }
    }

    if (this.cache.size > this.MAX_CACHE_SIZE) {
      const entries = Array.from(this.cache.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      const toDelete = entries.slice(0, entries.length - this.MAX_CACHE_SIZE);
      toDelete.forEach(([key]) => this.cache.delete(key));
    }
  }
}
