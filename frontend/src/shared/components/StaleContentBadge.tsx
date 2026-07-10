'use client';

import React from 'react';

interface StaleContentBadgeProps {
  /** Whether the material content has been updated since the user last viewed it */
  isStale?: boolean;
  /** Optional CSS class for additional styling */
  className?: string;
  /** Show a compact icon-only version (no text) */
  compact?: boolean;
}

/**
 * StaleContentBadge — MAT-003 implementation.
 *
 * Renders a small amber/yellow badge to notify students that the material
 * content has been updated since they last viewed it.  The `isStale` flag
 * comes from the `Progress.isStale` field in the backend, which is set to
 * `true` whenever the corresponding `Material.version` increments.
 *
 * Usage:
 *   <StaleContentBadge isStale={progress.isStale} />
 */
export function StaleContentBadge({
  isStale,
  className = '',
  compact = false,
}: StaleContentBadgeProps) {
  if (!isStale) return null;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border border-amber-400 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 dark:border-amber-500 dark:bg-amber-900/30 dark:text-amber-300 ${className}`}
      title="This material has been updated since you last viewed it. Review the new content to keep your progress current."
      role="status"
      aria-label="Content updated since last viewed"
    >
      <svg
        className="h-3 w-3 flex-shrink-0"
        fill="currentColor"
        viewBox="0 0 20 20"
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
          clipRule="evenodd"
        />
      </svg>
      {!compact && <span>Updated content</span>}
    </span>
  );
}
