'use client';

import React, { useState, useEffect } from 'react';
import { useConnectivity } from '@/lib/hooks/useConnectivity';
import { WifiOff, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { usePathname } from 'next/navigation';

export function ConnectivityIndicator() {
  const pathname = usePathname();
  const {
    isOnline,
    pendingChanges,
    failedChanges,
    retryableFailedChanges,
    isFlushing,
    statusError,
    retryFailed,
    discardFailed,
    latestFailure,
  } = useConnectivity();
  const [showSuccess, setShowSuccess] = useState(false);
  const [prevFlushing, setPrevFlushing] = useState(isFlushing);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Show success message briefly after sync completes
  useEffect(() => {
    if (
      prevFlushing &&
      !isFlushing &&
      isOnline &&
      pendingChanges === 0 &&
      failedChanges === 0 &&
      !statusError
    ) {
      setShowSuccess(true);
      const timer = setTimeout(() => setShowSuccess(false), 2000);
      return () => clearTimeout(timer);
    }
    setPrevFlushing(isFlushing);
  }, [failedChanges, isFlushing, isOnline, pendingChanges, prevFlushing, statusError]);

  // Prevent hydration mismatch by returning null until mounted
  if (!mounted) {
    return null;
  }

  // Hide when online, synced, and no success message
  if (
    isOnline &&
    pendingChanges === 0 &&
    failedChanges === 0 &&
    !isFlushing &&
    !showSuccess &&
    !statusError
  ) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className={cn(
        "fixed right-3 z-50 flex items-center gap-2 rounded-full px-3 py-2 shadow-lg transition-all duration-300 sm:right-4 sm:px-4 sm:py-3",
        pathname?.startsWith('/quiz/unit/')
          ? 'bottom-[calc(5rem+env(safe-area-inset-bottom))]'
          : 'bottom-[calc(4.5rem+env(safe-area-inset-bottom))] lg:bottom-4',
        !isOnline && "bg-red-500 text-white",
        (statusError || failedChanges > 0) && "bg-amber-600 text-white",
        isOnline && failedChanges === 0 && !statusError && !showSuccess && "bg-blue-600 text-white",
        showSuccess && "bg-green-600 text-white"
      )}
    >
      {!isOnline && (
        <>
          <WifiOff className="w-4 h-4" />
          <span className="text-sm font-medium">You are offline</span>
          {pendingChanges > 0 && (
            <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">
              {pendingChanges} pending
            </span>
          )}
        </>
      )}

      {statusError && (
        <>
          <AlertCircle className="w-4 h-4" />
          <span className="text-sm font-medium" title={statusError}>
            Sync unavailable
          </span>
        </>
      )}

      {!statusError && failedChanges > 0 && (
        <>
          <AlertCircle className="w-4 h-4" />
          <span className="text-sm font-medium" title={latestFailure}>
            {failedChanges} change{failedChanges === 1 ? '' : 's'} need attention
          </span>
          {retryableFailedChanges > 0 && (
            <button
              type="button"
              className="rounded bg-white/20 px-2 py-1 text-xs font-semibold hover:bg-white/30"
              onClick={() => void retryFailed()}
              title={latestFailure || 'Retry failed changes'}
              aria-label={
                latestFailure
                  ? `Retry failed changes. Latest error: ${latestFailure}`
                  : 'Retry failed changes'
              }
            >
              Retry ({retryableFailedChanges})
            </button>
          )}
          <button
            type="button"
            className="rounded bg-white/20 px-2 py-1 text-xs font-semibold hover:bg-white/30"
            onClick={() => {
              if (window.confirm('Discard all failed offline changes from this device?')) {
                void discardFailed();
              }
            }}
            title="Permanently remove failed changes stored on this device"
          >
            Clear failed
          </button>
        </>
      )}

      {isOnline && showSuccess && (
        <>
          <CheckCircle className="w-4 h-4" />
          <span className="text-sm font-medium">All changes synced</span>
        </>
      )}

      {isOnline && !showSuccess && !statusError && (pendingChanges > 0 || isFlushing) && (
        <>
          <RefreshCw className={cn("w-4 h-4", isFlushing && "animate-spin")} />
          <span className="text-sm font-medium">
            {isFlushing ? 'Syncing...' : 'Changes pending'}
          </span>
          <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">
            {pendingChanges}
          </span>

        </>
      )}
    </div>
  );
}
