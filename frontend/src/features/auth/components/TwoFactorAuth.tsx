// frontend/src/components/settings/TwoFactorAuth.tsx

'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { authService } from '@/features/auth/services/authService';

export const TwoFactorAuth: React.FC<{ requiredSetup?: boolean }> = ({
  requiredSetup = false,
}) => {
  const { update } = useSession();
  const router = useRouter();
  const [enabled, setEnabled] = useState(false);
  const [setup, setSetup] = useState<{ secret: string; qrCode: string } | null>(null);
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (requiredSetup) {
      setLoading(false);
      return;
    }
    authService
      .getSecuritySettings()
      .then(settings => setEnabled(settings.twoFactorEnabled))
      .catch((err: unknown) => {
        console.error('Failed to fetch two-factor authentication settings:', err);
        setError('Could not load two-factor authentication settings.');
      })
      .finally(() => setLoading(false));
  }, [requiredSetup]);

  const handleEnable = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsUpdating(true);
    setError(null);
    try {
      const result = await authService.verifyTwoFactorAuth(token);
      if (requiredSetup) {
        if (!result.auth?.accessToken || !result.auth.refreshToken || !result.auth.expiresAt) {
          throw new Error('Two-factor setup succeeded but the session could not be renewed.');
        }
        await update({
          user: {
            mfaSetupRequired: false,
            accessToken: result.auth.accessToken,
            refreshToken: result.auth.refreshToken,
            accessTokenExpires: new Date(result.auth.expiresAt).getTime(),
          },
        });
        router.replace('/dashboard');
        return;
      }
      setEnabled(true);
      setSetup(null);
      setToken('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not enable two-factor authentication.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleBeginSetup = async () => {
    setIsUpdating(true);
    setError(null);
    try {
      setSetup(await authService.setupTwoFactorAuth());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not start two-factor setup.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDisable = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsUpdating(true);
    setError(null);
    try {
      await authService.disableTwoFactorAuth(token);
      setEnabled(false);
      setToken('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not disable two-factor authentication.');
    } finally {
      setIsUpdating(false);
    }
  };

  if (loading) return <p role="status">Loading two-factor settings...</p>;

  return (
    <div className="space-y-3 border-t pt-4">
      <div>
        <h3 className="font-medium">Two-Factor Authentication</h3>
        <p className="text-sm text-muted-foreground">
          {enabled
            ? 'Two-factor authentication is enabled.'
            : 'Add an authenticator app as a second sign-in step.'}
        </p>
      </div>
      {enabled && !requiredSetup ? (
        <form onSubmit={handleDisable} className="space-y-3">
          <label htmlFor="disable-2fa-token" className="block text-sm font-medium">
            Authenticator code to disable 2FA
          </label>
          <input
            id="disable-2fa-token"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            value={token}
            onChange={event => setToken(event.target.value)}
            required
            className="w-full rounded-md border border-border px-3 py-2"
          />
          <button type="submit" disabled={isUpdating} className="text-sm underline disabled:opacity-50">
            {isUpdating ? 'Updating...' : 'Disable 2FA'}
          </button>
        </form>
      ) : setup ? (
        <form onSubmit={handleEnable} className="space-y-3">
          <Image
            src={setup.qrCode}
            alt="Authenticator app setup QR code"
            width={192}
            height={192}
            unoptimized
          />
          <p className="text-sm text-muted-foreground">
            Scan the code with your authenticator app. If scanning is unavailable, enter this
            setup key: <code>{setup.secret}</code>
          </p>
          <label htmlFor="enable-2fa-token" className="block text-sm font-medium">
            Enter the six-digit code from your app
          </label>
          <input
            id="enable-2fa-token"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            value={token}
            onChange={event => setToken(event.target.value)}
            required
            className="w-full rounded-md border border-border px-3 py-2"
          />
          <button type="submit" disabled={isUpdating} className="text-sm underline disabled:opacity-50">
            {isUpdating
              ? 'Verifying...'
              : requiredSetup
                ? 'Verify and continue'
                : 'Verify and enable'}
          </button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => void handleBeginSetup()}
          disabled={isUpdating}
          className="text-sm underline disabled:opacity-50"
        >
          {isUpdating ? 'Starting setup...' : 'Set up authenticator app'}
        </button>
      )}
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    </div>
  );
};
