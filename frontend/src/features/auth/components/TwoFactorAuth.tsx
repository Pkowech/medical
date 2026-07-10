// frontend/src/components/settings/TwoFactorAuth.tsx

'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Switch } from '@/shared/components/ui/switch';
import { Label } from '@/shared/components/ui/label';
import {
  getTwoFactorAuthStatus,
  enableTwoFactorAuth,
  disableTwoFactorAuth,
} from '@/features/auth/services/securityService';

import type { TwoFactorAuthStatus } from '@/shared/types/systemInterface';
import { Lock } from 'lucide-react';

export const TwoFactorAuth: React.FC = () => {
  const [status, setStatus] = useState<TwoFactorAuthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  const fetchStatus = async () => {
    try {
      const fetchedStatus = await getTwoFactorAuthStatus();
      setStatus(fetchedStatus);
    } catch (err) {
      setError('Failed to fetch 2FA status.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleToggle2FA = async (checked: boolean) => {
    setIsUpdating(true);
    try {
      if (checked) {
        // In a real app, this would trigger a flow to set up 2FA (e.g., QR code, SMS verification)
        // For mock, we'll just enable it with a default method
        const updatedStatus = await enableTwoFactorAuth('app');
        setStatus(updatedStatus);
        alert('Two-factor authentication enabled!');
      } else {
        const updatedStatus = await disableTwoFactorAuth();
        setStatus(updatedStatus);
        alert('Two-factor authentication disabled.');
      }
    } catch (err) {
      setError('Failed to update 2FA status.');
      console.error(err);
    } finally {
      setIsUpdating(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 text-center">Loading 2FA status...</CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-red-500">Error: {error}</CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Lock className="mr-2" /> Two-Factor Authentication
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <Label htmlFor="2fa-switch" className="text-base">
            Enable 2FA
          </Label>
          <Switch
            id="2fa-switch"
            checked={status?.enabled}
            onCheckedChange={handleToggle2FA}
            disabled={isUpdating}
          />
        </div>
        {status?.enabled ? (
          <p className="text-sm text-muted-foreground">
            2FA is currently enabled using the <strong>{status.method}</strong> method.
            {status.lastEnabledAt && (
              <span> Last enabled on {new Date(status.lastEnabledAt).toLocaleDateString()}.</span>
            )}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Two-factor authentication adds an extra layer of security to your account.
          </p>
        )}
        {isUpdating && <p className="text-sm text-blue-500">Updating 2FA status...</p>}
      </CardContent>
    </Card>
  );
};
