
import '@/shared/styles/globals.css';
import type { ReactNode } from 'react';
import type { Metadata, Viewport } from 'next';
import { Providers } from './providers';
import { Toaster } from 'react-hot-toast';
import LayoutContent from '@/core/app/components/layout/LayoutContent';
import { ConnectivityIndicator } from '@/components/ui/ConnectivityIndicator';

interface RootLayoutProps {
  children: ReactNode;
}

export const metadata: Metadata = {
  title: 'MedTrack Hub',
  manifest: '/manifest.json',
  description: 'Comprehensive medical learning and tracking platform',
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#1e40af',
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <Providers>
          <Toaster position="top-right" />
          <ConnectivityIndicator />
          <LayoutContent>{children}</LayoutContent>
        </Providers>
      </body>
    </html>
  );
}
