'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Save, Settings, Shield } from 'lucide-react';
import { usePermissions } from '@/features/auth/hooks/usePermissions';
import { Role } from '@/shared/enums/role.enum';
import {
  settingsService,
  type SystemSettings,
} from '@/features/admin/services/settingsService';

const DEFAULT_SETTINGS: SystemSettings = {
  platformName: '',
  platformDescription: '',
  maintenanceMode: false,
  passwordPolicy: {
    requireStrong: true,
    minLength: 8,
    requireSpecialChars: true,
  },
  twoFactorAuthRequired: false,
  sessionTimeout: 120,
};

export default function AdminSettingsPage() {
  const { allRoles } = usePermissions();
  const isAdmin = allRoles?.includes(Role.admin);
  const [settings, setSettings] = useState<SystemSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;
    let active = true;
    settingsService
      .getSettings()
      .then(value => {
        if (active) {
          setSettings(value);
          setLoadError('');
        }
      })
      .catch(error => {
        console.error('Could not load system settings:', error);
        if (active) setLoadError('System settings could not be loaded. Reload before editing.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [isAdmin]);

  const saveSettings = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setSaveError('');
    setSaved(false);
    try {
      setSettings(await settingsService.updateSettings(settings));
      setSaved(true);
    } catch (error) {
      console.error('Could not save system settings:', error);
      setSaveError('System settings could not be saved. Your changes have not been applied.');
    } finally {
      setSaving(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="py-8 text-center">
        <h2 className="mb-2 text-2xl font-bold text-red-600">Access Denied</h2>
        <p className="text-gray-600">You must be an administrator to access this page.</p>
      </div>
    );
  }

  if (loading) {
    return <p className="p-6" role="status">Loading system settings...</p>;
  }

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-bold">System Settings</h1>
        <p className="mt-1 text-sm text-gray-600">
          Persisted settings are applied globally to platform authentication and availability.
        </p>
      </header>

      {loadError && (
        <p className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800" role="alert">
          {loadError}
        </p>
      )}

      <form onSubmit={saveSettings} className="space-y-6">
        <section className="space-y-5 rounded-lg border bg-white p-6 shadow-sm">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Settings className="h-5 w-5" aria-hidden="true" />
            General
          </h2>
          <div>
            <label htmlFor="platform-name" className="block text-sm font-medium">Platform name</label>
            <input
              id="platform-name"
              required
              maxLength={80}
              value={settings.platformName}
              onChange={event => setSettings(current => ({ ...current, platformName: event.target.value }))}
              className="mt-1 block w-full rounded-md border px-3 py-2"
            />
          </div>
          <div>
            <label htmlFor="platform-description" className="block text-sm font-medium">
              Platform description
            </label>
            <textarea
              id="platform-description"
              maxLength={500}
              rows={3}
              value={settings.platformDescription}
              onChange={event => setSettings(current => ({ ...current, platformDescription: event.target.value }))}
              className="mt-1 block w-full rounded-md border px-3 py-2"
            />
          </div>
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={settings.maintenanceMode}
              onChange={event => setSettings(current => ({ ...current, maintenanceMode: event.target.checked }))}
            />
            <span>
              <span className="block text-sm font-medium">Maintenance mode</span>
              <span className="block text-sm text-gray-600">
                Blocks platform API routes while preserving authentication and admin access.
              </span>
            </span>
          </label>
        </section>

        <section className="space-y-5 rounded-lg border bg-white p-6 shadow-sm">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Shield className="h-5 w-5" aria-hidden="true" />
            Security
          </h2>
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={settings.passwordPolicy.requireStrong}
              onChange={event =>
                setSettings(current => ({
                  ...current,
                  passwordPolicy: { ...current.passwordPolicy, requireStrong: event.target.checked },
                }))
              }
            />
            <span className="text-sm font-medium">Require uppercase, lowercase, and numeric characters</span>
          </label>
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={settings.passwordPolicy.requireSpecialChars}
              onChange={event =>
                setSettings(current => ({
                  ...current,
                  passwordPolicy: {
                    ...current.passwordPolicy,
                    requireSpecialChars: event.target.checked,
                  },
                }))
              }
            />
            <span className="text-sm font-medium">Require a special character</span>
          </label>
          <div>
            <label htmlFor="password-min-length" className="block text-sm font-medium">
              Minimum password length
            </label>
            <input
              id="password-min-length"
              type="number"
              min={8}
              max={128}
              required
              value={settings.passwordPolicy.minLength}
              onChange={event =>
                setSettings(current => ({
                  ...current,
                  passwordPolicy: {
                    ...current.passwordPolicy,
                    minLength: Number(event.target.value),
                  },
                }))
              }
              className="mt-1 block w-32 rounded-md border px-3 py-2"
            />
          </div>
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={settings.twoFactorAuthRequired}
              onChange={event =>
                setSettings(current => ({ ...current, twoFactorAuthRequired: event.target.checked }))
              }
            />
            <span>
              <span className="block text-sm font-medium">Require two-factor authentication</span>
              <span className="block text-sm text-gray-600">
                Users without 2FA are restricted to authenticator setup until verified.
              </span>
            </span>
          </label>
          <div>
            <label htmlFor="session-timeout" className="block text-sm font-medium">Session timeout</label>
            <select
              id="session-timeout"
              value={settings.sessionTimeout}
              onChange={event =>
                setSettings(current => ({
                  ...current,
                  sessionTimeout: Number(event.target.value) as SystemSettings['sessionTimeout'],
                }))
              }
              className="mt-1 block rounded-md border px-3 py-2"
            >
              <option value={15}>15 minutes</option>
              <option value={30}>30 minutes</option>
              <option value={60}>1 hour</option>
              <option value={120}>2 hours</option>
            </select>
          </div>
        </section>

        {settings.maintenanceMode && (
          <p className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            Saving will enable maintenance mode immediately for non-admin platform API requests.
          </p>
        )}
        {saveError && <p className="text-sm text-red-700" role="alert">{saveError}</p>}
        {saved && <p className="text-sm text-green-700" role="status">System settings saved.</p>}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving || Boolean(loadError)}
            className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
          >
            <Save className="h-4 w-4" aria-hidden="true" />
            {saving ? 'Saving...' : 'Save system settings'}
          </button>
        </div>
      </form>
    </main>
  );
}
