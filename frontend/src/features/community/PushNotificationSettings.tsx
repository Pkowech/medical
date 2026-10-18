'use client';

import { useEffect, useState } from 'react';
import { apiService } from '@/features/auth/services/apiClient';
import { Switch } from '@/shared/components/ui/switch';

interface PushNotificationSettingsProps {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
}

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function decodeVapidKey(key: string): ArrayBuffer {
  const padding = '='.repeat((4 - (key.length % 4)) % 4);
  const base64 = (key + padding).replace(/-/g, '+').replace(/_/g, '/');
  const decoded = Uint8Array.from(atob(base64), character => character.charCodeAt(0));
  const buffer = new ArrayBuffer(decoded.length);
  new Uint8Array(buffer).set(decoded);
  return buffer;
}

export function PushNotificationSettings({
  enabled,
  onEnabledChange,
}: PushNotificationSettingsProps) {
  const [supported, setSupported] = useState(false);
  const [isIOSInstallRequired, setIsIOSInstallRequired] = useState(false);
  const [hasSubscription, setHasSubscription] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    const pushSupported =
      'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    const isIOS =
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    setSupported(pushSupported);
    setIsIOSInstallRequired(isIOS && !isStandalone());

    if (!pushSupported) return;
    let active = true;
    void navigator.serviceWorker
      .getRegistration()
      .then(registration => registration?.pushManager.getSubscription())
      .then(subscription => {
        if (active) setHasSubscription(Boolean(subscription));
      })
      .catch(loadError => {
        console.error('[PWA] Could not inspect device push subscription:', loadError);
        if (active) setError('Could not check this device’s notification subscription.');
      });

    return () => {
      active = false;
    };
  }, []);

  const handleChange = async (shouldEnable: boolean) => {
    setError(undefined);
    setIsBusy(true);
    try {
      if (shouldEnable) {
        if (!supported) {
          throw new Error('Push notifications are not supported by this browser.');
        }
        if (Notification.permission === 'denied') {
          throw new Error('Notifications are blocked. Allow them in your browser settings first.');
        }

        const permission =
          Notification.permission === 'granted'
            ? 'granted'
            : await Notification.requestPermission();
        if (permission !== 'granted') {
          throw new Error('Allow notifications to enable push on this device.');
        }

        if (!(await navigator.serviceWorker.getRegistration())) {
          throw new Error(
            'The MedTrack service worker is not ready. Reload the app and try again.'
          );
        }
        const registration = await navigator.serviceWorker.ready;
        const keyResponse = await apiService.get<{ publicKey: string }>(
          '/notifications/push/public-key'
        );
        const publicKey = keyResponse.data.publicKey;
        if (!publicKey) throw new Error('Push notifications are not configured on the server.');

        const subscription =
          (await registration.pushManager.getSubscription()) ??
          (await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: decodeVapidKey(publicKey),
          }));
        const subscriptionJson = subscription.toJSON();
        const p256dh = subscriptionJson.keys?.p256dh;
        const auth = subscriptionJson.keys?.auth;
        if (!subscriptionJson.endpoint || !p256dh || !auth) {
          throw new Error('The browser returned an incomplete push subscription.');
        }
        await apiService.post('/notifications/push/subscriptions', {
          endpoint: subscriptionJson.endpoint,
          p256dh,
          auth,
        });
        setHasSubscription(true);
        onEnabledChange(true);
      } else {
        if (!(await navigator.serviceWorker.getRegistration())) {
          throw new Error(
            'The MedTrack service worker is not ready. Reload the app and try again.'
          );
        }
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          await apiService.delete(
            `/notifications/push/subscriptions?endpoint=${encodeURIComponent(subscription.endpoint)}`
          );
          await subscription.unsubscribe();
        }
        setHasSubscription(false);
        onEnabledChange(false);
      }
    } catch (changeError) {
      console.error('[PWA] Could not update push notification settings:', changeError);
      setError(
        changeError instanceof Error
          ? changeError.message
          : 'Could not update push notification settings.'
      );
    } finally {
      setIsBusy(false);
    }
  };

  const isEnabledOnThisDevice = enabled && hasSubscription;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="font-medium">Push Notifications</h3>
          <p className="text-sm text-muted-foreground dark:text-muted-foreground">
            Receive reminders on this device, even when MedTrack is closed.
          </p>
        </div>
        <Switch
          checked={isEnabledOnThisDevice}
          onCheckedChange={checked => void handleChange(checked)}
          disabled={isBusy || !supported || isIOSInstallRequired}
          aria-label="Enable push notifications on this device"
        />
      </div>
      {isIOSInstallRequired && (
        <p className="text-xs text-muted-foreground dark:text-muted-foreground">
          On iPhone and iPad, add MedTrack to your Home Screen before enabling notifications.
        </p>
      )}
      {supported && !isIOSInstallRequired && !hasSubscription && enabled && (
        <p className="text-xs text-muted-foreground dark:text-muted-foreground">
          Push notifications are enabled for your account; turn this on to add this device.
        </p>
      )}
      {!supported && (
        <p className="text-xs text-muted-foreground dark:text-muted-foreground">
          This browser does not support push notifications.
        </p>
      )}
      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
