'use client';

import { useEffect } from 'react';

export function ServiceWorkerRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').then(
        () => {
          console.warn('ServiceWorker registered');
        },
        err => {
          console.error('ServiceWorker registration failed:', err);
        }
      );
    }
  }, []);

  return null;
}
