'use client';

import React from 'react';
import {
  Stethoscope,
  Mail,
  Phone,
  MapPin,
  Facebook,
  Twitter,
  Linkedin,
  Instagram,
  Youtube,
} from 'lucide-react';
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8">
          {/* Company Info */}
          <div className="lg:col-span-2">
            <div className="flex items-center mb-6">
              <div className="bg-gradient-to-r from-blue-500 to-indigo-500 p-2 rounded-lg">
                <Stethoscope className="h-8 w-8 text-white" aria-hidden="true" />
              </div>
              <span className="ml-3 text-2xl font-bold text-white">MedTrack Hub</span>
            </div>
            <p className="text-gray-400 mb-6 leading-relaxed max-w-md">
              Empowering the next generation of medical professionals through innovative education,
              AI-powered learning, and comprehensive medical curriculum designed by leading experts.
            </p>
            <div className="flex space-x-4">
              <a
                href="https://facebook.com/medtrackhub"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-blue-400 transition-colors"
                aria-label="MedTrack Hub on Facebook"
              >
                <Facebook className="h-6 w-6" aria-hidden="true" />
              </a>
              <a
                href="https://twitter.com/medtrackhub"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-blue-400 transition-colors"
                aria-label="MedTrack Hub on Twitter"
              >
                <Twitter className="h-6 w-6" aria-hidden="true" />
              </a>
              <a
                href="https://linkedin.com/company/medtrackhub"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-blue-400 transition-colors"
                aria-label="MedTrack Hub on LinkedIn"
              >
                <Linkedin className="h-6 w-6" aria-hidden="true" />
              </a>
              <a
                href="https://instagram.com/medtrackhub"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-blue-400 transition-colors"
                aria-label="MedTrack Hub on Instagram"
              >
                <Instagram className="h-6 w-6" aria-hidden="true" />
              </a>
              <a
                href="https://youtube.com/medtrackhub"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-blue-400 transition-colors"
                aria-label="MedTrack Hub on YouTube"
              >
                <Youtube className="h-6 w-6" aria-hidden="true" />
              </a>
            </div>
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
                    href="/pricing"
                    className="hover:text-white transition-colors text-gray-400"
                  >
                    Pricing
                  </Link>
                </li>
                <li>
                  <Link
                    href="/testimonials"
                    className="hover:text-white transition-colors text-gray-400"
                  >
                    Testimonials
                  </Link>
                </li>
                <li>
                  <Link
                    href="/auth/register"
                    className="hover:text-white transition-colors text-gray-400"
                  >
                    Get Started
                  </Link>
                </li>
              </ul>
            </div>
          </nav>

          {/* Resources */}
          <nav aria-label="Resource links">
            <div>
              <h3 className="text-white font-semibold mb-6 text-lg">Resources</h3>
              <ul className="space-y-3">
                <li>
                  <Link href="/blog" className="hover:text-white transition-colors text-gray-400">
                    Learning Center
                  </Link>
                </li>
                <li>
                  <Link href="/docs" className="hover:text-white transition-colors text-gray-400">
                    Documentation
                  </Link>
                </li>
                <li>
                  <Link
                    href="/api-reference"
                    className="hover:text-white transition-colors text-gray-400"
                  >
                    API Reference
                  </Link>
                </li>
                <li>
                  <Link
                    href="/community"
                    className="hover:text-white transition-colors text-gray-400"
                  >
                    Community Forum
                  </Link>
                </li>
                <li>
                  <Link href="/help" className="hover:text-white transition-colors text-gray-400">
                    Help Center
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
                    href="/careers"
                    className="hover:text-white transition-colors text-gray-400"
                  >
                    Careers
                  </Link>
                </li>
                <li>
                  <Link href="/press" className="hover:text-white transition-colors text-gray-400">
                    Press
                  </Link>
                </li>
                <li>
                  <Link
                    href="/partners"
                    className="hover:text-white transition-colors text-gray-400"
                  >
                    Partners
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

        {/* Contact Information */}
        <div className="border-t border-gray-800 mt-12 pt-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="flex items-center">
              <Mail className="h-5 w-5 text-blue-400 mr-3" aria-hidden="true" />
              <div>
                <p className="text-sm text-gray-400">Email</p>
                <p className="text-white">support@medtrackhub.com</p>
              </div>
            </div>
            <div className="flex items-center">
              <Phone className="h-5 w-5 text-blue-400 mr-3" aria-hidden="true" />
              <div>
                <p className="text-sm text-gray-400">Phone</p>
                <p className="text-white">+1 (555) 123-4567</p>
              </div>
            </div>
            <div className="flex items-center">
              <MapPin className="h-5 w-5 text-blue-400 mr-3" aria-hidden="true" />
              <div>
                <p className="text-sm text-gray-400">Address</p>
                <p className="text-white">123 Medical Center Dr, Suite 100</p>
              </div>
            </div>
          </div>
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
