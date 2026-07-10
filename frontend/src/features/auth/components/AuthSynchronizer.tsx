'use client';

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useAuthStore } from '@/features/auth/store/useAuthStore';
import type { User } from '@/shared/types/authInterface';

/**
 * AuthSynchronizer is a lightweight component that keeps the Zustand auth store
 * in sync with the NextAuth session. This must run early in the component tree
 * (inside SessionProvider) to ensure the auth store is populated before child
 * components attempt to access it.
 */
export default function AuthSynchronizer({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();

  // Sync session → auth store whenever session changes
  useEffect(() => {
    if (status === 'loading') {
      // Don't sync during loading state
      return;
    }

    if (status === 'authenticated' && session?.user) {
      const sessionUser = session.user as User;
      const currentUser = useAuthStore.getState().user;

      // Only update if there's actual change
      if (sessionUser?.id !== currentUser?.id || sessionUser?.accessToken !== currentUser?.accessToken) {
        useAuthStore.setState({ 
          user: sessionUser, 
          isAuthenticated: true 
        });
      }
    } else if (status === 'unauthenticated') {
      const currentUser = useAuthStore.getState().user;
      if (currentUser !== null) {
        useAuthStore.setState({ 
          user: null, 
          isAuthenticated: false 
        });
      }
    }
  }, [status, session]);

  return <>{children}</>;
}
