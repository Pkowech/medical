'use client';

import type { ReactNode } from 'react';
import { SessionProvider } from 'next-auth/react';
import AuthSynchronizer from './AuthSynchronizer';

export default function SessionWrapper({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <AuthSynchronizer>{children}</AuthSynchronizer>
    </SessionProvider>
  );
}
