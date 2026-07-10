'use client';

import MedicalEducationDashboard from '@/core/app/components/dashboard/medical-education-dashboard';
import { LoadingSpinner } from '@/shared/components/ui/loading-spinner';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Session } from 'next-auth';

// Define a custom session type that includes the 'error' property
interface CustomSession extends Session {
  error?: string;
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    const customSession = session as CustomSession;
    if (customSession?.error === 'TokenExpiredError') {
      console.warn('Dashboard: Token expired, redirecting to marketing page');
      router.replace('/');
    } else if (status === 'unauthenticated') {
      console.warn('Dashboard: User unauthenticated, redirecting to marketing page');
      router.replace('/');
    }
  }, [session, status, router]);

  if (status === 'loading' || !session) {
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
