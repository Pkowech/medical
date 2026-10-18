import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getPageMetadata } from '@/core/metadata/pageMetadata';

export const metadata: Metadata = getPageMetadata('/features/progress-tracking');

export default function ProgressTrackingPage() {
  redirect('/features/study-progress');
}
