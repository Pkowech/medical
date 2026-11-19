'use client';

import React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/features/auth/store/useAuthStore';
import { useSpacedRepetition } from '@/features/assessment/hooks/useSpacedRepetition';
import { flashcardApi } from '@/features/assessment/services/flashcardApi';
import { courseService } from '@/features/courses/services/courseService';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Brain, Clock, CheckCircle2, RefreshCw, BookOpen } from 'lucide-react';
import { Progress } from '@/shared/components/ui/progress';

interface UnitDeck {
  unitId: string;
  unitTitle: string;
  courseId: string;
  courseTitle: string;
  stats: Awaited<ReturnType<typeof flashcardApi.getCardStats>>;
}

export default function FlashcardsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuthStore();
  const courseId = searchParams.get('courseId') ?? undefined;
  const unitId = searchParams.get('unitId') ?? undefined;
  const topicId = searchParams.get('topicId') ?? undefined;
  const filters = {
    courseId,
    unitId,
    topicId,
  };
  const {
    stats,
    isLoading,
    error: statsError,
    refreshCards,
  } = useSpacedRepetition(user?.id || '', filters);
  const {
    data: unitDecks = [],
    isLoading: isLoadingUnitDecks,
    error: unitDecksError,
    refetch: refreshUnitDecks,
  } = useQuery({
    queryKey: ['flashcard-unit-decks', user?.id, courseId, unitId, topicId],
    enabled: Boolean(user?.id),
    queryFn: async (): Promise<UnitDeck[]> => {
      if (!user?.id) throw new Error('Sign in to load your unit decks.');
      const dashboard = await courseService.getProgressDashboard(user.id);
      if (dashboard.unavailableSections?.includes('enrolled units')) {
        throw new Error('Your enrolled units could not be loaded.');
      }

      const enrolledUnits = new Map<string, Omit<UnitDeck, 'stats'>>();
      for (const unit of dashboard.enrolledUnits) {
        if (
          typeof unit.unitId !== 'string' ||
          typeof unit.courseId !== 'string' ||
          typeof unit.unitTitle !== 'string' ||
          typeof unit.courseTitle !== 'string'
        ) {
          throw new Error('The enrolled unit response was incomplete.');
        }
        if (courseId && unit.courseId !== courseId) continue;
        if (unitId && unit.unitId !== unitId) continue;
        enrolledUnits.set(unit.unitId, {
          unitId: unit.unitId,
          unitTitle: unit.unitTitle,
          courseId: unit.courseId,
          courseTitle: unit.courseTitle,
        });
      }

      const decks = await Promise.all(
        Array.from(enrolledUnits.values()).map(async unit => ({
          ...unit,
          stats: await flashcardApi.getCardStats(user.id, {
            courseId: unit.courseId,
            unitId: unit.unitId,
            topicId,
          }),
        })),
      );
      return topicId ? decks.filter(deck => deck.stats.totalCards > 0) : decks;
    },
  });

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 flex justify-center items-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground dark:text-foreground">Flashcard Decks</h1>
          <p className="text-muted-foreground dark:text-muted-foreground">Master medical concepts with spaced repetition.</p>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            void refreshCards();
            void refreshUnitDecks();
          }}
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh reviews
        </Button>
      </div>

      {statsError && (
        <div role="alert" className="mb-6 rounded-lg border border-destructive/40 p-4 text-sm text-destructive">
          <span>{statsError.message}</span>
          <Button className="ml-3" variant="outline" size="sm" onClick={() => void refreshCards()}>
            Try again
          </Button>
        </div>
      )}

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Due for Review</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center">
              <Clock className="h-8 w-8 text-orange-500 mr-3" />
              <div className="text-3xl font-bold">{stats?.due || 0}</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Long-interval cards</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center">
              <CheckCircle2 className="h-8 w-8 text-green-500 mr-3" />
              <div className="text-3xl font-bold">{stats?.mastered || 0}</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Average Ease</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center">
              <Brain className="h-8 w-8 text-blue-500 mr-3" />
              <div className="text-3xl font-bold">{stats?.avgEaseFactor?.toFixed(1) ?? '—'}</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Deck Selection */}
      <h2 className="text-xl font-semibold mb-4">Your Collections</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card className="hover:shadow-md transition-shadow cursor-pointer border-blue-100 bg-blue-50/30">
          <CardHeader>
            <CardTitle className="flex justify-between items-center">
              <span>All Medical Cards</span>
              <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">{stats?.total || 0} cards</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground dark:text-muted-foreground mb-4">
              Review cards from your courses and saved questions in one queue.
            </p>
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>Long interval (30+ days)</span>
                <span>{stats?.total ? Math.round(((stats.mastered || 0) / stats.total) * 100) : 0}%</span>
              </div>
              <Progress value={stats?.total ? ((stats.mastered || 0) / stats.total) * 100 : 0} className="h-2" />
            </div>
          </CardContent>
          <CardFooter>
            <Button
              className="w-full"
              disabled={!user || !stats?.due}
              onClick={() => {
                const query = searchParams.toString();
                router.push(`/flashcards/all${query ? `?${query}` : ''}`);
              }}
            >
              {!user
                ? 'Sign in to review'
                : stats?.due
                  ? 'Review due cards'
                  : stats?.total
                    ? 'All caught up'
                    : 'No cards yet'}
            </Button>
          </CardFooter>
        </Card>

        {isLoadingUnitDecks ? (
          <div role="status" className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
            Loading your enrolled-unit decks…
          </div>
        ) : unitDecksError ? (
          <div role="alert" className="rounded-lg border border-destructive/40 p-6 text-sm text-destructive">
            <p>{unitDecksError instanceof Error ? unitDecksError.message : 'Unit decks could not be loaded.'}</p>
            <Button className="mt-3" variant="outline" size="sm" onClick={() => void refreshUnitDecks()}>
              Try again
            </Button>
          </div>
        ) : unitDecks.length > 0 ? (
          unitDecks.map(deck => {
            const reviewUrl =
              `/flashcards/all?courseId=${encodeURIComponent(deck.courseId)}` +
              `&unitId=${encodeURIComponent(deck.unitId)}` +
              (topicId ? `&topicId=${encodeURIComponent(topicId)}` : '');
            const unitUrl =
              `/courses/${encodeURIComponent(deck.courseId)}` +
              `/units/${encodeURIComponent(deck.unitId)}`;

            return (
              <Card key={deck.unitId} className="flex flex-col">
                <CardHeader>
                  <CardTitle className="flex items-start justify-between gap-3 text-base">
                    <span>{deck.unitTitle}</span>
                    <span className="shrink-0 rounded-full bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
                      {deck.stats.totalCards} cards
                    </span>
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">{deck.courseTitle}</p>
                </CardHeader>
                <CardContent className="flex-1 space-y-3">
                  <p className="text-sm text-muted-foreground">
                    {deck.stats.dueToday > 0
                      ? `${deck.stats.dueToday} card${deck.stats.dueToday === 1 ? '' : 's'} due for review`
                      : deck.stats.totalCards > 0
                        ? 'No cards are due right now.'
                        : 'Take this unit’s assessment or save questions to build your deck.'}
                  </p>
                  {deck.stats.totalCards > 0 && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Long interval (30+ days)</span>
                        <span>
                          {Math.round((deck.stats.mastered / deck.stats.totalCards) * 100)}%
                        </span>
                      </div>
                      <Progress
                        value={(deck.stats.mastered / deck.stats.totalCards) * 100}
                        className="h-2"
                      />
                    </div>
                  )}
                </CardContent>
                <CardFooter>
                  {deck.stats.dueToday > 0 ? (
                    <Button className="w-full" onClick={() => router.push(reviewUrl)}>
                      <BookOpen className="mr-2 h-4 w-4" />
                      Review {deck.stats.dueToday} due
                    </Button>
                  ) : deck.stats.totalCards > 0 ? (
                    <Button className="w-full" variant="outline" disabled>
                      All caught up
                    </Button>
                  ) : (
                    <Button className="w-full" variant="outline" onClick={() => router.push(unitUrl)}>
                      Open unit
                    </Button>
                  )}
                </CardFooter>
              </Card>
            );
          })
        ) : user ? (
          <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
            {topicId
              ? 'No flashcards are linked to this topic in your enrolled units yet.'
              : unitId
                ? 'This unit is not active in your account yet. Choose it from its course to add it to your decks.'
                : courseId
                  ? 'No active units in this course yet. Choose a unit to start learning.'
                  : 'No active units yet. Choose a unit in a course to see its flashcard deck here.'}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
            Sign in to see flashcard decks for your enrolled units.
          </div>
        )}
      </div>
    </div>
  );
}
