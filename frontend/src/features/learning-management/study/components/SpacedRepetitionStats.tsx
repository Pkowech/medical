import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader } from '@/shared/components/ui/card';

import { flashcardApi, CardStats } from '@/features/assessment/services/flashcardApi';
import { useAuthStore } from '@/features/auth/store/useAuthStore';

export const SpacedRepetitionStats: React.FC = () => {
  const { user } = useAuthStore();
  const [stats, setStats] = useState<CardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      if (!user) return;
      try {
        const data = await flashcardApi.getCardStats(user.id);
        setStats(data);
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [user]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[200px]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex justify-center items-center min-h-[200px]">
        <p className="text-gray-500 dark:text-gray-400">No statistics available</p>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <h3 className="text-lg font-semibold">Spaced Repetition Progress</h3>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="text-center">
            <p className="text-3xl font-semibold text-blue-600 dark:text-blue-400">
              {stats.totalCards}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Total Cards</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-semibold text-red-600 dark:text-red-400">
              {stats.dueToday}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Due Today</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-semibold text-yellow-600 dark:text-yellow-400">
              {stats.mastered}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Mastered</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-semibold text-green-600 dark:text-green-400">
              {stats.avgEaseFactor.toFixed(2)}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Avg. Ease Factor</p>
          </div>
        </div>
        <div className="mt-8 flex justify-center">
          <button
            onClick={() => window.location.href = '/flashcards'}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-medium shadow-sm"
          >
            Manage My Flashcard Decks
          </button>
        </div>
      </CardContent>
    </Card>
  );
};
