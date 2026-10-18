'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { ScrollArea } from '@/shared/components/ui/scroll-area';
import { Separator } from '@/shared/components/ui/separator';
import { AlertCircle, Play, RefreshCw } from 'lucide-react';
import { flashcardApi, type UserFlashcardProgress } from '@/features/assessment/services/flashcardApi';
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
      <div className="flex min-h-[200px] items-center justify-center" role="status">
        <p className="text-muted-foreground">Loading review queue...</p>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <h3 className="text-lg font-semibold">Course review queue</h3>
          <p className="text-sm text-muted-foreground">
            {dueCards.length} {dueCards.length === 1 ? 'card' : 'cards'} due
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => void fetchDueCards()}
            aria-label="Refresh review queue"
            className="h-8 w-8"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            onClick={handleStartReview}
            disabled={dueCards.length === 0}
            className="flex items-center gap-2"
          >
            <Play className="h-4 w-4" />
            Start review
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {error ? (
          <div role="alert" className="flex items-center justify-between gap-3 text-sm text-destructive">
            <span className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </span>
            <Button type="button" variant="outline" size="sm" onClick={() => void fetchDueCards()}>
              Retry
            </Button>
          </div>
        ) : dueCards.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground">
            You’re all caught up. Reviews from studied topics and quizzes will appear here.
          </p>
        ) : (
          <ScrollArea className="h-[300px] pr-4">
            <div className="space-y-4">
              {dueCards.map(card => (
                <div key={card.id} className="space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="line-clamp-2 font-medium">
                        {card.flashcard.front || 'Course review card'}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {card.lastReview
                          ? `Last reviewed ${new Date(card.lastReview).toLocaleDateString()}`
                          : 'New card'}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1 text-xs text-muted-foreground">
                      <span>{card.correctStreak} correct in a row</span>
                      <span>{card.interval} day interval</span>
                    </div>
                  </div>
                  <Separator />
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};
