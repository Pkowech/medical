'use client';

import React from 'react';
import Link from 'next/link';

export const AppFooter: React.FC = () => {
  return (
    <footer className="bg-card border-t border-border py-4 transition-all duration-300">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 flex flex-col sm:flex-row justify-between items-center text-sm text-muted-foreground gap-4">
        <p>&copy; {new Date().getFullYear()} MedTrack Hub. All rights reserved.</p>
        <div className="flex space-x-4">
          <Link href="/privacy" className="hover:text-foreground transition-colors">
            Privacy Policy
          </Link>
          <Link href="/terms" className="hover:text-foreground transition-colors">
            Terms of Service
          </Link>
        </div>
      </div>
    </footer>
  );
};

export default AppFooter;
