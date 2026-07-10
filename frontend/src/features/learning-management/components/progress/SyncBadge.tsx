import React from 'react';

const SyncBadge = ({ status }: { status?: 'pending' | 'synced' | 'error' }) => {
  if (!status) return null;
  const colorClasses: Record<string, string> = {
    pending: 'bg-amber-50 text-amber-700 border border-amber-100 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20',
    synced: 'bg-emerald-50 text-emerald-700 border border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20',
    error: 'bg-rose-50 text-rose-700 border border-rose-100 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colorClasses[status]}`}>
      {status}
    </span>
  );
};

export default SyncBadge;
