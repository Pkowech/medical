// LayoutContent.tsx
'use client';

import { ReactNode, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import AppErrorBoundary from '@/features/security/components/AppErrorBoundary';
import { applyPageMetadata, getPageMetadata } from '@/core/metadata/pageMetadata';
import { usePageHeader } from '@/core/providers/HeaderContext';

interface LayoutContentProps {
  children: ReactNode;
}

export default function LayoutContent({ children }: LayoutContentProps) {
  const pathname = usePathname();
  const { header } = usePageHeader();

  useEffect(() => {
    if (!pathname) {
      return;
    }

    // Dynamic feature pages already provide their title through generateMetadata.
    if (/^\/features\/[^/]+$/.test(pathname) && pathname !== '/features/progress-tracking') {
      return;
    }

    const routeMetadata = getPageMetadata(pathname);
    applyPageMetadata({
      title: header?.title ?? routeMetadata.title,
      description: header?.description ?? routeMetadata.description,
    });
  }, [header?.description, header?.title, pathname]);

  // Auth sync is now handled by AuthSynchronizer component in SessionWrapper
  // No need to sync here anymore - it happens earlier in the component tree

  return (
    <AppErrorBoundary>
      <div className="min-h-screen bg-background">{children}</div>
    </AppErrorBoundary>
  );
}
