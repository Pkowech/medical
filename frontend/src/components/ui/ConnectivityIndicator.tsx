'use client';

import React, { useState, useEffect } from 'react';
import { useConnectivity } from '@/lib/hooks/useConnectivity';
import { WifiOff, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export function ConnectivityIndicator() {
  const {
    isOnline,
    pendingChanges,
    failedChanges,
    isFlushing,
    statusError,
    retryFailed,
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
        "fixed bottom-4 right-4 z-50 flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-3 rounded-full shadow-lg transition-all duration-300",
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
          <span className="text-sm font-medium">Offline storage is unavailable</span>
        </>
      )}

      {!statusError && failedChanges > 0 && (
        <>
          <AlertCircle className="w-4 h-4" />
          <span className="text-sm font-medium">
            {failedChanges} change{failedChanges === 1 ? '' : 's'} need attention
          </span>
          <button
            type="button"
            className="rounded bg-white/20 px-2 py-1 text-xs font-semibold hover:bg-white/30"
            onClick={() => void retryFailed()}
          >
            Retry
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
