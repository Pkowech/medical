'use client';

import { useEffect, useState } from 'react';
import { performanceMonitor } from '@/features/analytics/services/performanceMonitor';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type {
  PageLoadMetric as ImportedPageLoadMetric,
  ApiPerformanceMetric as ImportedApiPerformanceMetric,
  ResourceMetric as ImportedResourceMetric,
} from '@/shared/types/analyticsInterface';

interface MetricData {
  timestamp: number;
  value: number;
  name: string;
}

export function PerformanceDashboard() {
  const [metrics, setMetrics] = useState<MetricData[]>([]);
  const [pageLoadMetrics, setPageLoadMetrics] = useState<ImportedPageLoadMetric[]>([]);
  const [apiMetrics, setApiMetrics] = useState<ImportedApiPerformanceMetric[]>([]);
  const [resourceMetrics, setResourceMetrics] = useState<ImportedResourceMetric[]>([]);

  useEffect(() => {
    const updateMetrics = () => {
      const allMetrics = performanceMonitor.getMetrics();
      const formattedMetrics = allMetrics.map(metric => ({
        timestamp: metric.timestamp,
        value: metric.value,
        name: metric.name,
      }));
      setMetrics(formattedMetrics);

      const pageLoads = performanceMonitor.getPageLoadMetrics();
      setPageLoadMetrics(pageLoads);

      const apis = performanceMonitor.getApiMetrics();
      setApiMetrics(apis);

      const resources = performanceMonitor.getResourceMetrics();
      setResourceMetrics(resources);
    };

    const interval = setInterval(updateMetrics, 5000);
    updateMetrics();

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6">
      {/* Page Load Metrics */}
      <div className="bg-card/80 dark:bg-card/50 backdrop-blur-sm rounded-lg shadow-sm border border-border dark:border-border/50 p-6">
        <h2 className="text-xl font-semibold mb-4 text-foreground dark:text-foreground">Page Load Performance (Web Vitals)</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {pageLoadMetrics[0] ? (
            <>
              <MetricCard
                title="Load Time"
                value={formatMetric(pageLoadMetrics[0].loadTime)}
              />
              <MetricCard
                title="First Contentful Paint"
                value={formatMetric(pageLoadMetrics[0].firstContentfulPaint)}
              />
              <MetricCard
                title="Largest Contentful Paint"
                value={formatMetric(pageLoadMetrics[0].largestContentfulPaint)}
              />
              <MetricCard
                title="Time to Interactive"
                value={formatMetric(pageLoadMetrics[0].timeToInteractive)}
              />
            </>
          ) : (
            <p role="status" className="col-span-full text-sm text-muted-foreground dark:text-muted-foreground">
              Page-load measurements are not available yet. They are recorded after a full page load.
            </p>
          )}
        </div>
      </div>

      {/* API Performance */}
      <div className="bg-card/80 dark:bg-card/50 backdrop-blur-sm rounded-lg shadow-sm border border-border dark:border-border/50 p-6">
        <h2 className="text-xl font-semibold mb-4 text-foreground dark:text-foreground">API Latency & Performance</h2>
        {apiMetrics.length > 0 ? (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={apiMetrics}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="timestamp"
                  tickFormatter={value => new Date(Number(value)).toLocaleTimeString()}
                />
                <YAxis />
                <Tooltip
                  labelFormatter={value => new Date(Number(value)).toLocaleString()}
                />
                <Legend />
                <Line type="monotone" dataKey="duration" stroke="#2563eb" name="Duration (ms)" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground" role="status">
            API request measurements will appear as requests are recorded in this session.
          </p>
        )}
      </div>

      {/* Resource Loading */}
      <div className="bg-card/80 dark:bg-card/50 backdrop-blur-sm rounded-lg shadow-sm border border-border dark:border-border/50 p-6">
        <h2 className="text-xl font-semibold mb-4 text-foreground dark:text-foreground">Resource Loading</h2>
        {resourceMetrics.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-border dark:border-border/50">
                <th className="px-4 py-2 text-left text-foreground dark:text-foreground">Resource</th>
                <th className="px-4 py-2 text-left text-foreground dark:text-foreground">Type</th>
                <th className="px-4 py-2 text-left text-foreground dark:text-foreground">Size (KB)</th>
                <th className="px-4 py-2 text-left text-foreground dark:text-foreground">Load Time (ms)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border dark:divide-border/50">
              {resourceMetrics.map((resource, index) => (
                <tr key={index}>
                  <td className="px-4 py-2 text-muted-foreground dark:text-muted-foreground">{resource.name}</td>
                  <td className="px-4 py-2 text-muted-foreground dark:text-muted-foreground">{resource.type}</td>
                  <td className="px-4 py-2 text-muted-foreground dark:text-muted-foreground">{(resource.size / 1024).toFixed(2)}</td>
                  <td className="px-4 py-2 text-muted-foreground dark:text-muted-foreground">{resource.loadTime.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        ) : (
          <p className="py-4 text-center text-sm text-muted-foreground" role="status">
            No resource measurements have been recorded in this session.
          </p>
        )}
      </div>

      {/* Custom Metrics */}
      <div className="bg-card/80 dark:bg-card/50 backdrop-blur-sm rounded-lg shadow-sm border border-border dark:border-border/50 p-6">
        <h2 className="text-xl font-semibold mb-4 text-foreground dark:text-foreground">Custom Metrics</h2>
        {metrics.length > 0 ? (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={metrics}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="timestamp"
                  tickFormatter={value => new Date(Number(value)).toLocaleTimeString()}
                />
                <YAxis />
                <Tooltip
                  labelFormatter={value => new Date(Number(value)).toLocaleString()}
                />
                <Legend />
                <Line type="monotone" dataKey="value" stroke="#2563eb" name="Value" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground" role="status">
            Custom performance measurements will appear as they are recorded.
          </p>
        )}
      </div>
    </div>
  );
}

function MetricCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="bg-background/50 dark:bg-card/50 rounded-lg p-4 border border-border dark:border-border/50">
      <h3 className="text-sm font-medium text-muted-foreground dark:text-muted-foreground">{title}</h3>
      <p className="text-2xl font-semibold text-foreground dark:text-foreground">{value}</p>
    </div>
  );
}

function formatMetric(value: number): string {
  return Number.isFinite(value) && value > 0 ? `${value.toFixed(2)}ms` : 'Not available';
}
