import React from 'react';
import type { Metadata } from 'next';
import ProgressClient from './ProgressClient';
import { getPageMetadata } from '@/core/metadata/pageMetadata';

export const metadata: Metadata = getPageMetadata('/progress');

export default function ProgressPage() {
  return <ProgressClient />;
}
