'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Stethoscope, Menu, X, ChevronDown } from 'lucide-react';
import { useMounted } from '@/shared/hooks/useMounted';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';

export const MarketingHeader: React.FC = () => {
  const isMounted = useMounted();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const menuId = 'marketing-mobile-menu';

  return (
    <nav className="sticky top-0 z-50 pointer-events-auto">
      <div className="w-full">
        <div className="-mt-2 bg-white/95 backdrop-blur-sm rounded-b-xl shadow-md border border-gray-100">
          <div className="flex justify-between items-center h-16 px-4 lg:px-8">
            <div className="flex items-center">
              <div className="flex-shrink-0 flex items-center">
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-2 rounded-lg">
                  <Stethoscope className="h-8 w-8 text-white" />
                </div>
                <span className="ml-3 text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  MedTrack Hub
                </span>
              </div>
            </div>

            <div className="hidden md:flex items-center space-x-6">
              {!isMounted ? (
                <button className="text-gray-600 hover:text-gray-900 flex items-center">
                  Features <ChevronDown className="ml-1 h-4 w-4" />
                </button>
              ) : (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="text-gray-600 hover:text-gray-900 flex items-center">
                      Features <ChevronDown className="ml-1 h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem>
                      <Link href="/features/ai-learning">AI Learning</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Link href="/features/progress-tracking">Progress Tracking</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Link href="/features/peer-learning">Peer Learning</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Link href="/features/offline-access">Offline Access</Link>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              <Link href="/pricing" className="text-gray-600 hover:text-gray-900">
                Pricing
              </Link>
              <Link href="/about" className="text-gray-600 hover:text-gray-900">
                About
              </Link>
            </div>

            <div className="flex items-center space-x-4">
              <div className="hidden md:flex items-center space-x-4">
                <Link href="/login" className="text-gray-600 hover:text-gray-900">
                  Log in
                </Link>
                <Link
                  href="/register"
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium"
                >
                  Get Started
                </Link>
              </div>

              <div className="md:hidden">
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="text-gray-600 hover:text-gray-900 p-2 rounded-md"
                  aria-controls={menuId}
                  aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
                >
                  {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
                </button>
              </div>
            </div>
          </div>

          {mobileMenuOpen && (
            <div
              id={menuId}
              role="navigation"
              aria-label="Mobile menu"
              className="md:hidden border-t border-gray-200 py-4"
            >
              <div className="flex flex-col space-y-2 px-4">
                <Link
                  href="/features/ai-learning"
                  onClick={() => setMobileMenuOpen(false)}
                  className="py-2"
                  tabIndex={0}
                >
                  AI Learning
                </Link>
                <Link
                  href="/features/progress-tracking"
                  onClick={() => setMobileMenuOpen(false)}
                  className="py-2"
                  tabIndex={0}
                >
                  Progress Tracking
                </Link>
                <Link
                  href="/features/peer-learning"
                  onClick={() => setMobileMenuOpen(false)}
                  className="py-2"
                  tabIndex={0}
                >
                  Peer Learning
                </Link>
                <Link
                  href="/features/offline-access"
                  onClick={() => setMobileMenuOpen(false)}
                  className="py-2"
                  tabIndex={0}
                >
                  Offline Access
                </Link>
                <Link
                  href="/pricing"
                  onClick={() => setMobileMenuOpen(false)}
                  className="py-2"
                  tabIndex={0}
                >
                  Pricing
                </Link>
                <Link
                  href="/about"
                  onClick={() => setMobileMenuOpen(false)}
                  className="py-2"
                  tabIndex={0}
                >
                  About
                </Link>
                <Link
                  href="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="py-2"
                  tabIndex={0}
                >
                  Log in
                </Link>
                <Link
                  href="/register"
                  onClick={() => setMobileMenuOpen(false)}
                  className="py-2"
                  tabIndex={0}
                >
                  Get Started
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};
