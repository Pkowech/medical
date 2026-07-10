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
      className={`fixed bottom-0 left-0 right-0 bg-blue-600 p-4 shadow-lg z-50 md:hidden transition-transform duration-300 ${isVisible ? 'translate-y-0' : 'translate-y-full'}`}
    >
      <Link
        href="/auth/register"
        className="w-full bg-white text-blue-600 px-6 py-3 rounded-lg font-semibold flex items-center justify-center hover:bg-blue-50 transition-colors"
      >
        Start Free Trial
        <ArrowRight className="h-5 w-5 ml-2" aria-hidden="true" />
      </Link>
    </div>
  );
}
