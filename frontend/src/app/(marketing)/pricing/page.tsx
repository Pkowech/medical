import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getPageMetadata } from '@/core/metadata/pageMetadata';

export const metadata: Metadata = getPageMetadata('/pricing');

export default function PricingPage() {
  redirect('/features');
}
