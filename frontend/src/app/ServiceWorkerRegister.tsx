'use client';

import { useEffect, useRef, useState } from 'react';

export function ServiceWorkerRegister() {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const activatingUpdate = useRef(false);

  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;

    let disposed = false;
    let registration: ServiceWorkerRegistration | undefined;

    const showWaitingWorker = () => {
      if (!disposed && registration?.waiting) {
        setWaitingWorker(registration.waiting);
      }
    };

    const register = async () => {
      try {
        registration = await navigator.serviceWorker.register('/sw.js');
        showWaitingWorker();
        registration.addEventListener('updatefound', () => {
          const installing = registration?.installing;
          installing?.addEventListener('statechange', () => {
            if (installing.state === 'installed' && navigator.serviceWorker.controller) {
              showWaitingWorker();
            }
          });
        });
        await registration.update();
      } catch (error) {
        console.error('[PWA] Service worker registration/update failed:', error);
      }
    };

    const onControllerChange = () => {
      if (activatingUpdate.current) window.location.reload();
    };

    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
    void register();

    return () => {
      disposed = true;
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
    };
  }, []);

  if (!waitingWorker) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed left-4 top-4 z-[100] flex items-center gap-3 rounded-lg bg-slate-900 px-4 py-3 text-sm text-white shadow-lg"
    >
      <span>A new version is ready.</span>
      <button
        type="button"
        className="rounded bg-white px-3 py-1 font-semibold text-slate-900 hover:bg-slate-100"
        onClick={() => {
          if (!waitingWorker) return;
          activatingUpdate.current = true;
          waitingWorker.postMessage({ type: 'SKIP_WAITING' });
        }}
      >
        Update
      </button>
    </div>
  );
}
