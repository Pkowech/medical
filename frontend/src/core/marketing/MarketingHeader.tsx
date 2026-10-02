'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Stethoscope, Menu, X } from 'lucide-react';

export const MarketingHeader: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const menuId = 'marketing-mobile-menu';

  return (
    <nav aria-label="Main navigation" className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur">
      <div className="mx-auto flex min-h-16 w-full max-w-screen-2xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex min-w-0 items-center gap-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600">
            <Stethoscope className="h-5 w-5 text-white" aria-hidden="true" />
          </span>
          <span className="truncate text-base font-bold tracking-tight text-slate-950 sm:text-lg">
            MedTrack Hub
          </span>
        </Link>

        <div className="hidden items-center gap-7 md:flex">
          <Link href="/#features" className="text-sm font-medium text-slate-700 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">
            Features
          </Link>
          <Link href="/#featured-courses" className="text-sm font-medium text-slate-700 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">
            Courses
          </Link>
          <Link href="/about" className="text-sm font-medium text-slate-700 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">
            About
          </Link>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <Link
            href="/login"
            className="hidden min-h-10 items-center rounded-lg px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 sm:inline-flex"
          >
            Log in
          </Link>
          <Link
            href="/register"
            className="inline-flex min-h-10 items-center justify-center whitespace-nowrap rounded-lg bg-blue-700 px-3 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 sm:px-4 sm:text-sm"
          >
            Create account
          </Link>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(open => !open)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 md:hidden"
            aria-controls={menuId}
            aria-expanded={mobileMenuOpen}
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {mobileMenuOpen && (
          <div id={menuId} className="absolute inset-x-0 top-full border-b border-slate-200 bg-white px-4 py-3 shadow-lg md:hidden">
            <div className="mx-auto flex max-w-screen-2xl flex-col">
              {[
                { href: '/#features', label: 'Explore features' },
                { href: '/#featured-courses', label: 'Browse courses' },
                { href: '/about', label: 'About MedTrack Hub' },
                { href: '/login', label: 'Log in' },
              ].map(item => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};
