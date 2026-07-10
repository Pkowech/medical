'use client';
import { SessionProvider } from 'next-auth/react';
import AuthSynchronizer from './AuthSynchronizer';

export default function SessionWrapper({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider 
      refetchInterval={0} 
      refetchOnWindowFocus={false} 
      refetchWhenOffline={false}
    >
      <AuthSynchronizer>
        {children}
      </AuthSynchronizer>
    </SessionProvider>
  );
}
