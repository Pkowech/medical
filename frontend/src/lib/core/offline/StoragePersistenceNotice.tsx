'use client';

import { useEffect, useState } from 'react';
import {
  inspectPersistentStorage,
  readPersistentStorageStatus,
  requestPersistentStorage,
  type PersistentStorageStatus,
} from './requestPersistentStorage';

export function StoragePersistenceNotice() {
  const [status, setStatus] = useState<PersistentStorageStatus | undefined>(() =>
    typeof window === 'undefined' ? undefined : readPersistentStorageStatus(),
  );
  const [busy, setBusy] = useState(false);
  const [requestDenied, setRequestDenied] = useState(false);

  useEffect(() => {
    void inspectPersistentStorage().then(setStatus).catch(error => {
        console.error('[PWA] Could not update persistent-storage status:', error);
      });
  }, []);

  if (!status?.supported || status.persisted) return null;

  return (
    <div
      role="status"
      className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100"
    >
      <p>
        This browser may delete offline downloads when storage is low. Allow persistent storage,
        or re-download a topic if it disappears.
      </p>
      {requestDenied && (
        <p role="alert" className="mt-2">
          The browser did not grant persistent storage. Offline downloads may still be removed
          when storage is low; you can try again.
        </p>
      )}
      <button
        type="button"
        className="mt-2 min-h-10 rounded-md border border-amber-300 px-3 font-medium hover:bg-amber-100 dark:border-amber-800 dark:hover:bg-amber-900/60"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          void requestPersistentStorage()
            .then(persisted => {
              setRequestDenied(!persisted);
              setStatus({
                supported: true,
                persisted,
                checkedAt: Date.now(),
              });
            })
            .catch(error => {
              console.error('[PWA] Could not save persistent-storage status:', error);
              setRequestDenied(true);
              setStatus({
                supported: true,
                persisted: false,
                checkedAt: Date.now(),
              });
            })
            .finally(() => setBusy(false));
        }}
      >
        {busy ? 'Asking the browser…' : 'Keep downloads on this device'}
      </button>
    </div>
  );
}
