'use client';

import { ReactNode } from 'react';

interface AuthLayoutProps {
  children: ReactNode;
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="min-h-screen bg-[#eef2f6] text-slate-900 transition-colors dark:bg-slate-950 dark:text-slate-100">
      <main
        id="main-content"
        className="flex min-h-screen items-center justify-center px-4 py-8 sm:px-6 lg:px-8"
      >
        <div className="w-full max-w-[620px]">
          <div className="rounded-[24px] border border-slate-200 bg-[#f9fafb] p-6 shadow-[0_12px_30px_rgba(15,23,42,0.08)] transition-colors dark:border-slate-700 dark:bg-slate-900 dark:shadow-none sm:p-8">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
