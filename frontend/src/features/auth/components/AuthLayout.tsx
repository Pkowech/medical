'use client';

import { ReactNode } from 'react';

interface AuthLayoutProps {
  children: ReactNode;
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="min-h-screen bg-[#eef2f6] text-foreground transition-colors dark:bg-background dark:text-muted-foreground">
      <main
        id="main-content"
        className="flex min-h-screen items-center justify-center px-4 py-8 sm:px-6 lg:px-8"
      >
        <div className="w-full max-w-[620px]">
          <div className="rounded-[24px] border border-border bg-[#f9fafb] p-6 shadow-[0_12px_30px_rgba(15,23,42,0.08)] transition-colors dark:border-border dark:bg-card dark:shadow-none sm:p-8">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
