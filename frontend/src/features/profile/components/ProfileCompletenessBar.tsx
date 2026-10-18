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
    { label: 'Healthcare field', filled: Boolean(profile.healthcareField?.trim()), required: false },
    { label: 'Career stage', filled: Boolean(profile.careerStage), required: false },
    { label: 'Specialization', filled: Boolean(profile.specialization?.trim()), required: false },
    ...(profile.careerStage === 'student'
      ? [{ label: 'Year of study', filled: Boolean(profile.studyYear), required: false }]
      : profile.careerStage === 'professional'
        ? [{
            label: 'Professional experience',
            filled: profile.yearOfExperience !== null,
            required: false,
          }]
        : []),
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
          <span className="font-medium text-muted-foreground dark:text-muted-foreground">Profile Completeness</span>
          <span className="text-muted-foreground dark:text-muted-foreground">{percentage}%</span>
        </div>
        <div className="h-2 w-full rounded-full bg-secondary dark:bg-secondary overflow-hidden">
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
    <div className="rounded-xl border border-border dark:border-border/50 bg-card/80 dark:bg-card/50 backdrop-blur-sm p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground dark:text-foreground">Profile Completeness</h3>
          <p className="text-xs text-muted-foreground dark:text-muted-foreground mt-0.5">{label}</p>
        </div>
        <span className="text-2xl font-bold text-foreground dark:text-foreground">{percentage}%</span>
      </div>

      <div className="h-3 w-full rounded-full bg-secondary dark:bg-secondary overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${barColor}`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      {missingFields.length > 0 && (
        <div className="pt-2">
          <p className="text-xs font-medium text-muted-foreground dark:text-muted-foreground mb-2">
            Complete these to strengthen your profile:
          </p>
          <div className="flex flex-wrap gap-2">
            {missingFields.map(f => (
              <span
                key={f.label}
                className={`inline-flex items-center text-xs px-2.5 py-1 rounded-full ${
                  f.required
                    ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-100 dark:border-red-800/50'
                    : 'bg-muted dark:bg-secondary text-muted-foreground dark:text-muted-foreground'
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
