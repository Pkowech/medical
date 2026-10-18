import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Cookie and Device Storage Notice | MedTrack Hub',
};

export default function CookiePolicyPage() {
  return (
    <main className="container mx-auto max-w-4xl px-4 py-12 sm:py-16">
      <h1 className="text-3xl font-bold tracking-tight text-foreground dark:text-foreground">
        Cookie and device storage notice
      </h1>
      <p className="mt-4 leading-7 text-muted-foreground">
        MedTrack Hub uses browser cookies and local device storage to keep sign-in sessions,
        remember application preferences, support offline learning, and restore feature state.
        Authentication cookies are necessary to provide account features. Local storage and
        IndexedDB may be used for preferences, queued offline work, and cached learning data.
      </p>
      <p className="mt-4 leading-7 text-muted-foreground">
        This application notice does not provide an exhaustive name-by-name cookie inventory. Cookie
        names, lifetimes, and any optional analytics or third-party storage must be confirmed
        against the active production deployment. You can manage or clear browser storage through
        your browser settings; doing so may sign you out or disable offline features.
      </p>
      <p className="mt-4 leading-7 text-muted-foreground">
        When a Google Analytics measurement ID is configured, marketing pages initialize Google
        Analytics and record page and call-to-action interactions. The controller must verify the
        cookies or other identifiers used by that configuration and provide any preference or
        consent controls required for the chosen lawful basis.
      </p>
      <p className="mt-4 leading-7 text-muted-foreground">
        For privacy questions, contact{' '}
        <a
          className="font-medium text-blue-700 underline dark:text-blue-300"
          href="mailto:aaronrono427@gmail.com"
        >
          aaronrono427@gmail.com
        </a>
        . See the{' '}
        <a className="font-medium text-blue-700 underline dark:text-blue-300" href="/privacy">
          Privacy Notice
        </a>{' '}
        for more about personal data processing.
      </p>
    </main>
  );
}
