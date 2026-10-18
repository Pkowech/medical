import '@/shared/styles/globals.css';
import type { ReactNode } from 'react';
import type { Metadata, Viewport } from 'next';
import { Providers } from './providers';
import { ToastProvider } from './ToastProvider';
import LayoutContent from '@/core/app/components/layout/LayoutContent';
import { ConnectivityIndicator } from '@/components/ui/ConnectivityIndicator';
import { ServiceWorkerRegister } from './ServiceWorkerRegister';

interface RootLayoutProps {
  children: ReactNode;
}

const configuredSiteUrl =
  process.env.NEXT_PUBLIC_BASE_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.NEXTAUTH_URL ||
  process.env.VERCEL_URL;
const siteUrl = configuredSiteUrl
  ? new URL(
      /^https?:\/\//i.test(configuredSiteUrl)
        ? configuredSiteUrl
        : `https://${configuredSiteUrl}`,
    )
  : undefined;

export const metadata: Metadata = {
  title: {
    default: 'MedTrack Hub',
    template: '%s | MedTrack Hub',
  },
  ...(siteUrl ? { metadataBase: siteUrl } : {}),
  manifest: '/manifest.json',
  description:
    'Medical courses, quizzes, flashcards, study planning, and progress tracking in one learning platform.',
  icons: {
    icon: '/favicon.svg',
    apple: '/android-chrome-192x192.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#1e40af',
  viewportFit: 'cover',
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <Providers>
          <ToastProvider />
          <ServiceWorkerRegister />
          <ConnectivityIndicator />
          <LayoutContent>{children}</LayoutContent>
        </Providers>
      </body>
    </html>
  );
}
