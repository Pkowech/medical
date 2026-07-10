'use client';

import React from 'react';
import { Metadata } from 'next';
import Head from 'next/head';

interface SEOProps {
  title?: string;
  description?: string;
  keywords?: string[];
  ogImage?: string;
  ogType?: 'website' | 'article';
  twitterCard?: 'summary' | 'summary_large_image';
  noIndex?: boolean;
}

export function generateMetadata({
  title = 'Medical Learning Platform',
  description = 'Advanced medical education platform for healthcare professionals',
  keywords = ['medical', 'education', 'healthcare', 'learning', 'courses'],
  ogImage = '/images/og-image.jpg',
  ogType = 'website',
  twitterCard = 'summary_large_image',
  noIndex = false,
}: SEOProps = {}): Metadata {
  const siteTitle = `${title} | Medical Learning Platform`;

  return {
    title: siteTitle,
    description,
    keywords: keywords.join(', '),
    openGraph: {
      title: siteTitle,
      description,
      type: ogType,
      images: [{ url: ogImage }],
      siteName: 'Medical Learning Platform',
    },
    twitter: {
      card: twitterCard,
      title: siteTitle,
      description,
      images: [ogImage],
    },
    robots: noIndex ? 'noindex,nofollow' : 'index,follow',
    icons: {
      icon: '/favicon.svg',
      apple: '/apple-touch-icon.png',
      shortcut: '/favicon-32x32.png',
    },
    manifest: '/site.webmanifest',
  };
}

// Client-side SEO component for use in client components
export function SEO({
  title = 'Medical Learning Platform',
  description = 'Advanced medical education platform for healthcare professionals',
  keywords = ['medical', 'education', 'healthcare', 'learning', 'courses'],
  ogImage = '/images/og-image.jpg',
  ogType = 'website',
  twitterCard = 'summary_large_image',
  noIndex = false,
}: SEOProps = {}) {
  const siteTitle = `${title} | MedTrack Hub`;

  return (
    <Head>
      <title>{siteTitle}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords.join(', ')} />

      {/* Open Graph */}
      <meta property="og:title" content={siteTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content={ogType} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:site_name" content="MedTrack Hub" />

      {/* Twitter */}
      <meta name="twitter:card" content={twitterCard} />
      <meta name="twitter:title" content={siteTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />

      {/* Robots */}
      <meta name="robots" content={noIndex ? 'noindex,nofollow' : 'index,follow'} />

      {/* Icons */}
      <link rel="icon" href="/favicon.svg" />
      <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      <link rel="shortcut icon" href="/favicon-32x32.png" />
      <link rel="manifest" href="/site.webmanifest" />

      {/* Theme */}
      <meta name="viewport" content="width=device-width, initial-scale=1" />
    </Head>
  );
}

// Example usage in a page.tsx:
// export const metadata = generateMetadata({
//   title: 'Your Page Title',
//   description: 'Your page description'
// });
