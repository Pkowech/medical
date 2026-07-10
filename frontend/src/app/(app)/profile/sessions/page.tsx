import { Metadata } from 'next';
import { SessionManager } from '@/features/auth/components/SessionManager';

export const metadata: Metadata = {
  title: 'Active Sessions | MedTrack Hub',
  description: 'Manage your active sessions and devices',
};

export default async function SessionsPage() {
  return (
    <div className="container mx-auto px-4 py-8 bg-gray-50/50 dark:bg-slate-900/50 min-h-screen">
      <h1 className="text-3xl font-bold mb-8 text-gray-900 dark:text-white">Active Sessions</h1>
      <div className="max-w-2xl">
        <SessionManager />
      </div>
    </div>
  );
}
