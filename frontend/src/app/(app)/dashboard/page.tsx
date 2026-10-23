'use client';

import MedicalEducationDashboard from '@/core/app/components/dashboard/medical-education-dashboard';
import { LoadingSpinner } from '@/shared/components/ui/loading-spinner';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Session } from 'next-auth';
import { useAuthStore } from '@/features/auth/store/useAuthStore';
import { offlineService } from '@/lib/core/offline/offlineService';

// Define a custom session type that includes the 'error' property
interface CustomSession extends Session {
  error?: string;
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const storeUser = useAuthStore(state => state.user);
  const isOffline = typeof window !== 'undefined' && !navigator.onLine;
  const activeOfflineUserId = typeof window !== 'undefined' ? offlineService.getActiveOfflineUserId() : undefined;
  const hasIdentity = Boolean(session?.user || storeUser || activeOfflineUserId);

  useEffect(() => {
    if (status === 'loading') return;
    const customSession = session as CustomSession;
    if (customSession?.error === 'TokenExpiredError') {
      console.warn('Dashboard: Token expired, redirecting to sign-in');
      router.replace('/login?callbackUrl=%2Fdashboard');
    } else if (status === 'unauthenticated' && !isOffline && !storeUser) {
      console.warn('Dashboard: User unauthenticated, redirecting to sign-in');
      router.replace('/login?callbackUrl=%2Fdashboard');
    }
  }, [session, status, router, isOffline, storeUser]);

  if ((status === 'loading' && !hasIdentity) || (!session && !hasIdentity)) {
    return <LoadingSpinner fullScreen />;
  }

  // The main dashboard page now only renders the Medical Education dashboard.
  // Admin/Moderator-specific dashboards are handled under the `/admin` area
  // (sidebar routes) so we remove them from this page to avoid duplication.
  return (
    <div className="p-0">
      <MedicalEducationDashboard />
    </div>
  );
}
