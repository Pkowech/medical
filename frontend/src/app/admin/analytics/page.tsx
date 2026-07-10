'use client';

import AnalyticsDashboard from '@/features/analytics/components/analytics-dashboard';
import React from 'react';

export default function AdminAnalyticsPage() {
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Admin Dashboard</h1>
      <AnalyticsDashboard />
    </div>
  );
}
