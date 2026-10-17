import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/shared/components/ui/button';

export const metadata: Metadata = {
  title: 'Contact MedTrack Hub',
  description: 'Contact MedTrack Hub by email for questions or privacy requests.',
};

export default function ContactPage() {
  return (
    <main className="container mx-auto max-w-3xl px-4 py-12 sm:py-16">
      <section aria-labelledby="contact-heading" className="text-center">
        <h1 id="contact-heading" className="mb-4 text-3xl font-bold sm:text-4xl">
          Contact MedTrack Hub
        </h1>
        <p className="mx-auto max-w-2xl text-base text-muted-foreground sm:text-lg">
          For questions, feedback, or privacy requests, email our contact address. Your email
          application will open so you can review and send your message.
        </p>
        <div className="mx-auto mt-8 max-w-lg rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8">
          <p className="text-sm font-medium text-muted-foreground">Email</p>
          <a
            className="mt-2 inline-block text-lg font-semibold text-blue-700 underline underline-offset-4 dark:text-blue-300"
            href="mailto:aaronrono427@gmail.com"
          >
            aaronrono427@gmail.com
          </a>
          <p className="mt-4 text-sm leading-6 text-muted-foreground">
            No message is submitted to this website. Avoid including passwords, patient identifiable
            information, or other sensitive information in email.
          </p>
          <Button asChild className="mt-6 w-full">
            <a href="mailto:aaronrono427@gmail.com?subject=MedTrack%20Hub%20enquiry">
              Email MedTrack Hub
            </a>
          </Button>
        </div>
        <p className="mt-6 text-sm text-muted-foreground">
          For how personal information is handled, see our{' '}
          <Link className="text-blue-700 underline dark:text-blue-300" href="/privacy">
            Privacy Notice
          </Link>
          .
        </p>
      </section>
    </main>
  );
}
