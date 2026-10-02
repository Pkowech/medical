// frontend/src/app/(app)/analytics/page.tsx

'use client';

export const dynamic = 'force-dynamic';

import { useSession } from 'next-auth/react';
import AnalyticsDashboard from '@/features/analytics/components/analytics-dashboard';

export default function AnalyticsPage() {
  const { data: session, status } = useSession();
  const userId = session?.user?.id;

  return (
    <div className="w-full">
      {status === 'loading' ? (
        <p className="text-sm text-slate-500">Loading your analytics...</p>
      ) : userId ? (
        <AnalyticsDashboard />
      ) : (
        <p role="alert" className="text-sm text-slate-600 dark:text-slate-400">
          Sign in to view your learning analytics.
        </p>
      )}
    </div>
  );
}
