'use client';

import React from 'react';

/**
 * COURSE-002: Prerequisite type drives hard gate vs warning vs suggestion behavior.
 * Matches the backend PrerequisiteType enum in prerequisites.dto.ts.
 */
export type PrerequisiteType = 'required' | 'optional' | 'recommended';

interface PrerequisiteTypeBadgeProps {
  /** The type of prerequisite relationship */
  type: PrerequisiteType;
  /** Optional CSS class */
  className?: string;
  /** Show compact dot-only version */
  compact?: boolean;
}

const CONFIG: Record<
  PrerequisiteType,
  {
    color: string;
    dot: string;
    label: string;
    tooltip: string;
    dot_char: string;
  }
> = {
  required: {
    color:
      'border-red-300 bg-red-50 text-red-700 dark:border-red-500 dark:bg-red-900/30 dark:text-red-300',
    dot: 'bg-red-500',
    label: 'Required',
    tooltip: 'You must complete this before enrolling.',
    dot_char: '🔴',
  },
  optional: {
    color:
      'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-500 dark:bg-amber-900/30 dark:text-amber-300',
    dot: 'bg-amber-500',
    label: 'Optional',
    tooltip: 'Recommended but you can still enroll without completing this.',
    dot_char: '🟡',
  },
  recommended: {
    color:
      'border-green-300 bg-green-50 text-green-700 dark:border-green-500 dark:bg-green-900/30 dark:text-green-300',
    dot: 'bg-green-500',
    label: 'Recommended',
    tooltip: 'This is suggested for the best learning experience.',
    dot_char: '🟢',
  },
};

/**
 * PrerequisiteTypeBadge — COURSE-002 implementation.
 *
 * Renders a colored pill badge next to prerequisite items on course detail
 * pages, visually communicating whether each prerequisite is:
 *   🔴 Required — hard gate, must complete
 *   🟡 Optional — warned but not blocked
 *   🟢 Recommended — soft suggestion only
 *
 * Usage:
 *   <PrerequisiteTypeBadge type={prerequisite.type} />
 */
export function PrerequisiteTypeBadge({
  type,
  className = '',
  compact = false,
}: PrerequisiteTypeBadgeProps) {
  const config = CONFIG[type] ?? CONFIG.optional;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${config.color} ${className}`}
      title={config.tooltip}
      aria-label={`Prerequisite type: ${config.label}. ${config.tooltip}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${config.dot}`} aria-hidden="true" />
      {!compact && <span>{config.label}</span>}
    </span>
  );
}
