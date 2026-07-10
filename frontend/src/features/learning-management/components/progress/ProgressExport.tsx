import React from 'react';
import { ProgressData } from '@/shared/types/progressInterface';
import { AnalyticsMetrics } from '@/shared/types';
import { downloadJson } from '@/features/learning-management/utils/progressUtils';

const ProgressExport = ({ progressData, analytics }: { progressData?: ProgressData | null; analytics?: AnalyticsMetrics | null }) => {
  const handleExport = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      progress: progressData ?? null,
      analytics: analytics ?? null,
    };
    const filename = `progress-dashboard-${new Date().toISOString().slice(0,10)}.json`;
    downloadJson(payload, filename);
  };

  return (
    <div className="mb-4 flex items-center gap-2">
      <button onClick={handleExport} className="inline-flex items-center px-3 py-1 bg-blue-600 text-white rounded-md text-sm">
        Export Dashboard (JSON)
      </button>
    </div>
  );
};

export default ProgressExport;
