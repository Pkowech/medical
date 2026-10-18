import { Metadata } from 'next';
import { SessionManager } from '@/features/auth/components/SessionManager';
import { getPageMetadata } from '@/core/metadata/pageMetadata';

export const metadata: Metadata = getPageMetadata('/profile/sessions');

export default async function SessionsPage() {
  return (
    <div className="container mx-auto px-4 py-8 bg-background/50 dark:bg-card/50 min-h-screen">
      <h1 className="text-3xl font-bold mb-8 text-foreground dark:text-foreground">Active Sessions</h1>
      <div className="max-w-2xl">
        <SessionManager />
      </div>
    </div>
  );
}
