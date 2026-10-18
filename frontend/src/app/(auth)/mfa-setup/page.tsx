'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { TwoFactorAuth } from '@/features/auth/components/TwoFactorAuth';

export default function RequiredMfaSetupPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
    if (status === 'authenticated' && !session.user?.mfaSetupRequired) {
      router.replace('/dashboard');
    }
  }, [router, session?.user?.mfaSetupRequired, status]);

  if (status !== 'authenticated' || !session.user?.mfaSetupRequired) {
    return <p className="p-8 text-center" role="status">Loading required security setup...</p>;
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-xl items-center px-6 py-12">
      <section className="w-full space-y-5 rounded-lg border bg-card p-6 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold">Secure your account</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your organization requires two-factor authentication. Set up an authenticator app to
            continue to the platform.
          </p>
        </div>
        <TwoFactorAuth requiredSetup />
      </section>
    </main>
  );
}
