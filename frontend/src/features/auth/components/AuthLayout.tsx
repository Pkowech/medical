'use client';

import { ReactNode } from 'react';

interface AuthLayoutProps {
  children: ReactNode;
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="min-h-screen bg-[#0f172a] text-foreground transition-colors dark:bg-[#0f172a] dark:text-muted-foreground">
      <main
        id="main-content"
        className="flex min-h-screen items-center justify-center px-4 py-8 sm:px-6 lg:px-8"
      >
        <div className="w-full max-w-[840px]">
          <div className="rounded-[28px] border border-[#2e3d52] bg-[#1f2937] p-6 shadow-[0_18px_40px_rgba(1,8,18,0.45)] transition-colors dark:border-[#2e3d52] dark:bg-[#1f2937] dark:shadow-[0_18px_40px_rgba(1,8,18,0.45)] sm:p-8">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
