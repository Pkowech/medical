'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Switch } from '@/shared/components/ui/switch';
import useRequireAuth from '@/features/auth/hooks/useRequireAuth';
import { apiService } from '@/features/auth/services/apiClient';
import AppErrorBoundary from '@/features/security/components/AppErrorBoundary';
import { toast } from 'sonner';
import { Bell, Globe, Moon, Shield, Sun, User } from 'lucide-react';
import { Settings } from '@/shared/types';
import { useAuthStore } from '@/features/auth/store/useAuthStore';
import { useTheme } from '@/app/providers';
import { changePasswordSchema, usernameSchema } from '@/lib/auth/validations';
import { getAuthErrorDetails } from '@/features/auth/services/authErrors';
import { TwoFactorAuth } from '@/features/auth/components/TwoFactorAuth';
import { PushNotificationSettings } from '@/features/community/PushNotificationSettings';
import { userService } from '@/features/profile/services/userService';
import { authService } from '@/features/auth/services/authService';

interface UserSettings {
  email: string;
  theme: 'light' | 'dark' | 'system';
  emailNotifications: boolean;
  pushNotifications: boolean;
  weeklyDigest: boolean;
  loginNotifications: boolean;
  language: string;
  timezone: string;
  showProgress: boolean;
  profileVisibility: 'public' | 'private';
  showEmail: boolean;
  showPhone: boolean;
  showLocation: boolean;
  allowMessages: boolean;
}

const DEFAULT_USER_SETTINGS: UserSettings = {
  email: '',
  theme: 'system',
  emailNotifications: true,
  pushNotifications: false,
  weeklyDigest: true,
  loginNotifications: true,
  language: 'en',
  timezone: 'Africa/Nairobi',
  showProgress: true,
  profileVisibility: 'public',
  showEmail: false,
  showPhone: false,
  showLocation: false,
  allowMessages: true,
};

export default function SettingsPage() {
  const { isLoading, session } = useRequireAuth();
  const { update: updateSession } = useSession();
  const router = useRouter();
  const { setTheme } = useTheme();
  const changePassword = useAuthStore(state => state.changePassword);
  const [saving, setSaving] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [settingsLoadFailed, setSettingsLoadFailed] = useState(false);
  const [settingsRetryCount, setSettingsRetryCount] = useState(0);
  const [saveMessage, setSaveMessage] = useState('');
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [passwordFormError, setPasswordFormError] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [username, setUsername] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const [savingUsername, setSavingUsername] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  const [settings, setSettings] = useState<UserSettings>(DEFAULT_USER_SETTINGS);
  const [savedSettings, setSavedSettings] = useState<UserSettings>(DEFAULT_USER_SETTINGS);
  const hasUnsavedChanges = JSON.stringify(settings) !== JSON.stringify(savedSettings);

  useEffect(() => {
    const fetchSettings = async () => {
      setInitialLoading(true);
      setSettingsLoadFailed(false);
      try {
        const response = await apiService.get<Settings>('/users/settings');
        const profileVisibility = response.data.privacy?.profileVisibility;
        const validVisibility: 'public' | 'private' =
          profileVisibility === 'public' || profileVisibility === 'private'
            ? profileVisibility
            : 'public';

        const loadedSettings: UserSettings = {
          email: response.data.email || '',
          theme: response.data.theme || 'system',
          language: response.data.preferences?.language || 'en',
          timezone: response.data.preferences?.timezone || 'Africa/Nairobi',
          emailNotifications: response.data.notifications?.email ?? true,
          pushNotifications: response.data.notifications?.push ?? false,
          weeklyDigest: response.data.notifications?.weeklyDigest ?? true,
          loginNotifications: response.data.security?.loginNotifications ?? true,
          showProgress: response.data.notifications?.progress ?? true,
          profileVisibility: validVisibility,
          showEmail: response.data.privacy?.showEmail ?? false,
          showPhone: response.data.privacy?.showPhone ?? false,
          showLocation: response.data.privacy?.showLocation ?? false,
          allowMessages: response.data.privacy?.allowMessages ?? true,
        };
        setUsername(response.data.username || '');
        setSettings(loadedSettings);
        setSavedSettings(loadedSettings);
        setTheme(loadedSettings.theme);
      } catch (error) {
        console.error('Error loading settings:', error);
        toast.error('Failed to load settings');
        setSettingsLoadFailed(true);
      } finally {
        setInitialLoading(false);
      }
    };

    if (session?.user?.id) {
      fetchSettings();
    }
  }, [session?.user?.id, setTheme, settingsRetryCount]);

  useEffect(() => {
    if (!hasUnsavedChanges) return;

    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', warnBeforeUnload);
    return () => window.removeEventListener('beforeunload', warnBeforeUnload);
  }, [hasUnsavedChanges]);

  const handleThemeChange = (theme: 'light' | 'dark' | 'system') => {
    setSettings(prev => ({ ...prev, theme }));
    setSaveMessage('');
    setTheme(theme);
  };

  const handleDiscardChanges = () => {
    setSettings(savedSettings);
    setSaveMessage('');
    setTheme(savedSettings.theme);
    toast.info('Unsaved changes discarded.');
  };

  const handleChangePassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPasswordFormError('');

    const validation = changePasswordSchema.safeParse(passwordForm);
    if (!validation.success) {
      setPasswordFormError(validation.error.issues[0]?.message ?? 'Check the password fields.');
      return;
    }

    setChangingPassword(true);
    try {
      await changePassword(
        passwordForm.currentPassword,
        passwordForm.newPassword,
        passwordForm.confirmPassword
      );
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      toast.success('Password changed successfully.');
    } catch (error: unknown) {
      const authError = getAuthErrorDetails(error, 'Could not change your password.');
      setPasswordFormError(authError.message);
      toast.error(authError.message);
    } finally {
      setChangingPassword(false);
    }
  };

  const handleSaveUsername = async () => {
    setUsernameError('');
    const normalizedUsername = username.trim().toLowerCase();
    const validation = usernameSchema.safeParse(normalizedUsername);
    if (!validation.success) {
      const message = validation.error.issues[0]?.message ?? 'Enter a valid username.';
      setUsernameError(message);
      return;
    }
    if (!session?.user?.id) {
      setUsernameError('You must be signed in to update your username.');
      return;
    }

    setSavingUsername(true);
    try {
      await userService.updateUserProfile(session.user.id, { username: normalizedUsername });
      await updateSession({
        user: { ...session.user, username: normalizedUsername },
      });
      setUsername(normalizedUsername);
      toast.success('Username updated successfully.');
    } catch (error: unknown) {
      const message = getAuthErrorDetails(error, 'Could not update your username.').message;
      setUsernameError(message);
      toast.error(message);
    } finally {
      setSavingUsername(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (
      !window.confirm(
        'Permanently delete your account and associated learning data? This cannot be undone.'
      )
    ) {
      return;
    }

    setDeletingAccount(true);
    try {
      await apiService.delete('/users/me');
      await authService.logout();
    } catch (error: unknown) {
      const message = getAuthErrorDetails(error, 'Could not delete your account.').message;
      toast.error(message);
      setDeletingAccount(false);
    }
  };

  const handleToggle = (
    key: keyof Omit<UserSettings, 'email' | 'theme' | 'language' | 'timezone' | 'profileVisibility'>
  ) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
    setSaveMessage('');
  };

  const handleInputChange = (field: string, value: string | boolean) => {
    setSettings(prev => ({ ...prev, [field]: value }));
    setSaveMessage('');
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    setSaveMessage('');

    try {
      await apiService.put('/users/settings', {
        theme: settings.theme,
        notifications: {
          email: settings.emailNotifications,
          push: settings.pushNotifications,
          weeklyDigest: settings.weeklyDigest,
          progress: settings.showProgress,
        },
        security: {
          loginNotifications: settings.loginNotifications,
        },
        preferences: {
          language: settings.language,
          timezone: settings.timezone,
        },
        privacy: {
          profileVisibility: settings.profileVisibility,
          showEmail: settings.showEmail,
          showPhone: settings.showPhone,
          showLocation: settings.showLocation,
          allowMessages: settings.allowMessages,
        },
      });
      setSavedSettings(settings);
      toast.success('Settings updated successfully');
      setSaveMessage('Settings saved successfully');
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (error: unknown) {
      console.error('Error saving settings:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to save settings');
      setSaveMessage('Error saving settings');
    } finally {
      setSaving(false);
    }
  };

  if (isLoading || initialLoading) {
    return (
      <div className="flex items-center justify-center min-h-[80vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <AppErrorBoundary>
      <div className="space-y-6">
        {settingsLoadFailed && (
          <div
            role="alert"
            className="flex flex-col gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <p className="text-sm text-destructive">
              Settings could not be loaded. Retry before saving so existing preferences are not overwritten.
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={() => setSettingsRetryCount(count => count + 1)}
            >
              Retry
            </Button>
          </div>
        )}

        <div className="flex flex-col gap-4 rounded-lg border bg-card/95 p-4 shadow-sm backdrop-blur lg:sticky lg:top-4 lg:z-20 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium">
              {hasUnsavedChanges ? 'Unsaved changes' : 'All changes saved'}
            </p>
            {saveMessage && !hasUnsavedChanges && (
              <p role="status" className="mt-1 text-xs text-muted-foreground">
                {saveMessage}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleDiscardChanges}
              disabled={!hasUnsavedChanges || saving}
            >
              Discard changes
            </Button>
            <Button
              type="button"
              onClick={handleSaveSettings}
              disabled={saving || settingsLoadFailed || !hasUnsavedChanges}
            >
              {saving ? 'Saving...' : 'Save changes'}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[200px_minmax(0,1fr)]">
          <nav
            aria-label="Settings sections"
            className="flex flex-wrap gap-2 self-start lg:sticky lg:top-28 lg:flex-col"
          >
            {[
              ['account-settings', 'Account'],
              ['appearance-settings', 'Appearance'],
              ['notification-settings', 'Notifications'],
              ['security-settings', 'Security'],
              ['privacy-settings', 'Privacy'],
            ].map(([id, label]) => (
              <a
                key={id}
                href={`#${id}`}
                className="rounded-md border px-3 py-2 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {label}
              </a>
            ))}
          </nav>

          <div className="grid grid-cols-1 gap-6">
          {/* Profile Section */}
          <Card id="account-settings" className="scroll-mt-28">
            <CardHeader>
              <CardTitle className="flex items-center">
                <User className="h-5 w-5 mr-2" />
                Profile
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center space-x-4">
                  <div className="h-16 w-16 rounded-full bg-secondary text-muted-foreground dark:bg-secondary dark:text-muted-foreground flex items-center justify-center text-xl font-bold">
                    {session?.user?.name?.charAt(0) || 'U'}
                  </div>
                  <div>
                    <h3 className="font-medium">{session?.user?.name || 'User'}</h3>
                    <p className="text-sm text-muted-foreground dark:text-muted-foreground">
                      {session?.user?.email || 'user@example.com'}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="account-username" className="block text-sm font-medium">
                    Username
                  </label>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                      id="account-username"
                      autoComplete="username"
                      value={username}
                      onChange={event => {
                        setUsername(event.target.value);
                        setUsernameError('');
                      }}
                      maxLength={30}
                      placeholder="Choose a username"
                      aria-describedby={usernameError ? 'account-username-error' : undefined}
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={handleSaveUsername}
                      disabled={savingUsername || !username.trim()}
                    >
                      {savingUsername ? 'Saving...' : 'Save username'}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Use 3–30 letters, numbers, underscores, or hyphens.
                  </p>
                  {usernameError && (
                    <p id="account-username-error" role="alert" className="text-sm text-red-600">
                      {usernameError}
                    </p>
                  )}
                </div>

                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => router.push('/profile/edit')}
                >
                  Edit Profile
                </Button>
              </div>
            </CardContent>
            </Card>

          {/* Email Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Bell className="h-5 w-5 mr-2" />
                Email Settings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Email Address</label>
                  <Input type="email" value={settings.email} readOnly disabled />
                  <p className="mt-1 text-xs text-muted-foreground dark:text-muted-foreground">
                    Contact support to change the email address on your account.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Appearance Section */}
          <Card id="appearance-settings" className="scroll-mt-28">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Sun className="h-5 w-5 mr-2" />
                Appearance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Theme</label>
                  <div className="flex space-x-2">
                    <button
                      type="button"
                      aria-pressed={settings.theme === 'light'}
                      className={`px-4 py-2 rounded-md ${
                        settings.theme === 'light'
                          ? 'bg-blue-100 text-blue-700 border border-blue-300 dark:bg-blue-950 dark:text-blue-200 dark:border-blue-700'
                          : 'bg-muted text-muted-foreground border border-border dark:bg-card dark:text-muted-foreground dark:border-border'
                      }`}
                      onClick={() => handleThemeChange('light')}
                    >
                      <Sun className="h-4 w-4 inline mr-1" />
                      Light
                    </button>
                    <button
                      type="button"
                      aria-pressed={settings.theme === 'dark'}
                      className={`px-4 py-2 rounded-md ${
                        settings.theme === 'dark'
                          ? 'bg-blue-100 text-blue-700 border border-blue-300 dark:bg-blue-950 dark:text-blue-200 dark:border-blue-700'
                          : 'bg-muted text-muted-foreground border border-border dark:bg-card dark:text-muted-foreground dark:border-border'
                      }`}
                      onClick={() => handleThemeChange('dark')}
                    >
                      <Moon className="h-4 w-4 inline mr-1" />
                      Dark
                    </button>
                    <button
                      type="button"
                      aria-pressed={settings.theme === 'system'}
                      className={`px-4 py-2 rounded-md ${
                        settings.theme === 'system'
                          ? 'bg-blue-100 text-blue-700 border border-blue-300 dark:bg-blue-950 dark:text-blue-200 dark:border-blue-700'
                          : 'bg-muted text-muted-foreground border border-border dark:bg-card dark:text-muted-foreground dark:border-border'
                      }`}
                      onClick={() => handleThemeChange('system')}
                    >
                      System
                    </button>
                  </div>
                </div>

                <div>
                  <label htmlFor="language-select" className="block text-sm font-medium mb-2">
                    Language
                  </label>
                  <select
                    id="language-select"
                    className="w-full px-3 py-2 border border-border rounded-md dark:bg-card dark:text-muted-foreground dark:border-border"
                    value={settings.language}
                    onChange={e => handleInputChange('language', e.target.value)}
                  >
                    <option value="en">English</option>
                    <option value="es">Spanish</option>
                    <option value="fr">French</option>
                    <option value="de">German</option>
                    <option value="sw">Swahili</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="timezone-select" className="block text-sm font-medium mb-2">
                    Timezone
                  </label>
                  <select
                    id="timezone-select"
                    className="w-full px-3 py-2 border border-border rounded-md dark:bg-card dark:text-muted-foreground dark:border-border"
                    value={settings.timezone}
                    onChange={e => handleInputChange('timezone', e.target.value)}
                  >
                    <option value="Africa/Nairobi">Nairobi (GMT+3)</option>
                    <option value="Africa/Dar_es_Salaam">Dar es Salaam (GMT+3)</option>
                    <option value="Africa/Kampala">Kampala (GMT+3)</option>
                    <option value="UTC">UTC</option>
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Notifications Section */}
          <Card id="notification-settings" className="scroll-mt-28">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Bell className="h-5 w-5 mr-2" />
                Notifications
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">Email Notifications</h3>
                    <p className="text-sm text-muted-foreground dark:text-muted-foreground">
                      Receive notifications via email
                    </p>
                  </div>
                  <Switch
                    checked={settings.emailNotifications}
                    onCheckedChange={() => handleToggle('emailNotifications')}
                  />
                </div>

                <PushNotificationSettings
                  enabled={settings.pushNotifications}
                  onEnabledChange={enabled => {
                    setSettings(previous => ({ ...previous, pushNotifications: enabled }));
                    setSaveMessage('');
                  }}
                />

                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">Weekly Digest</h3>
                    <p className="text-sm text-muted-foreground dark:text-muted-foreground">
                      Receive a weekly summary of your progress
                    </p>
                  </div>
                  <Switch
                    checked={settings.weeklyDigest}
                    onCheckedChange={() => handleToggle('weeklyDigest')}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">Show Progress Updates</h3>
                    <p className="text-sm text-muted-foreground dark:text-muted-foreground">
                      Receive notifications about your progress
                    </p>
                  </div>
                  <Switch
                    checked={settings.showProgress}
                    onCheckedChange={() => handleToggle('showProgress')}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Security Section */}
          <Card id="security-settings" className="scroll-mt-28">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Shield className="h-5 w-5 mr-2" />
                Security
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="border-b pb-4">
                  <TwoFactorAuth />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">Login Notifications</h3>
                    <p className="text-sm text-muted-foreground dark:text-muted-foreground">
                      Get notified of new login attempts
                    </p>
                  </div>
                  <Switch
                    checked={settings.loginNotifications}
                    onCheckedChange={() => handleToggle('loginNotifications')}
                  />
                </div>

                <form onSubmit={handleChangePassword} className="space-y-3 border-t pt-4">
                  <h3 className="font-medium">Change Password</h3>
                  <Input
                    type="password"
                    autoComplete="current-password"
                    aria-label="Current password"
                    placeholder="Current password"
                    value={passwordForm.currentPassword}
                    onChange={event =>
                      setPasswordForm(prev => ({ ...prev, currentPassword: event.target.value }))
                    }
                    required
                  />
                  <Input
                    type="password"
                    autoComplete="new-password"
                    aria-label="New password"
                    placeholder="New password"
                    value={passwordForm.newPassword}
                    onChange={event =>
                      setPasswordForm(prev => ({ ...prev, newPassword: event.target.value }))
                    }
                    required
                  />
                  <Input
                    type="password"
                    autoComplete="new-password"
                    aria-label="Confirm new password"
                    placeholder="Confirm new password"
                    value={passwordForm.confirmPassword}
                    onChange={event =>
                      setPasswordForm(prev => ({ ...prev, confirmPassword: event.target.value }))
                    }
                    required
                  />
                  <p className="text-xs text-muted-foreground dark:text-muted-foreground">
                    Use at least 8 characters with uppercase and lowercase letters, a number, and a
                    special character.
                  </p>
                  {passwordFormError && (
                    <p role="alert" className="text-sm text-red-600">
                      {passwordFormError}
                    </p>
                  )}
                  <Button type="submit" variant="secondary" size="sm" disabled={changingPassword}>
                    {changingPassword ? 'Changing password...' : 'Update password'}
                  </Button>
                </form>

                <div className="border-t pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => router.push('/profile/sessions')}
                  >
                    Manage active sessions
                  </Button>
                </div>

              </div>
            </CardContent>
          </Card>

          <Card className="border-destructive/40">
            <CardHeader>
              <CardTitle>Delete account</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Permanently remove your account and associated personal learning data. This action
                cannot be undone.
              </p>
              <Button
                type="button"
                variant="destructive"
                onClick={handleDeleteAccount}
                disabled={deletingAccount}
              >
                {deletingAccount ? 'Deleting account...' : 'Delete my account'}
              </Button>
            </CardContent>
          </Card>

          {/* Privacy Section */}
          <Card id="privacy-settings" className="scroll-mt-28">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Globe className="h-5 w-5 mr-2" />
                Privacy
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <label htmlFor="visibility-select" className="block text-sm font-medium mb-2">
                    Profile Visibility
                  </label>
                  <select
                    id="visibility-select"
                    className="w-full px-3 py-2 border border-border rounded-md dark:bg-card dark:text-muted-foreground dark:border-border"
                    value={settings.profileVisibility}
                    onChange={e => handleInputChange('profileVisibility', e.target.value)}
                  >
                    <option value="public">Public</option>
                    <option value="private">Private</option>
                  </select>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">Show Email</h3>
                    <p className="text-sm text-muted-foreground dark:text-muted-foreground">
                      Display email on your profile
                    </p>
                  </div>
                  <Switch
                    checked={settings.showEmail}
                    onCheckedChange={() => handleToggle('showEmail')}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">Show Phone</h3>
                    <p className="text-sm text-muted-foreground dark:text-muted-foreground">
                      Display phone number on your profile
                    </p>
                  </div>
                  <Switch
                    checked={settings.showPhone}
                    onCheckedChange={() => handleToggle('showPhone')}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">Show Location</h3>
                    <p className="text-sm text-muted-foreground dark:text-muted-foreground">
                      Display location on your profile
                    </p>
                  </div>
                  <Switch
                    checked={settings.showLocation}
                    onCheckedChange={() => handleToggle('showLocation')}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">Allow Messages</h3>
                    <p className="text-sm text-muted-foreground dark:text-muted-foreground">
                      Allow others to message you
                    </p>
                  </div>
                  <Switch
                    checked={settings.allowMessages}
                    onCheckedChange={() => handleToggle('allowMessages')}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
          </div>
        </div>
      </div>
    </AppErrorBoundary>
  );
}
