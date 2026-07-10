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
        timestamp: Date.now(),
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

    // Update metrics every second
    const interval = setInterval(updateMetrics, 1000);
    updateMetrics();

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-6 space-y-8 bg-gray-50/50 dark:bg-slate-900/50 min-h-screen">
      <h1 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">Performance Dashboard</h1>

      {/* Page Load Metrics */}
      <div className="bg-white/80 dark:bg-slate-800/50 backdrop-blur-sm rounded-lg shadow-sm border border-gray-100 dark:border-slate-700/50 p-6">
        <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Page Load Performance</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {pageLoadMetrics[0] && (
            <>
              <MetricCard title="Load Time" value={`${pageLoadMetrics[0].loadTime.toFixed(2)}ms`} />
              <MetricCard
                title="First Contentful Paint"
                value={`${pageLoadMetrics[0].firstContentfulPaint.toFixed(2)}ms`}
              />
              <MetricCard
                title="Largest Contentful Paint"
                value={`${pageLoadMetrics[0].largestContentfulPaint.toFixed(2)}ms`}
              />
              <MetricCard
                title="Time to Interactive"
                value={`${pageLoadMetrics[0].timeToInteractive.toFixed(2)}ms`}
              />
            </>
          )}
        </div>
      </div>

      {/* API Performance */}
      <div className="bg-white/80 dark:bg-slate-800/50 backdrop-blur-sm rounded-lg shadow-sm border border-gray-100 dark:border-slate-700/50 p-6">
        <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">API Performance</h2>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={apiMetrics}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="timestamp" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="duration" stroke="#8884d8" name="Duration (ms)" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Resource Loading */}
      <div className="bg-white/80 dark:bg-slate-800/50 backdrop-blur-sm rounded-lg shadow-sm border border-gray-100 dark:border-slate-700/50 p-6">
        <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Resource Loading</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-gray-100 dark:border-slate-700/50">
                <th className="px-4 py-2 text-left text-gray-900 dark:text-white">Resource</th>
                <th className="px-4 py-2 text-left text-gray-900 dark:text-white">Type</th>
                <th className="px-4 py-2 text-left text-gray-900 dark:text-white">Size (KB)</th>
                <th className="px-4 py-2 text-left text-gray-900 dark:text-white">Load Time (ms)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-700/50">
              {resourceMetrics.map((resource, index) => (
                <tr key={index}>
                  <td className="px-4 py-2 text-gray-600 dark:text-slate-300">{resource.name}</td>
                  <td className="px-4 py-2 text-gray-600 dark:text-slate-300">{resource.type}</td>
                  <td className="px-4 py-2 text-gray-600 dark:text-slate-300">{(resource.size / 1024).toFixed(2)}</td>
                  <td className="px-4 py-2 text-gray-600 dark:text-slate-300">{resource.loadTime.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Custom Metrics */}
      <div className="bg-white/80 dark:bg-slate-800/50 backdrop-blur-sm rounded-lg shadow-sm border border-gray-100 dark:border-slate-700/50 p-6">
        <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Custom Metrics</h2>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={metrics}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="timestamp" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="value" stroke="#82ca9d" name="Value" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="bg-gray-50/50 dark:bg-slate-900/50 rounded-lg p-4 border border-gray-100 dark:border-slate-700/50">
      <h3 className="text-sm font-medium text-gray-500 dark:text-slate-400">{title}</h3>
      <p className="text-2xl font-semibold text-gray-900 dark:text-white">{value}</p>
    </div>
  );
}
