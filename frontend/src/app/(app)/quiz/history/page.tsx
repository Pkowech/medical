'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiService } from '@/features/auth/services/apiClient';
import { AppErrorBoundary } from '@/features/security/components/AppErrorBoundary';
import { LoadingSpinner } from '@/shared/components/ui/loading-spinner';
import { Card } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { toast } from 'sonner';
import { Calendar, Clock, Award, BarChart } from 'lucide-react';

interface QuizAttempt {
  id: string;
  quizId: string;
  quizTitle: string;
  score: number;
  totalQuestions: number;
  correctAnswers: number;
  timeSpent: number;
  completedAt: string;
  unitId: string;
  unitTitle: string;
}

interface QuizStats {
  totalAttempts: number;
  averageScore: number;
  bestScore: number;
  totalTimeSpent: number;
  recentImprovement: number;
}

export default function QuizHistoryPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [attempts, setAttempts] = useState<QuizAttempt[]>([]);
  const [stats, setStats] = useState<QuizStats>({
    totalAttempts: 0,
    averageScore: 0,
    bestScore: 0,
    totalTimeSpent: 0,
    recentImprovement: 0,
  });

  useEffect(() => {
    const fetchQuizHistory = async () => {
      try {
        setLoadError(null);
        const response = await apiService.get<
          { attempts: QuizAttempt[]; stats: QuizStats } | {
            data: { attempts: QuizAttempt[]; stats: QuizStats };
          }
        >('/assessment-progress/history');
        const payload = response.data;
        const history = 'data' in payload ? payload.data : payload;
        setAttempts(history.attempts);
        setStats(history.stats);
      } catch {
        setLoadError('Unable to load quiz history. Please try again.');
        toast.error('Failed to load quiz history');
      } finally {
        setLoading(false);
      }
    };

    fetchQuizHistory();
  }, [reloadKey]);

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (loadError) {
    return (
      <AppErrorBoundary>
        <div className="container mx-auto px-4 py-8">
          <Card className="p-6 text-center">
            <p className="text-red-600">{loadError}</p>
            <Button className="mt-4" onClick={() => setReloadKey(key => key + 1)}>
              Try Again
            </Button>
          </Card>
        </div>
      </AppErrorBoundary>
    );
  }

  return (
    <AppErrorBoundary>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Quiz History</h1>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card className="p-4">
            <div className="flex items-center space-x-4">
              <Award className="w-8 h-8 text-blue-500" />
              <div>
                <p className="text-sm text-gray-500">Total Attempts</p>
                <p className="text-2xl font-bold">{stats.totalAttempts}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center space-x-4">
              <BarChart className="w-8 h-8 text-green-500" />
              <div>
                <p className="text-sm text-gray-500">Average Score</p>
                <p className="text-2xl font-bold">
                  {stats.totalAttempts > 0 ? `${stats.averageScore.toFixed(1)}%` : '—'}
                </p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center space-x-4">
              <Award className="w-8 h-8 text-yellow-500" />
              <div>
                <p className="text-sm text-gray-500">Best Score</p>
                <p className="text-2xl font-bold">
                  {stats.totalAttempts > 0 ? `${stats.bestScore.toFixed(1)}%` : '—'}
                </p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center space-x-4">
              <Clock className="w-8 h-8 text-purple-500" />
              <div>
                <p className="text-sm text-gray-500">Total Time</p>
                <p className="text-2xl font-bold">{formatTime(stats.totalTimeSpent)}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Quiz Attempts List */}
        <div className="space-y-4">
          {attempts.map(attempt => (
            <Card key={attempt.id} className="p-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold">{attempt.quizTitle}</h3>
                    <p className="text-sm text-gray-500">{attempt.unitTitle || 'Independent quiz'}</p>
                  <div className="flex items-center space-x-4 text-sm text-gray-500">
                    <div className="flex items-center">
                      <Calendar className="w-4 h-4 mr-1" />
                      {formatDate(attempt.completedAt)}
                    </div>
                    <div className="flex items-center">
                      <Clock className="w-4 h-4 mr-1" />
                      {formatTime(attempt.timeSpent)}
                    </div>
                  </div>
                </div>
                <div className="mt-4 md:mt-0 text-right">
                  <div className="text-2xl font-bold text-blue-600">
                    {attempt.score.toFixed(1)}%
                  </div>
                  <p className="text-sm text-gray-500">
                    {attempt.correctAnswers} of {attempt.totalQuestions} correct
                  </p>
                  {attempt.unitId ? (
                    <Button
                      variant="outline"
                      className="mt-2"
                      onClick={() => router.push(`/quiz/unit/${attempt.unitId}`)}
                    >
                      Retake Unit Quiz
                    </Button>
                  ) : (
                    <p className="mt-2 text-xs text-gray-500">This quiz is no longer linked to a unit.</p>
                  )}
                </div>
              </div>
            </Card>
          ))}

          {attempts.length === 0 && (
            <Card className="p-6 text-center">
              <p className="text-gray-500">No quiz attempts found</p>
              <Button className="mt-4" onClick={() => router.push('/courses')}>
                Start Learning
              </Button>
            </Card>
          )}
        </div>
      </div>
    </AppErrorBoundary>
  );
}
