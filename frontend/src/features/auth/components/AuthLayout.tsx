'use client';

import { ReactNode } from 'react';

interface AuthLayoutProps {
  children: ReactNode;
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="min-h-screen bg-[#020d1b] text-foreground transition-colors dark:bg-[#020d1b] dark:text-muted-foreground">
      <main
        id="main-content"
        className="flex min-h-screen items-center justify-center px-4 py-8 sm:px-6 lg:px-8"
      >
        <div className="w-full max-w-[760px]">
          <div className="rounded-[28px] border border-[#2e3d52] bg-[#182a3b] p-6 shadow-[0_18px_40px_rgba(1,8,18,0.55)] transition-colors dark:border-[#2e3d52] dark:bg-[#182a3b] dark:shadow-[0_18px_40px_rgba(1,8,18,0.55)] sm:p-8">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
