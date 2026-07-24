// frontend/src/app/(app)/analytics/page.tsx

'use client';

export const dynamic = 'force-dynamic';

import AnalyticsDashboard from '@/features/analytics/components/analytics-dashboard';

export default function AnalyticsPage() {
  return <AnalyticsDashboard />;
}
