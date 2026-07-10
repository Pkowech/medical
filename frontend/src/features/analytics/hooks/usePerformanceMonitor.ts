import { useEffect, useRef } from 'react';
import { performanceMonitor } from '@/features/analytics/services/performanceMonitor';

interface PerformanceOptions {
  componentName: string;
  trackRender?: boolean;
  trackProps?: boolean;
  trackState?: boolean;
}

export function usePerformanceMonitor(options: PerformanceOptions) {
  const renderCount = useRef(0);
  const lastRenderTime = useRef(performance.now());

  useEffect(() => {
    if (options.trackRender) {
      const currentTime = performance.now();
      const renderTime = currentTime - lastRenderTime.current;

      performanceMonitor.addMetric(`render_${options.componentName}`, renderTime, {
        renderCount: renderCount.current.toString(),
        timestamp: new Date().toISOString(),
      });

      lastRenderTime.current = currentTime;
      renderCount.current++;
    }
  });

  const measureAsync = async <T>(name: string, fn: () => Promise<T>): Promise<T> => {
    const startTime = performance.now();
    try {
      return await fn();
    } finally {
      const duration = performance.now() - startTime;
      performanceMonitor.addMetric(`async_${options.componentName}_${name}`, duration, {
        component: options.componentName,
        operation: name,
      });
    }
  };

  const measureSync = <T>(name: string, fn: () => T): T => {
    const startTime = performance.now();
    try {
      return fn();
    } finally {
      const duration = performance.now() - startTime;
      performanceMonitor.addMetric(`sync_${options.componentName}_${name}`, duration, {
        component: options.componentName,
        operation: name,
      });
    }
  };

  return {
    measureAsync,
    measureSync,
    renderCount: renderCount.current,
  };
}
