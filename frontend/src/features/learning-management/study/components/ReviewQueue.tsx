'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { AlertCircle, BookOpenCheck, CheckCircle2, Clock3, Play, RefreshCw } from 'lucide-react';
import {
  flashcardApi,
  type UserFlashcardProgress,
} from '@/features/assessment/services/flashcardApi';
import { useAuthStore } from '@/features/auth/store/useAuthStore';
import { useRouter } from 'next/navigation';

export const ReviewQueue: React.FC = () => {
  const userId = useAuthStore(state => state.user?.id);
  const router = useRouter();
  const [dueCards, setDueCards] = useState<UserFlashcardProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDueCards = useCallback(async () => {
    if (!userId) {
      setDueCards([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      setDueCards(await flashcardApi.getDueCards(userId));
    } catch (fetchError) {
      console.error('Failed to fetch due review cards:', fetchError);
      setError('Review cards could not be loaded. Try again.');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void fetchDueCards();
  }, [fetchDueCards]);

  const handleStartReview = () => {
    router.push('/flashcards/all');
  };

  if (loading) {
    return (
      <Card className="overflow-hidden border-border/80 shadow-sm" role="status" aria-live="polite">
        <CardHeader className="border-b border-border/70 bg-muted/20 px-5 py-4">
          <div className="h-5 w-40 animate-pulse rounded bg-muted" />
          <div className="mt-2 h-4 w-64 max-w-full animate-pulse rounded bg-muted" />
        </CardHeader>
        <CardContent className="p-5">
          <div className="h-16 animate-pulse rounded-lg bg-muted/60" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden border-border/80 shadow-sm">
      <CardHeader className="border-b border-border/70 bg-muted/20 px-5 py-4">
        <div className="flex flex-row items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-primary/15 bg-primary/10 text-primary">
              <BookOpenCheck className="h-4 w-4" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-semibold text-foreground">Course review queue</h3>
                {!error && dueCards.length > 0 && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                    {dueCards.length} due
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {error ? 'Due cards unavailable' : 'Spaced-repetition cards ready to practise'}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => void fetchDueCards()}
              aria-label="Refresh review queue"
              className="h-9 w-9"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            {!error && dueCards.length > 0 && (
              <Button type="button" onClick={handleStartReview} className="gap-2">
                <Play className="h-4 w-4" fill="currentColor" />
                Start review
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {error ? (
          <div
            role="alert"
            className="m-4 flex items-center justify-between gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive"
          >
            <span className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </span>
          </div>
        ) : dueCards.length === 0 ? (
          <div className="flex min-h-36 flex-col items-center justify-center px-6 py-8 text-center">
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
            </div>
            <p className="font-medium text-foreground">You’re all caught up</p>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              Studied topics and quiz questions will appear here when they are ready for review.
            </p>
          </div>
        ) : (
          <div className={dueCards.length > 4 ? 'max-h-[300px] overflow-y-auto' : ''}>
            {dueCards.map((card, index) => (
              <div
                key={card.id}
                className="grid gap-3 border-b border-border/60 px-5 py-4 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_auto]"
              >
                <div className="min-w-0">
                  <p className="line-clamp-2 text-sm font-semibold leading-5 text-foreground">
                    {card.flashcard.front || 'Course review card'}
                  </p>
                  <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
                    {card.lastReview
                      ? `Last reviewed ${new Date(card.lastReview).toLocaleDateString()}`
                      : 'New card'}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                  {card.correctStreak > 0 && (
                    <span className="rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                      {card.correctStreak} correct in a row
                    </span>
                  )}
                  <span className="rounded-md border border-border bg-muted/40 px-2 py-1 text-xs text-muted-foreground">
                    {card.interval === 0 ? 'Due now' : `${card.interval} day interval`}
                  </span>
                  {index === 0 && (
                    <span className="rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                      Next
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
