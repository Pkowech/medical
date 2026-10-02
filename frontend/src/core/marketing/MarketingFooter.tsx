'use client';

import React from 'react';
import { Stethoscope } from 'lucide-react';
import Link from 'next/link';

export const MarketingFooter: React.FC = () => {
  return (
    <footer role="contentinfo" className="bg-gray-900 text-gray-300">
      {/* Skip link for keyboard users to jump to main content when footer is focused */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 bg-white text-gray-900 px-3 py-2 rounded-md z-50"
      >
        Skip to content
      </a>
      {/* Main Footer Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
          {/* Company Info */}
          <div className="lg:col-span-2">
            <div className="flex items-center mb-6">
              <div className="bg-gradient-to-r from-blue-500 to-indigo-500 p-2 rounded-lg">
                <Stethoscope className="h-8 w-8 text-white" aria-hidden="true" />
              </div>
              <span className="ml-3 text-2xl font-bold text-white">MedTrack Hub</span>
            </div>
            <p className="text-gray-400 mb-6 leading-relaxed max-w-md">
              A platform for medical courses, practice, study planning, and progress tracking.
            </p>
          </div>

          {/* Platform */}
          <nav aria-label="Platform links">
            <div>
              <h3 className="text-white font-semibold mb-6 text-lg">Platform</h3>
              <ul className="space-y-3">
                <li>
                  <Link
                    href="/features"
                    className="hover:text-white transition-colors text-gray-400"
                  >
                    Features
                  </Link>
                </li>
                <li>
                  <Link
                    href="/courses"
                    className="hover:text-white transition-colors text-gray-400"
                  >
                    Medical Curriculum
                  </Link>
                </li>
                <li>
                  <Link
                    href="/register"
                    className="hover:text-white transition-colors text-gray-400"
                  >
                    Get Started
                  </Link>
                </li>
              </ul>
            </div>
          </nav>

          {/* Company */}
          <nav aria-label="Company links">
            <div>
              <h3 className="text-white font-semibold mb-6 text-lg">Company</h3>
              <ul className="space-y-3">
                <li>
                  <Link href="/about" className="hover:text-white transition-colors text-gray-400">
                    About Us
                  </Link>
                </li>
                <li>
                  <Link
                    href="/contact"
                    className="hover:text-white transition-colors text-gray-400"
                  >
                    Contact Sales
                  </Link>
                </li>
              </ul>
            </div>
          </nav>
        </div>

      </div>

      {/* Bottom Footer */}
      <div className="border-t border-gray-800 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="text-sm text-gray-400 mb-4 md:mb-0" suppressHydrationWarning>
              © {new Date().getFullYear()} MedTrack Hub. All rights reserved.
            </div>
            <div className="flex space-x-6 text-sm">
              <Link href="/privacy" className="text-gray-400 hover:text-white transition-colors">
                Privacy Policy
              </Link>
              <Link href="/terms" className="text-gray-400 hover:text-white transition-colors">
                Terms of Service
              </Link>
              <Link
                href="/cookie-policy"
                className="text-gray-400 hover:text-white transition-colors"
              >
                Cookie Policy
              </Link>
              <Link
                href="/accessibility"
                className="text-gray-400 hover:text-white transition-colors"
              >
                Accessibility
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};
