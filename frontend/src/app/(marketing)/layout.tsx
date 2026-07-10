'use client';

import { ReactNode } from 'react';
import { MarketingHeader } from '@/core/marketing/MarketingHeader';
import { MarketingFooter } from '@/core/marketing/MarketingFooter';

interface MarketingLayoutProps {
  children: ReactNode;
}

export default function MarketingLayout({ children }: MarketingLayoutProps) {
  return (
    <div className="bg-white">
      <MarketingHeader />
      <main id="main-content">{children}</main>
      <MarketingFooter />
    </div>
  );
}
