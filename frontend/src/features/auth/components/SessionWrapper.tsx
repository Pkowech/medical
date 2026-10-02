'use client';

import type { ReactNode } from 'react';
import { SessionProvider } from 'next-auth/react';
import AuthSynchronizer from './AuthSynchronizer';

export default function SessionWrapper({ children }: { children: ReactNode }) {
  return (
    <SessionProvider refetchInterval={0} refetchOnWindowFocus={false}>
      <AuthSynchronizer>{children}</AuthSynchronizer>
    </SessionProvider>
  );
}
