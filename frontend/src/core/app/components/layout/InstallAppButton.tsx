'use client';

import { useEffect, useRef, useState } from 'react';
import { Download, Share } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

function isStandalone(): boolean {
  return (
    (window.matchMedia?.('(display-mode: standalone)')?.matches ?? false) ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function InstallAppButton() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOSDevice, setIsIOSDevice] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);
  const [installError, setInstallError] = useState<string | null>(null);
  const installDialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (isStandalone()) return;

    const isIOS =
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    setIsIOSDevice(isIOS);

    const handleInstallAvailable = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    const handleInstalled = () => {
      setInstallPrompt(null);
      setShowIOSInstructions(false);
    };

    window.addEventListener('beforeinstallprompt', handleInstallAvailable);
    window.addEventListener('appinstalled', handleInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleInstallAvailable);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  useEffect(() => {
    const dialog = installDialogRef.current;
    if (!dialog) return;

    if (showIOSInstructions && !dialog.open) dialog.showModal();
    if (!showIOSInstructions && dialog.open) dialog.close();
  }, [showIOSInstructions]);

  if (!installPrompt && !isIOSDevice) return null;

  const handleInstall = async () => {
    if (!installPrompt) {
      setShowIOSInstructions(true);
      return;
    }
    setInstallError(null);
    try {
      await installPrompt.prompt();
      await installPrompt.userChoice;
      setInstallPrompt(null);
    } catch (error) {
      console.error('[PWA] App installation prompt failed:', error);
      setInstallError('The install prompt could not be opened. Try your browser menu instead.');
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => void handleInstall()}
        className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-50 active:scale-95 dark:text-blue-300 dark:hover:bg-slate-800 motion-reduce:transition-none"
        aria-label="Install MedTrack"
      >
        <Download aria-hidden="true" className="h-4 w-4" />
        <span className="hidden sm:inline">Install</span>
      </button>

      {installError && (
        <p
          className="fixed right-4 top-16 z-[100] max-w-xs rounded-lg bg-red-700 px-4 py-3 text-sm text-white shadow-lg"
          role="alert"
          aria-live="assertive"
        >
          {installError}
        </p>
      )}

      <dialog
        ref={installDialogRef}
        aria-labelledby="install-instructions-title"
        aria-describedby="install-instructions-description"
        className="install-instructions-dialog fixed inset-x-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] m-0 w-[calc(100%-2rem)] max-w-sm rounded-2xl bg-white p-5 shadow-xl dark:bg-slate-900 sm:inset-0 sm:m-auto"
        onCancel={event => {
          event.preventDefault();
          setShowIOSInstructions(false);
        }}
      >
        <h2 id="install-instructions-title" className="text-lg font-semibold">
          Add MedTrack to your Home Screen
        </h2>
        <p
          id="install-instructions-description"
          className="mt-2 flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300"
        >
          <Share aria-hidden="true" className="h-4 w-4 shrink-0" />
          Tap Share in your browser, then choose “Add to Home Screen”.
        </p>
        <button
          type="button"
          className="mt-5 min-h-11 w-full rounded-lg bg-blue-600 px-4 font-semibold text-white transition-colors hover:bg-blue-700 active:scale-[0.99] motion-reduce:transition-none"
          onClick={() => setShowIOSInstructions(false)}
        >
          Got it
        </button>
      </dialog>
    </>
  );
}
