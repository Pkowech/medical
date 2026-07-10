import { ApiResponse } from '@/shared/types';
import apiClient from '@/features/auth/services/apiClient';
import type {
  PerformanceMetric,
  PageLoadMetric,
  ApiPerformanceMetric,
  ResourceMetric,
} from '@/shared/types/analyticsInterface';

class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: PerformanceMetric[] = [];
  private pageLoadMetrics: PageLoadMetric[] = [];
  private apiMetrics: ApiPerformanceMetric[] = [];
  private resourceMetrics: ResourceMetric[] = [];
  private readonly MAX_METRICS = 1000;
  private readonly FLUSH_INTERVAL = 60000; // 1 minute

  private constructor() {
    this.setupPerformanceObservers();
    this.setupApiMonitoring();
    this.startPeriodicFlush();
  }

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  private setupPerformanceObservers(): void {
    // Observe page load metrics
    if (typeof window !== 'undefined') {
      window.addEventListener('load', () => {
        this.capturePageLoadMetrics();
      });

      // Observe resource timing
      if ('PerformanceObserver' in window) {
        const resourceObserver = new PerformanceObserver(list => {
          list.getEntries().forEach(entry => {
            this.captureResourceMetric(entry as PerformanceResourceTiming);
          });
        });

        resourceObserver.observe({ entryTypes: ['resource'] });

        // Observe largest contentful paint
        const lcpObserver = new PerformanceObserver(list => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1];
          this.addMetric('largestContentfulPaint', lastEntry.startTime);
        });

        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
      }
    }
  }

  private setupApiMonitoring(): void {
    if (typeof window === 'undefined') return;

    const originalFetch = window.fetch;
    window.fetch = async (...args: Parameters<typeof fetch>): Promise<Response> => {
      const startTime = performance.now();
      const url = typeof args[0] === 'string' 
        ? args[0] 
        : args[0] instanceof Request 
          ? args[0].url 
          : (args[0] as URL).href || String(args[0]);
      try {
        const response = await originalFetch(...args);
        const endTime = performance.now();
        this.captureApiMetric(url, 'fetch', endTime - startTime, response.status);
        return response;
      } catch (error) {
        const endTime = performance.now();
        this.captureApiMetric(url, 'fetch', endTime - startTime, 0);
        throw error;
      }
    };
  }

  private capturePageLoadMetrics(): void {
    if (typeof window === 'undefined') return;
    const navigationEntries = typeof performance.getEntriesByType === 'function'
      ? performance.getEntriesByType('navigation')
      : [];
    const paintEntries = typeof performance.getEntriesByType === 'function'
      ? performance.getEntriesByType('paint')
      : [];
    const lcpEntries = typeof performance.getEntriesByType === 'function'
      ? performance.getEntriesByType('largest-contentful-paint')
      : [];

    const navigation = navigationEntries[0] as PerformanceNavigationTiming | undefined;
    const fcp = (paintEntries || []).find(entry => entry.name === 'first-contentful-paint');
    const lcp = lcpEntries && lcpEntries.length ? lcpEntries[0] : undefined;

    this.pageLoadMetrics.push({
      url: window.location.href,
      loadTime: navigation ? navigation.loadEventEnd - navigation.startTime : 0,
      domContentLoaded: navigation ? navigation.domContentLoadedEventEnd - navigation.startTime : 0,
      firstContentfulPaint: fcp ? fcp.startTime : 0,
      largestContentfulPaint: (lcp as PerformanceEntry)?.startTime ?? 0,
      timeToInteractive: this.calculateTimeToInteractive(),
      timestamp: Date.now(),
    });
  }

  private calculateTimeToInteractive(): number {
    // This is a simplified version. In a real implementation, you'd want to use
    // a more sophisticated algorithm to determine TTI. Guard against missing
    // performance APIs in test environments.
    if (typeof performance.getEntriesByType !== 'function') return 0;
    const navigationEntries = performance.getEntriesByType('navigation');
    const navigation = navigationEntries && navigationEntries.length ? (navigationEntries[0] as PerformanceNavigationTiming) : undefined;
    if (!navigation) return 0;
    return navigation.domInteractive - navigation.startTime;
  }

  private captureResourceMetric(entry: PerformanceResourceTiming): void {
    this.resourceMetrics.push({
      name: entry.name,
      type: this.getResourceType(entry),
      size: entry.transferSize || 0,
      loadTime: entry.duration,
      timestamp: Date.now(),
    });
  }

  private getResourceType(entry: PerformanceResourceTiming): ResourceMetric['type'] {
    const url = entry.name.toLowerCase();
    if (url.endsWith('.js')) return 'script';
    if (url.endsWith('.css')) return 'style';
    if (url.match(/\.(jpg|jpeg|png|gif|webp|svg)$/)) return 'image';
    if (url.match(/\.(woff|woff2|ttf|otf|eot)$/)) return 'font';
    return 'other';
  }

  private captureApiMetric(
    endpoint: string,
    method: string,
    duration: number,
    status: number
  ): void {
    this.apiMetrics.push({
      endpoint,
      method,
      duration,
      status,
      timestamp: Date.now(),
    });
  }

  private startPeriodicFlush(): void {
    if (typeof window === 'undefined') return;

    setInterval(() => {
      this.flushMetrics();
    }, this.FLUSH_INTERVAL);
  }

  private async flushMetrics(): Promise<void> {
    if (
      this.metrics.length === 0 &&
      this.pageLoadMetrics.length === 0 &&
      this.apiMetrics.length === 0 &&
      this.resourceMetrics.length === 0
    ) {
      return;
    }

    try {
      await apiClient.post<ApiResponse<void>>('/analytics/performance', {
        metrics: this.metrics,
        pageLoadMetrics: this.pageLoadMetrics,
        apiMetrics: this.apiMetrics,
        resourceMetrics: this.resourceMetrics,
      });

      // Clear metrics after successful flush
      this.metrics = [];
      this.pageLoadMetrics = [];
      this.apiMetrics = [];
      this.resourceMetrics = [];
    } catch (error) {
      console.error('Failed to flush performance metrics:', error);
    }
  }

  addMetric(name: string, value: number, tags?: Record<string, string>): void {
    this.metrics.push({
      name,
      value,
      timestamp: Date.now(),
      tags,
    });

    if (this.metrics.length >= this.MAX_METRICS) {
      this.flushMetrics();
    }
  }

  getMetrics(): PerformanceMetric[] {
    return [...this.metrics];
  }

  getPageLoadMetrics(): PageLoadMetric[] {
    return [...this.pageLoadMetrics];
  }

  getApiMetrics(): ApiPerformanceMetric[] {
    return [...this.apiMetrics];
  }

  getResourceMetrics(): ResourceMetric[] {
    return [...this.resourceMetrics];
  }
}

export const performanceMonitor = PerformanceMonitor.getInstance();
