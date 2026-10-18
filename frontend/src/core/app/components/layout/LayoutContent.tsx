// LayoutContent.tsx
'use client';

import { ReactNode, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import AppErrorBoundary from '@/features/security/components/AppErrorBoundary';
import { applyPageMetadata, getPageMetadata } from '@/core/metadata/pageMetadata';

interface LayoutContentProps {
  children: ReactNode;
}

export default function LayoutContent({ children }: LayoutContentProps) {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname || !/^\/(login|register|forgot-password|reset-password|verify-email|resend-verification|finish-setup|google-consent|mfa-setup|error|unauthorized)$/.test(pathname)) {
      return;
    }
    applyPageMetadata(getPageMetadata(pathname));
  }, [pathname]);

  // Auth sync is now handled by AuthSynchronizer component in SessionWrapper
  // No need to sync here anymore - it happens earlier in the component tree

  return (
    <AppErrorBoundary>
      <div className="min-h-screen bg-background">{children}</div>
    </AppErrorBoundary>
  );
}
