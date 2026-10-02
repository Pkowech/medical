'use client';

import { ReactNode } from 'react';
import { MarketingHeader } from '@/core/marketing/MarketingHeader';
import { MarketingFooter } from '@/core/marketing/MarketingFooter';

interface AuthLayoutProps {
  children: ReactNode;
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50 text-slate-900 transition-colors dark:bg-slate-950 dark:text-slate-100">
      <MarketingHeader />
      <main id="main-content" className="flex-grow flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-md">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/60 transition-colors dark:border-slate-700 dark:bg-slate-900 dark:shadow-none dark:shadow-slate-950/20 sm:p-8">
            {children}
          </div>
        </div>
      </main>
      <MarketingFooter />
    </div>
  );
}
