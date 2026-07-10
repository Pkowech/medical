import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { ScrollArea } from '@/shared/components/ui/scroll-area';
import { Separator } from '@/shared/components/ui/separator';
import { Play, RefreshCw } from 'lucide-react';
import { flashcardApi, UserFlashcardProgress } from '@/features/assessment/services/flashcardApi';
import { useAuthStore } from '@/features/auth/store/useAuthStore';
import { useRouter } from 'next/navigation';

export const ReviewQueue: React.FC = () => {
  const { user } = useAuthStore();
  const router = useRouter();
  const [dueCards, setDueCards] = useState<UserFlashcardProgress[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDueCards = async () => {
    if (!user) return;
    try {
      // getDueCards returns Flashcard[], but we need UserFlashcardProgress
      // This endpoint should be updated or we fetch stats instead
      const _stats = await flashcardApi.getCardStats(user.id); // TODO: use stats to populate dueCards
      setDueCards([]);
    } catch (error) {
      console.error('Failed to fetch due cards:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDueCards();
  }, [user]);

  const handleStartReview = () => {
    router.push('/flashcards');
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[200px]">
        <p className="text-gray-500 dark:text-gray-400">Loading review queue...</p>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <h3 className="text-lg font-semibold">Review Queue</h3>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={fetchDueCards} className="h-8 w-8">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button
            onClick={handleStartReview}
            disabled={dueCards.length === 0}
            className="flex items-center gap-2"
          >
            <Play className="h-4 w-4" />
            Start Review
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {dueCards.length === 0 ? (
          <p className="text-center text-gray-500 dark:text-gray-400">No cards due for review</p>
        ) : (
          <ScrollArea className="h-[300px] pr-4">
            <div className="space-y-4">
              {dueCards.map(card => (
                <div key={card.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Card #{card.id.slice(0, 8)}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Last review:{' '}
                        {card.lastReviewDate ? formatDate(card.lastReviewDate) : 'Never'}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                        {card.correctStreak} streak
                      </span>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                        {card.interval} days
                      </span>
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
