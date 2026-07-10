/**
 * SyncIndicator Component
 * 
 * Provides real-time visual feedback on sync status
 * - Pending: Shows spinning indicator
 * - Synced: Shows checkmark
 * - Error: Shows error icon with tooltip
 * - Online/Offline: Shows connection status
 */
'use client';

import React, { useEffect, useState } from 'react';

interface SyncIndicatorProps {
  isPending?: boolean;
  isSynced?: boolean;
  error?: string | null;
  isOnline?: boolean;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export function SyncIndicator({
  isPending = false,
  isSynced = false,
  error = null,
  isOnline = true,
  size = 'md',
  showLabel = false,
}: SyncIndicatorProps) {
  const [isVisible, setIsVisible] = useState<boolean>(isPending || !!error);

  useEffect(() => {
    setIsVisible(isPending || !!error);
  }, [isPending, error]);

  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  const textSizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  };

  if (!isVisible && isSynced && isOnline) {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      {/* Pending: Spinning indicator */}
      {isPending && (
        <>
          <div className={`${sizeClasses[size]} animate-spin`}>
            <svg
              className="w-full h-full text-blue-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.581 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </div>
          {showLabel && <span className={`${textSizeClasses[size]} text-gray-600`}>Syncing...</span>}
        </>
      )}

      {/* Error: Error icon with tooltip */}
      {error && (
        <div className="group relative">
          <div className={`${sizeClasses[size]} text-red-500`}>
            <svg
              className="w-full h-full"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          {showLabel && (
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-red-500 text-white px-2 py-1 rounded text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              {error}
            </div>
          )}
        </div>
      )}

      {/* Synced: Checkmark */}
      {isSynced && !error && !isPending && (
        <>
          <div className={`${sizeClasses[size]} text-green-500`}>
            <svg
              className="w-full h-full"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          {showLabel && <span className={`${textSizeClasses[size]} text-green-600`}>Synced</span>}
        </>
      )}

      {/* Offline: Offline indicator */}
      {!isOnline && (
        <>
          <div className={`${sizeClasses[size]} text-yellow-500`}>
            <svg
              className="w-full h-full"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0"
              />
            </svg>
          </div>
          {showLabel && <span className={`${textSizeClasses[size]} text-yellow-600`}>Offline</span>}
        </>
      )}
    </div>
  );
}

/**
 * Toast-style sync notification for better UX
 */
export function SyncToast({
  isPending = false,
  isSynced = false,
  error = null,
  autoHideDelay = 3000,
}: {
  isPending?: boolean;
  isSynced?: boolean;
  error?: string | null;
  autoHideDelay?: number;
}) {
  const [isVisible, setIsVisible] = useState<boolean>(isPending || !!error);

  useEffect(() => {
    setIsVisible(isPending || !!error);

    if (isSynced && !error && !isPending) {
      const timer = setTimeout(() => setIsVisible(false), autoHideDelay);
      return () => clearTimeout(timer);
    }
  }, [isPending, isSynced, error, autoHideDelay]);

  if (!isVisible) return null;

  return (
    <div
      className={`fixed bottom-4 right-4 px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 ${
        error ? 'bg-red-500' : 'bg-green-500'
      } text-white z-50`}
    >
      <SyncIndicator
        isPending={isPending}
        isSynced={isSynced}
        error={error}
        size="sm"
      />
      <span className="text-sm">
        {isPending && 'Syncing your changes...'}
        {error && `Sync error: ${error}`}
        {isSynced && !error && !isPending && 'Changes saved'}
      </span>
    </div>
  );
}
