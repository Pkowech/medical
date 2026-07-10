'use client';

import { useEffect, useState } from 'react';
import { syncService } from '@/lib/core/offline/syncService';
import { AlertCircle, CheckCircle2, Clock } from 'lucide-react';

interface SyncStatus {
  lastSyncTimestamp: number;
  isOnline: boolean;
  pendingChanges: number;
}

export function SyncStatusBanner() {
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const showDelay = 2000; // ms delay before showing banner when condition met
  const hideDelay = 800; // ms delay before hiding when condition clears
  let showTimer: ReturnType<typeof setTimeout> | null = null;
  let hideTimer: ReturnType<typeof setTimeout> | null = null;

  useEffect(() => {
    const updateStatus = async () => {
      const currentStatus: SyncStatus = await syncService.getSyncStatus();
      setStatus(currentStatus);
    };

    updateStatus();
    const interval = setInterval(updateStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  // Control show/hide with debounce so quick fluctuations don't flash the banner
  useEffect(() => {
    if (!status) return;

    const shouldShow = !status.isOnline || status.pendingChanges > 0;

    // Clear any existing timers
    if (showTimer) {
      clearTimeout(showTimer);
      showTimer = null;
    }
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }

    if (shouldShow) {
      // Wait `showDelay` before showing the banner to avoid immediate flashes
      showTimer = setTimeout(() => {
        setShowBanner(true);
      }, showDelay);
    } else {
      // Status indicates all synced; hide after a short delay for smooth UX
      hideTimer = setTimeout(() => {
        setShowBanner(false);
      }, hideDelay);
    }

    return () => {
      if (showTimer) clearTimeout(showTimer);
      if (hideTimer) clearTimeout(hideTimer);
    };
  }, [status]);

  if (!status || !showBanner) return null;

  const getStatusColor = () => {
    if (!status.isOnline) return 'bg-yellow-100 text-yellow-800';
    if (status.pendingChanges > 0) return 'bg-blue-100 text-blue-800';
    return 'bg-green-100 text-green-800';
  };

  const getStatusIcon = () => {
    if (!status.isOnline) return <AlertCircle className="h-5 w-5" />;
    if (status.pendingChanges > 0) return <Clock className="h-5 w-5" />;
    return <CheckCircle2 className="h-5 w-5" />;
  };

  const getStatusMessage = () => {
    if (!status.isOnline) return 'You are offline. Changes will sync when you reconnect.';
    if (status.pendingChanges > 0) return `${status.pendingChanges} changes pending sync`;
    return 'All changes synced';
  };

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 p-2 ${getStatusColor()} transition-colors duration-300`}
    >
      <div className="container mx-auto flex items-center justify-center gap-2">
        {getStatusIcon()}
        <span className="text-sm font-medium">{getStatusMessage()}</span>
      </div>
    </div>
  );
}
