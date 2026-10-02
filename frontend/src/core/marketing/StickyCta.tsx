'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { useEffect, useState } from 'react';

export function StickyCta() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 300) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  return (
    <div
      aria-hidden={!isVisible}
      className={`fixed inset-x-0 bottom-0 z-40 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] transition-transform duration-300 md:hidden ${isVisible ? 'translate-y-0' : 'pointer-events-none translate-y-full'}`}
    >
      <Link
        href="/register"
        tabIndex={isVisible ? 0 : -1}
        className="mx-auto flex min-h-12 w-full max-w-lg items-center justify-center rounded-xl bg-blue-800 px-6 py-3 font-bold text-white shadow-xl shadow-slate-950/20 transition-colors hover:bg-blue-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
      >
        Create your account
        <ArrowRight className="h-5 w-5 ml-2" aria-hidden="true" />
      </Link>
    </div>
  );
}
