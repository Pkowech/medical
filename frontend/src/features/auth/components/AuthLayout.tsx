'use client';

import { ReactNode } from 'react';
import { MarketingHeader } from '@/core/marketing/MarketingHeader';
import { MarketingFooter } from '@/core/marketing/MarketingFooter';

interface AuthLayoutProps {
  children: ReactNode;
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <MarketingHeader />
      <main id="main-content" className="flex-grow flex items-center justify-center py-12">
        <div className="w-full max-w-md p-8">
          <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8">{children}</div>
        </div>
      </main>
      <MarketingFooter />
    </div>
  );
}
