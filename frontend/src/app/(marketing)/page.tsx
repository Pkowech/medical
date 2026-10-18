import { Metadata } from 'next';
import MarketingPage from '@/core/marketing/MarketingPage';
import { getPageMetadata } from '@/core/metadata/pageMetadata';

const pageMetadata = getPageMetadata('/');
export const metadata: Metadata = {
  title: {
    absolute: pageMetadata.title,
  },
  description: pageMetadata.description,
  openGraph: {
    title: pageMetadata.title,
    description: pageMetadata.description,
    type: 'website',
    images: ['/og-image.png'],
  },
};

export default function Page() {
  return <MarketingPage />;
}
