import type { Metadata } from 'next';
import { getPageMetadata } from '@/core/metadata/pageMetadata';

export const metadata: Metadata = getPageMetadata('/accessibility');

export default function AccessibilityPage() {
  return (
    <main className="container mx-auto max-w-4xl px-4 py-12 sm:py-16">
      <h1 className="text-3xl font-bold tracking-tight text-foreground dark:text-foreground">
        Accessibility
      </h1>
      <p className="mt-4 leading-7 text-muted-foreground">
        We want MedTrack Hub to be usable by as many people as possible and continue to improve
        keyboard navigation, readable content, and assistive-technology support. We have not
        completed an independent accessibility audit and do not claim conformance to a specific
        standard.
      </p>
      <p className="mt-4 leading-7 text-muted-foreground">
        If you encounter a barrier or need content in another format, email{' '}
        <a
          className="font-medium text-blue-700 underline dark:text-blue-300"
          href="mailto:aaronrono427@gmail.com?subject=Accessibility%20feedback"
        >
          aaronrono427@gmail.com
        </a>{' '}
        and describe the page and the difficulty. Please do not include passwords or patient
        identifiable information.
      </p>
    </main>
  );
}
