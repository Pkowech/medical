'use client';

export const dynamic = 'force-dynamic';

import SystemAnalyticsDashboard from '@/features/analytics/components/system-analytics-dashboard';
import React from 'react';

export default function AdminAnalyticsPage() {
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">System Analytics</h1>
      <SystemAnalyticsDashboard />
    </div>
  );
}
