'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/features/auth/store/useAuthStore';
import { useSpacedRepetition } from '@/features/assessment/hooks/useSpacedRepetition';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Brain, Clock, CheckCircle2, RefreshCw } from 'lucide-react';
import { Progress } from '@/shared/components/ui/progress';

export default function FlashcardsPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { stats, isLoading, syncCards } = useSpacedRepetition(user?.id || '');

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
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Flashcard Decks</h1>
          <p className="text-gray-600 dark:text-slate-400">Master medical concepts with spaced repetition.</p>
        </div>
        <Button variant="outline" onClick={() => syncCards()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Sync Progress
        </Button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500 uppercase tracking-wider">Due for Review</CardTitle>
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
            <CardTitle className="text-sm font-medium text-gray-500 uppercase tracking-wider">Total Mastered</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center">
              <CheckCircle2 className="h-8 w-8 text-green-500 mr-3" />
              <div className="text-3xl font-bold">{stats?.total ? stats.total - stats.due : 0}</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500 uppercase tracking-wider">Retention Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center">
              <Brain className="h-8 w-8 text-blue-500 mr-3" />
              <div className="text-3xl font-bold">85%</div>
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
            <p className="text-sm text-gray-600 dark:text-slate-400 mb-4">
              Comprehensive review including all topics from your active courses.
            </p>
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>Mastery Progress</span>
                <span>{stats?.total ? Math.round(((stats.total - stats.due) / stats.total) * 100) : 0}%</span>
              </div>
              <Progress value={stats?.total ? ((stats.total - stats.due) / stats.total) * 100 : 0} className="h-2" />
            </div>
          </CardContent>
          <CardFooter>
            <Button className="w-full" onClick={() => router.push('/flashcards/all')}>
              Study Now
            </Button>
          </CardFooter>
        </Card>

        {/* Placeholder for dynamic decks if we had categorisation */}
        <Card className="border-dashed border-2 opacity-60">
          <CardHeader>
            <CardTitle className="text-gray-400 text-sm">More Decks Coming Soon</CardTitle>
          </CardHeader>
          <CardContent className="h-24 flex items-center justify-center">
            <p className="text-xs text-center text-gray-400">Complete more units to unlock specialized flashcard decks.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
