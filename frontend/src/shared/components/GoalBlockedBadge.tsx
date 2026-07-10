'use client';

import React from 'react';

interface GoalBlockedBadgeProps {
  /**
   * ID of the goal this goal depends on.
   * If set, the goal is treated as potentially blocked.
   */
  dependsOnGoalId?: string | null;
  /**
   * Human-readable reason the goal is blocked.
   * When provided this text is shown directly (e.g. "Blocked by: Foundation Skills").
   * When omitted but dependsOnGoalId is set, a generic message is displayed.
   */
  blockedReason?: string | null;
  /** Optional CSS class */
  className?: string;
}

/**
 * GoalBlockedBadge — GOAL-005 (Frontend) implementation.
 *
 * Renders a visual indicator on goal cards when the goal has a dependency
 * on another goal (`dependsOnGoalId` is set) and/or has an explicit
 * `blockedReason`.  This tells students why they cannot progress on a goal yet.
 *
 * The underlying data fields (`dependsOnGoalId`, `blockedReason`) exist in the
 * `LearningGoal` Prisma model and are now exposed via `LearningGoalResponseDto`.
 *
 * Usage:
 *   <GoalBlockedBadge
 *     dependsOnGoalId={goal.dependsOnGoalId}
 *     blockedReason={goal.blockedReason}
 *   />
 */
export function GoalBlockedBadge({
  dependsOnGoalId,
  blockedReason,
  className = '',
}: GoalBlockedBadgeProps) {
  if (!dependsOnGoalId && !blockedReason) return null;

  const message = blockedReason ?? 'Blocked by another goal';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400 ${className}`}
      title={`This goal is currently blocked: ${message}`}
      role="status"
      aria-label={`Goal blocked: ${message}`}
    >
      {/* Lock icon */}
      <svg
        className="h-3 w-3 flex-shrink-0"
        fill="currentColor"
        viewBox="0 0 20 20"
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z"
          clipRule="evenodd"
        />
      </svg>
      <span className="max-w-[180px] truncate">{message}</span>
    </span>
  );
}
