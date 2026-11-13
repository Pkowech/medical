'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, BookOpen, Target } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { useAuthStore } from '@/features/auth/store/useAuthStore';
import { userService } from '@/features/profile/services/userService';
import {
  onboardingService,
  type StarterPathItem,
} from '@/features/onboarding/services/onboardingService';

interface StudyPreferences {
  institution: string;
  targetExam: string;
  dailyGoalMinutes: number;
  focusTopicsText: string;
}

const DEFAULT_PREFERENCES: StudyPreferences = {
  institution: '',
  targetExam: '',
  dailyGoalMinutes: 45,
  focusTopicsText: '',
};

export const StudyPreferencesPanel: React.FC = () => {
  const { user, setUser } = useAuthStore();
  const [preferences, setPreferences] = useState(DEFAULT_PREFERENCES);
  const [savedPreferences, setSavedPreferences] = useState(DEFAULT_PREFERENCES);
  const [starterPaths, setStarterPaths] = useState<StarterPathItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [recommendationError, setRecommendationError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const hasChanges = JSON.stringify(preferences) !== JSON.stringify(savedPreferences);

  useEffect(() => {
    let active = true;

    const loadPreferences = async () => {
      if (!user?.id) {
        setLoadError('Sign in to load your study preferences.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setLoadError(null);
      setRecommendationError(null);
      try {
        const status = await onboardingService.getStatus();
        if (!active) return;

        const profile = status.profile;
        const loadedPreferences: StudyPreferences = {
          institution: profile?.institution ?? '',
          targetExam: profile?.targetExam ?? '',
          dailyGoalMinutes: profile?.dailyGoalMinutes ?? 45,
          focusTopicsText: profile?.focusTopics?.join('\n') ?? '',
        };
        setPreferences(loadedPreferences);
        setSavedPreferences(loadedPreferences);
        setStarterPaths(status.suggestedStarterPaths ?? []);
      } catch (error) {
        console.error('Error loading study preferences:', error);
        if (active) {
          setLoadError('Study preferences could not be loaded. Retry before editing them.');
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadPreferences();
    return () => {
      active = false;
    };
  }, [retryCount, user?.id]);

  const handleSave = async () => {
    if (!user?.id || loading || loadError) return;

    const focusTopics = preferences.focusTopicsText
      .split(/\r?\n/)
      .map(topic => topic.trim())
      .filter(Boolean);
    const updatedPreferences: StudyPreferences = {
      ...preferences,
      institution: preferences.institution.trim(),
      targetExam: preferences.targetExam.trim(),
      focusTopicsText: focusTopics.join('\n'),
    };
    const userPreferences = {
      ...(user.preferences ?? {}),
      institution: updatedPreferences.institution,
      targetExam: updatedPreferences.targetExam,
      dailyGoalMinutes: updatedPreferences.dailyGoalMinutes,
      focusTopics,
    };

    setSaving(true);
    setRecommendationError(null);
    try {
      await userService.updateUserProfile(user.id, { preferences: userPreferences });
      setUser({ ...user, preferences: userPreferences });
      setPreferences(updatedPreferences);
      setSavedPreferences(updatedPreferences);
      toast.success('Study preferences saved.');

      try {
        const status = await onboardingService.getStatus();
        setStarterPaths(status.suggestedStarterPaths ?? []);
      } catch (error) {
        console.error('Error refreshing learning path recommendations:', error);
        setRecommendationError('Preferences were saved, but recommendations could not be refreshed.');
      }
    } catch (error) {
      console.error('Error saving study preferences:', error);
      toast.error(error instanceof Error ? error.message : 'Could not save study preferences.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mb-10 grid grid-cols-1 gap-6 xl:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-indigo-600" />
            Study Preferences
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Tune your study commitment and tailor path recommendations.
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          {loadError && (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
              <p className="text-sm text-destructive" role="alert">{loadError}</p>
              <Button type="button" variant="outline" onClick={() => setRetryCount(count => count + 1)}>
                Retry
              </Button>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="study-institution" className="mb-2 block text-sm font-medium">
                Institution, school, or hospital
              </label>
              <input
                id="study-institution"
                value={preferences.institution}
                onChange={event => setPreferences(previous => ({ ...previous, institution: event.target.value }))}
                maxLength={120}
                disabled={loading || Boolean(loadError)}
                placeholder="e.g., Kenyatta University"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
            <div>
              <label htmlFor="study-target-exam" className="mb-2 block text-sm font-medium">
                Target exam, board, or milestone
              </label>
              <input
                id="study-target-exam"
                value={preferences.targetExam}
                onChange={event => setPreferences(previous => ({ ...previous, targetExam: event.target.value }))}
                maxLength={120}
                disabled={loading || Boolean(loadError)}
                placeholder="e.g., NCLEX-RN, USMLE Step 1"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <label htmlFor="study-daily-goal" className="text-sm font-medium">
                  Daily study goal
                </label>
                <span className="text-sm font-semibold text-foreground">
                  {preferences.dailyGoalMinutes} minutes
                </span>
              </div>
              <input
                id="study-daily-goal"
                type="range"
                min="15"
                max="240"
                step="15"
                value={preferences.dailyGoalMinutes}
                onChange={event =>
                  setPreferences(previous => ({
                    ...previous,
                    dailyGoalMinutes: Number(event.target.value),
                  }))
                }
                disabled={loading || Boolean(loadError)}
                className="w-full accent-indigo-600 disabled:opacity-50"
              />
            </div>
            <div>
              <label htmlFor="study-focus-topics" className="mb-2 block text-sm font-medium">
                Priority learning topics
              </label>
              <textarea
                id="study-focus-topics"
                value={preferences.focusTopicsText}
                onChange={event =>
                  setPreferences(previous => ({
                    ...previous,
                    focusTopicsText: event.target.value,
                  }))
                }
                rows={3}
                disabled={loading || Boolean(loadError)}
                placeholder={'One topic per line, e.g.\nPharmacotherapy\nClinical skills'}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
            <p className="text-xs text-muted-foreground">These preferences help tailor recommendations.</p>
            <Button
              type="button"
              onClick={handleSave}
              disabled={loading || Boolean(loadError) || saving || !hasChanges}
            >
              {saving ? 'Saving...' : 'Save preferences'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-purple-600" />
            Suggested Learning Paths
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Published paths matched to your healthcare field, stage, and goals.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {recommendationError && (
            <p className="text-sm text-destructive" role="alert">
              {recommendationError}
            </p>
          )}
          {loading ? (
            <p className="text-sm text-muted-foreground" role="status">Finding paths for your profile…</p>
          ) : loadError ? (
            <p className="text-sm text-muted-foreground">
              Retry loading your study preferences to refresh path suggestions.
            </p>
          ) : starterPaths.length > 0 ? (
            starterPaths.map(path => (
              <Link
                key={path.id}
                href={`/learning-paths/${path.id}`}
                className="block rounded-xl border border-border bg-muted/40 p-4 transition-colors hover:border-indigo-500/50 hover:bg-muted/80"
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-semibold text-foreground">{path.title}</h3>
                  {path.estimatedDurationWeeks != null && (
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {path.estimatedDurationWeeks} weeks
                    </span>
                  )}
                </div>
                {path.description && (
                  <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{path.description}</p>
                )}
                <span className="mt-3 inline-flex items-center text-sm font-medium text-indigo-600 dark:text-indigo-400">
                  Explore path <ArrowRight className="ml-1 h-4 w-4" />
                </span>
              </Link>
            ))
          ) : (
            <div className="rounded-xl border border-dashed border-border bg-muted/40 p-4">
              <p className="text-sm text-muted-foreground">
                No exact match yet. Check your healthcare profile or browse all published paths.
              </p>
              <Link
                href="/learning-paths"
                className="mt-3 inline-flex items-center text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
              >
                Browse learning paths <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </div>
          )}
          <Link
            href="/learning-paths"
            className="inline-flex items-center text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
          >
            Browse all paths <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
        </CardContent>
      </Card>
    </div>
  );
};
