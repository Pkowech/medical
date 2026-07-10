'use client';

import React, { useMemo } from 'react';
import type { LocalUserProfile } from '@/shared/types/profileInterface';

interface ProfileCompletenessBarProps {
  profile: LocalUserProfile;
  variant?: 'compact' | 'full';
}

interface FieldCheck {
  label: string;
  filled: boolean;
  required: boolean;
}

function calculateCompleteness(profile: LocalUserProfile): {
  percentage: number;
  fields: FieldCheck[];
} {
  const fields: FieldCheck[] = [
    { label: 'First Name', filled: Boolean(profile.firstName?.trim()), required: true },
    { label: 'Last Name', filled: Boolean(profile.lastName?.trim()), required: true },
    { label: 'Email', filled: Boolean(profile.email?.trim()), required: true },
    { label: 'Bio', filled: Boolean(profile.bio?.trim()), required: false },
    { label: 'Phone Number', filled: Boolean(profile.phoneNumber?.trim()), required: false },
    { label: 'Location', filled: Boolean(profile.location?.trim()), required: false },
    { label: 'Specialization', filled: Boolean(profile.specialization?.trim()), required: false },
    { label: 'Experience', filled: (profile.yearOfExperience ?? 0) > 0, required: false },
    { label: 'Profile Image', filled: Boolean(profile.profileImage), required: false },
  ];

  const filledCount = fields.filter(f => f.filled).length;
  const percentage = Math.round((filledCount / fields.length) * 100);

  return { percentage, fields };
}

function getProgressColor(percentage: number): string {
  if (percentage >= 80) return 'bg-emerald-500';
  if (percentage >= 50) return 'bg-amber-500';
  return 'bg-red-500';
}

function getProgressLabel(percentage: number): string {
  if (percentage >= 100) return 'Complete!';
  if (percentage >= 80) return 'Almost there';
  if (percentage >= 50) return 'Getting started';
  return 'Needs attention';
}

export function ProfileCompletenessBar({ profile, variant = 'compact' }: ProfileCompletenessBarProps) {
  const { percentage, fields } = useMemo(() => calculateCompleteness(profile), [profile]);
  const barColor = getProgressColor(percentage);
  const label = getProgressLabel(percentage);

  if (variant === 'compact') {
    return (
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-gray-700 dark:text-slate-300">Profile Completeness</span>
          <span className="text-gray-500 dark:text-slate-400">{percentage}%</span>
        </div>
        <div className="h-2 w-full rounded-full bg-gray-200 dark:bg-slate-700 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ease-out ${barColor}`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    );
  }

  // Full variant
  const missingFields = fields.filter(f => !f.filled);

  return (
    <div className="rounded-xl border border-gray-100 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/50 backdrop-blur-sm p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Profile Completeness</h3>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">{label}</p>
        </div>
        <span className="text-2xl font-bold text-gray-900 dark:text-white">{percentage}%</span>
      </div>

      <div className="h-3 w-full rounded-full bg-gray-200 dark:bg-slate-700 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${barColor}`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      {missingFields.length > 0 && (
        <div className="pt-2">
          <p className="text-xs font-medium text-gray-500 dark:text-slate-400 mb-2">
            Complete these to strengthen your profile:
          </p>
          <div className="flex flex-wrap gap-2">
            {missingFields.map(f => (
              <span
                key={f.label}
                className={`inline-flex items-center text-xs px-2.5 py-1 rounded-full ${
                  f.required
                    ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-100 dark:border-red-800/50'
                    : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300'
                }`}
              >
                {f.label}
                {f.required && <span className="ml-1 text-red-400">*</span>}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
