'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn, useSession } from 'next-auth/react';

function getSafeReturnTo(value: string | null): string {
  if (!value) return '/dashboard';

  try {
    const url = new URL(value, window.location.origin);
    if (url.origin === window.location.origin) {
      return `${url.pathname}${url.search}${url.hash}`;
    }
  } catch {
    console.warn('[GoogleConsent] Ignoring invalid return URL');
  }

  return '/dashboard';
}

function GoogleConsentContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status } = useSession();
  const [accepted, setAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (status === 'authenticated') {
      router.replace(getSafeReturnTo(searchParams.get('returnTo')));
    }
  }, [router, searchParams, status]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!accepted) {
      setError('Please accept the Terms of Service and Privacy Policy to continue.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const result = await signIn('google-consent', {
        acceptTerms: 'true',
        callbackUrl: '/finish-setup',
        redirect: false,
      });
      if (result?.error) {
        throw new Error(
          result.error === 'CredentialsSignin'
            ? 'Your Google sign-up session expired. Please try again.'
            : 'Could not complete Google sign-up. Please try again.',
        );
      }
      router.replace(result?.url ?? '/finish-setup');
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Could not complete Google sign-up. Please try again.',
      );
      setSubmitting(false);
    }
  };

  if (status === 'loading' || status === 'authenticated') {
    return <p className="text-center text-sm text-muted-foreground">Completing sign-in…</p>;
  }

  return (
    <main className="mx-auto w-full max-w-md rounded-2xl bg-card p-8 shadow-lg dark:bg-card">
      <h1 className="text-2xl font-semibold text-foreground dark:text-foreground">
        One last step
      </h1>
      <p className="mt-2 text-sm text-muted-foreground dark:text-muted-foreground">
        Your Google account is verified. Review and accept our terms to create your MedTrack account.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-6">
        <label className="flex items-start gap-3 text-sm text-muted-foreground dark:text-muted-foreground">
          <input
            type="checkbox"
            checked={accepted}
            onChange={event => setAccepted(event.target.checked)}
            className="mt-1 h-4 w-4 rounded border-border text-blue-600 focus:ring-blue-500"
          />
          <span>
            I agree to the{' '}
            <Link href="/terms" className="font-medium text-blue-600 underline dark:text-blue-400">
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link href="/privacy" className="font-medium text-blue-600 underline dark:text-blue-400">
              Privacy Policy
            </Link>
            .
          </span>
        </label>

        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-blue-600 px-4 py-3 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? 'Creating account…' : 'Accept and create account'}
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-muted-foreground dark:text-muted-foreground">
        Not now? <Link href="/login" className="font-medium text-blue-600 underline dark:text-blue-400">Return to sign in</Link>
      </p>
    </main>
  );
}

export default function GoogleConsentPage() {
  return (
    <Suspense fallback={<p className="text-center text-sm text-muted-foreground">Loading…</p>}>
      <GoogleConsentContent />
    </Suspense>
  );
}
