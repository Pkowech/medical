import { Metadata } from 'next';
import MarketingPage from '@/core/marketing/MarketingPage';

export const metadata: Metadata = {
  title: 'MedTrack Hub - Intelligent Medical Education',
  description:
    'Transform your medical education with MedTrack Hub. AI-powered learning, progress tracking, and expert support.',
  openGraph: {
    title: 'MedTrack Hub - Intelligent Medical Education',
    description:
      'Transform your medical education with AI-powered learning, progress tracking, and expert support.',
    type: 'website',
    images: ['/og-image.png'],
  },
};

export default function Page() {
  return <MarketingPage />;
}
