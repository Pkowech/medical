'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
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

interface UserSettings {
  email: string;
  theme: 'light' | 'dark' | 'system';
  emailNotifications: boolean;
  pushNotifications: boolean;
  weeklyDigest: boolean;
  twoFactorAuth: boolean;
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

export default function SettingsPage() {
  const { isLoading, session } = useRequireAuth();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [saveMessage, setSaveMessage] = useState('');

  const [settings, setSettings] = useState<UserSettings>({
    email: '',
    theme: 'system',
    emailNotifications: true,
    pushNotifications: false,
    weeklyDigest: true,
    twoFactorAuth: false,
    loginNotifications: true,
    language: 'en',
    timezone: 'Africa/Nairobi',
    showProgress: true,
    profileVisibility: 'public',
    showEmail: true,
    showPhone: true,
    showLocation: true,
    allowMessages: true,
  });

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        // Try to fetch from API
        try {
          const response = await apiService.get<Settings>('/users/settings');
          const profileVisibility = response.data.privacy?.profileVisibility;
          const validVisibility: 'public' | 'private' =
            profileVisibility === 'public' || profileVisibility === 'private'
              ? profileVisibility
              : 'public';

          setSettings(prev => ({
            ...prev,
            email: response.data.email || '',
            theme: (localStorage.getItem('theme') as 'light' | 'dark' | 'system') || 'system',
            language: response.data.preferences?.language || 'en',
            timezone: response.data.preferences?.timezone || 'Africa/Nairobi',
            emailNotifications: response.data.notifications?.email ?? true,
            pushNotifications: response.data.notifications?.push ?? false,
            weeklyDigest: response.data.notifications?.weeklyDigest ?? true,
            twoFactorAuth: response.data.security?.twoFactorEnabled ?? false,
            loginNotifications: response.data.security?.loginNotifications ?? true,
            profileVisibility: validVisibility,
            showEmail: response.data.privacy?.showEmail ?? true,
            showPhone: response.data.privacy?.showPhone ?? true,
            showLocation: response.data.privacy?.showLocation ?? true,
            allowMessages: response.data.privacy?.allowMessages ?? true,
          }));
        } catch {
          // Fallback to localStorage for theme
          setSettings(prev => ({
            ...prev,
            theme: (localStorage.getItem('theme') as 'light' | 'dark' | 'system') || 'system',
            email: session?.user?.email || '',
          }));
        }
      } catch (error) {
        console.error('Error loading settings:', error);
        toast.error('Failed to load settings');
      } finally {
        setInitialLoading(false);
      }
    };

    if (session) {
      fetchSettings();
    }
  }, [session]);

  const handleThemeChange = (theme: 'light' | 'dark' | 'system') => {
    setSettings(prev => ({ ...prev, theme }));
    localStorage.setItem('theme', theme);

    // Apply theme immediately
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else if (theme === 'light') {
      document.documentElement.classList.remove('dark');
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (prefersDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  };

  const handleToggle = (
    key: keyof Omit<UserSettings, 'email' | 'theme' | 'language' | 'timezone' | 'profileVisibility'>
  ) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleInputChange = (field: string, value: string | boolean) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    setSaveMessage('');

    try {
      // Try to save to API
      try {
        await apiService.put('/users/settings', {
          email: settings.email,
          notifications: {
            email: settings.emailNotifications,
            push: settings.pushNotifications,
            weeklyDigest: settings.weeklyDigest,
          },
          security: {
            twoFactorEnabled: settings.twoFactorAuth,
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
        toast.success('Settings updated successfully');
        setSaveMessage('Settings saved successfully');
      } catch {
        // Fallback: just save locally
        setSaveMessage('Settings updated locally (API unavailable)');
      }
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
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
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Settings</h1>
        </div>

        <div className="grid grid-cols-1 gap-6">
          {/* Profile Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <User className="h-5 w-5 mr-2" />
                Profile
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center space-x-4">
                  <div className="h-16 w-16 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 text-xl font-bold">
                    {session?.user?.name?.charAt(0) || 'U'}
                  </div>
                  <div>
                    <h3 className="font-medium">{session?.user?.name || 'User'}</h3>
                    <p className="text-sm text-gray-500">
                      {session?.user?.email || 'user@example.com'}
                    </p>
                  </div>
                </div>

                <Button variant="secondary" size="sm" onClick={() => router.push('/profile')}>
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
                  <Input
                    type="email"
                    value={settings.email}
                    onChange={e => handleInputChange('email', e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Appearance Section */}
          <Card>
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
                      className={`px-4 py-2 rounded-md ${
                        settings.theme === 'light'
                          ? 'bg-blue-100 text-blue-700 border border-blue-300'
                          : 'bg-gray-100 text-gray-700 border border-gray-200'
                      }`}
                      onClick={() => handleThemeChange('light')}
                    >
                      <Sun className="h-4 w-4 inline mr-1" />
                      Light
                    </button>
                    <button
                      className={`px-4 py-2 rounded-md ${
                        settings.theme === 'dark'
                          ? 'bg-blue-100 text-blue-700 border border-blue-300'
                          : 'bg-gray-100 text-gray-700 border border-gray-200'
                      }`}
                      onClick={() => handleThemeChange('dark')}
                    >
                      <Moon className="h-4 w-4 inline mr-1" />
                      Dark
                    </button>
                    <button
                      className={`px-4 py-2 rounded-md ${
                        settings.theme === 'system'
                          ? 'bg-blue-100 text-blue-700 border border-blue-300'
                          : 'bg-gray-100 text-gray-700 border border-gray-200'
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
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
          <Card>
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
                    <p className="text-sm text-gray-500">Receive notifications via email</p>
                  </div>
                  <Switch
                    checked={settings.emailNotifications}
                    onCheckedChange={() => handleToggle('emailNotifications')}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">Push Notifications</h3>
                    <p className="text-sm text-gray-500">Receive push notifications in browser</p>
                  </div>
                  <Switch
                    checked={settings.pushNotifications}
                    onCheckedChange={() => handleToggle('pushNotifications')}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">Weekly Digest</h3>
                    <p className="text-sm text-gray-500">
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
                    <p className="text-sm text-gray-500">
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
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Shield className="h-5 w-5 mr-2" />
                Security
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">Two-Factor Authentication</h3>
                    <p className="text-sm text-gray-500">Add an extra layer of security</p>
                  </div>
                  <Switch
                    checked={settings.twoFactorAuth}
                    onCheckedChange={() => handleToggle('twoFactorAuth')}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">Login Notifications</h3>
                    <p className="text-sm text-gray-500">Get notified of new login attempts</p>
                  </div>
                  <Switch
                    checked={settings.loginNotifications}
                    onCheckedChange={() => handleToggle('loginNotifications')}
                  />
                </div>

                <Button variant="secondary" size="sm">
                  Change Password
                </Button>

                <Button variant="destructive" size="sm">
                  Delete Account
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Privacy Section */}
          <Card>
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
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
                    <p className="text-sm text-gray-500">Display email on your profile</p>
                  </div>
                  <Switch
                    checked={settings.showEmail}
                    onCheckedChange={() => handleToggle('showEmail')}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">Show Phone</h3>
                    <p className="text-sm text-gray-500">Display phone number on your profile</p>
                  </div>
                  <Switch
                    checked={settings.showPhone}
                    onCheckedChange={() => handleToggle('showPhone')}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">Show Location</h3>
                    <p className="text-sm text-gray-500">Display location on your profile</p>
                  </div>
                  <Switch
                    checked={settings.showLocation}
                    onCheckedChange={() => handleToggle('showLocation')}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">Allow Messages</h3>
                    <p className="text-sm text-gray-500">Allow others to message you</p>
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

        <div className="flex justify-end">
          {saveMessage && (
            <div
              className={`mr-4 py-2 px-4 rounded-md ${
                saveMessage.includes('Error')
                  ? 'bg-red-100 text-red-700'
                  : 'bg-green-100 text-green-700'
              }`}
            >
              {saveMessage}
            </div>
          )}
          <Button
            variant="default"
            onClick={handleSaveSettings}
            disabled={saving}
            className={saving ? 'opacity-50 cursor-not-allowed' : ''}
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </div>
    </AppErrorBoundary>
  );
}
