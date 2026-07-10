'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import {
  AlertCircle,
  BookMarked,
  TrendingDown,
  Calendar,
  ArrowRight,
  Clock,
} from 'lucide-react';
import { flashcardsService, CardStats, HighRiskTopic } from '@/features/assessment/services/flashcardsService';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export const SpacedRepetitionWidget = () => {
  const { data: session } = useSession();
  const router = useRouter();
  const [cardStats, setCardStats] = useState<CardStats | null>(null);
  const [highRiskTopics, setHighRiskTopics] = useState<HighRiskTopic[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!session?.user?.id) return;

      try {
        setIsLoading(true);
        setError(null);

        const [stats, risks] = await Promise.all([
          flashcardsService.getCardStats(session.user.id),
          flashcardsService.getHighRiskTopics(session.user.id),
        ]);

        setCardStats(stats);
        setHighRiskTopics(risks.slice(0, 5));
      } catch (err) {
        console.error('Error fetching spaced repetition data:', err);
        setError('Failed to load review data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [session?.user?.id]);

  if (isLoading) {
    return (
      <Card className="bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20 border-orange-200 dark:border-orange-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-orange-700 dark:text-orange-300">
            <Calendar className="w-5 h-5" />
            Due for Review
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-16 bg-orange-200 dark:bg-orange-800 rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-700 dark:text-red-300">
            <Calendar className="w-5 h-5" />
            Due for Review
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-red-600 dark:text-red-400">{error}</p>
        </CardContent>
      </Card>
    );
  }

  const totalCards = cardStats?.total || 0;
  const dueCards = cardStats?.due || 0;
  const reviewPercentage = totalCards > 0 ? Math.round((dueCards / totalCards) * 100) : 0;

  return (
    <Card className="bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20 border-orange-200 dark:border-orange-800">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-orange-700 dark:text-orange-300">
          <Calendar className="w-5 h-5" />
          Due for Review
        </CardTitle>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Spaced repetition schedule using SM-2 algorithm
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Review Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-orange-100 dark:border-orange-900">
              <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                {dueCards}
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400">Due Today</p>
            </div>
            <div className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-orange-100 dark:border-orange-900">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {cardStats?.upcoming || 0}
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400">Upcoming</p>
            </div>
            <div className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-orange-100 dark:border-orange-900">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {totalCards}
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400">Total</p>
            </div>
          </div>

          {/* Review Progress */}
          {totalCards > 0 && (
            <div className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-orange-100 dark:border-orange-900">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Review Progress
                </span>
                <span className="text-sm font-bold text-orange-600 dark:text-orange-400">
                  {reviewPercentage}%
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${
                    reviewPercentage > 50
                      ? 'bg-red-500'
                      : reviewPercentage > 30
                        ? 'bg-yellow-500'
                        : 'bg-green-500'
                  }`}
                  style={{ width: `${reviewPercentage}%` }}
                />
              </div>
            </div>
          )}

          {/* High Risk Topics */}
          {highRiskTopics.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-red-700 dark:text-red-400">
                <TrendingDown className="w-4 h-4" />
                High Risk Topics
              </div>
              <div className="space-y-2">
                {highRiskTopics.slice(0, 3).map((topic) => (
                  <div
                    key={topic.topicId}
                    className="flex items-start justify-between p-3 bg-white dark:bg-slate-800 rounded-lg border border-red-200 dark:border-red-900"
                  >
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white text-sm">
                        {topic.topicName}
                      </p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-gray-600 dark:text-gray-400">
                        <span>
                          Mastery: {Math.round(topic.masteryLevel * 100)}%
                        </span>
                        <span className="text-orange-600 dark:text-orange-400 font-semibold">
                          {topic.dueCards} due
                        </span>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="flex-shrink-0"
                      onClick={() => router.push(`/flashcards?topic=${topic.topicId}`)}
                    >
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CTA Button */}
          {dueCards > 0 && (
            <Button
              className="w-full bg-orange-600 hover:bg-orange-700 dark:bg-orange-600 dark:hover:bg-orange-700 text-white"
              onClick={() => router.push('/flashcards')}
            >
              <Clock className="w-4 h-4 mr-2" />
              Start Review Session ({dueCards} cards)
            </Button>
          )}

          {/* Empty State */}
          {dueCards === 0 && totalCards > 0 && (
            <div className="text-center py-4 text-gray-600 dark:text-gray-400">
              <div className="text-sm">✓ All caught up! Great work!</div>
              <div className="text-xs mt-1">Next reviews in {cardStats?.averageInterval || 1} days on average</div>
            </div>
          )}

          {totalCards === 0 && (
            <div className="text-center py-4 text-gray-600 dark:text-gray-400">
              <BookMarked className="w-6 h-6 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Start studying to create review cards</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
