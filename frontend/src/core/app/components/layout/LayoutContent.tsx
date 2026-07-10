// LayoutContent.tsx
'use client';

import { ReactNode } from 'react';
import AppErrorBoundary from '@/features/security/components/AppErrorBoundary';

interface LayoutContentProps {
  children: ReactNode;
}

export default function LayoutContent({ children }: LayoutContentProps) {
  // Auth sync is now handled by AuthSynchronizer component in SessionWrapper
  // No need to sync here anymore - it happens earlier in the component tree

  return (
    <AppErrorBoundary>
      <div className="min-h-screen bg-background">{children}</div>
    </AppErrorBoundary>
  );
}
