'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2, XCircle } from 'lucide-react';
import { API_PATHS } from '@/lib/auth/apiPaths';
import { apiService } from '@/features/auth/services/apiClient';
import { useAuthStore } from '@/features/auth/store/useAuthStore';
import { AppErrorBoundary } from '@/features/security/components/AppErrorBoundary';
import { LoadingSpinner } from '@/shared/components/ui/loading-spinner';
import { SEO } from '@/shared/components/layout/SEO';
import { Button } from '@/shared/components/ui/button';
import { Card } from '@/shared/components/ui/card';

interface QuizAttempt {
  id: string;
  quizId: string;
  score: number;
  percentage: number;
  correctAnswers: number;
  totalQuestions: number;
  completedAt: string | null;
  isPassed: boolean;
}

interface QuizResultsSummary {
  totalQuizzes: number;
  completedQuizzes: number;
  averageScore: number;
  attempts: QuizAttempt[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isQuizAttempt(value: unknown): value is QuizAttempt {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.quizId === 'string' &&
    typeof value.score === 'number' &&
    typeof value.percentage === 'number' &&
    typeof value.correctAnswers === 'number' &&
    typeof value.totalQuestions === 'number' &&
    (typeof value.completedAt === 'string' || value.completedAt === null) &&
    typeof value.isPassed === 'boolean'
  );
}

function isQuizResultsSummary(value: unknown): value is QuizResultsSummary {
  return (
    isRecord(value) &&
    typeof value.totalQuizzes === 'number' &&
    typeof value.completedQuizzes === 'number' &&
    typeof value.averageScore === 'number' &&
    Array.isArray(value.attempts) &&
    value.attempts.every(isQuizAttempt)
  );
}

export default function QuizResultsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const unitId = searchParams.get('unitId');
  const userId = useAuthStore(state => state.user?.id);
  const [isLoading, setIsLoading] = useState(Boolean(unitId));
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<QuizResultsSummary | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!unitId) {
      setIsLoading(false);
      return;
    }
    if (!userId) {
      setError('Sign in to view your quiz results.');
      setIsLoading(false);
      return;
    }

    let isCurrent = true;
    const fetchQuizResults = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await apiService.get<unknown>(API_PATHS.QUIZ.RESULTS(userId, unitId));
        const payload =
          isRecord(response) && response.success === true && 'data' in response
            ? response.data
            : response;

        if (!isQuizResultsSummary(payload)) {
          throw new Error('Quiz results were returned in an unsupported format.');
        }
        if (isCurrent) setResults(payload);
      } catch (err: unknown) {
        if (isCurrent) {
          setError(err instanceof Error ? err.message : 'Failed to load quiz results.');
        }
      } finally {
        if (isCurrent) setIsLoading(false);
      }
    };

    void fetchQuizResults();
    return () => {
      isCurrent = false;
    };
  }, [reloadKey, unitId, userId]);

  if (!unitId) {
    return (
      <AppErrorBoundary>
        <SEO title="Quiz Results" description="View your quiz results and performance analytics" />
        <div className="mx-auto max-w-3xl px-4 py-8">
          <Card className="p-8 text-center">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Quiz Results</h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              Choose a quiz from your history to review results for its unit.
            </p>
            <Button className="mt-5" onClick={() => router.push('/quiz/history')}>
              View quiz history
            </Button>
          </Card>
        </div>
      </AppErrorBoundary>
    );
  }

  if (isLoading) return <LoadingSpinner fullScreen />;

  if (error) {
    return (
      <AppErrorBoundary>
        <SEO title="Quiz Results" description="View your quiz results and performance analytics" />
        <div className="mx-auto max-w-3xl px-4 py-8">
          <Card className="p-8 text-center">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Unable to load results
            </h1>
            <p role="alert" className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              {error}
            </p>
            <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
              <Button onClick={() => setReloadKey(key => key + 1)}>Try again</Button>
              <Button variant="outline" onClick={() => router.push('/quiz/history')}>
                View quiz history
              </Button>
            </div>
          </Card>
        </div>
      </AppErrorBoundary>
    );
  }

  if (!results) return null;

  return (
    <AppErrorBoundary>
      <SEO title="Quiz Results" description="View your quiz results and performance analytics" />
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Quiz Results</h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Your recent attempts for this unit.
            </p>
          </div>
          <Button variant="outline" onClick={() => router.push('/quiz/history')}>
            View quiz history
          </Button>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Card className="p-4">
            <p className="text-sm text-slate-500 dark:text-slate-400">Total attempts</p>
            <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
              {results.totalQuizzes}
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-slate-500 dark:text-slate-400">Completed attempts</p>
            <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
              {results.completedQuizzes}
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-slate-500 dark:text-slate-400">Average score</p>
            <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
              {Math.round(results.averageScore)}%
            </p>
          </Card>
        </div>

        <section aria-labelledby="attempts-heading" className="space-y-3">
          <h2
            id="attempts-heading"
            className="text-lg font-semibold text-slate-900 dark:text-white"
          >
            Attempts
          </h2>
          {results.attempts.map((attempt, index) => (
            <Card
              key={attempt.id}
              className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-white">
                  Attempt {results.attempts.length - index}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {attempt.completedAt
                    ? new Date(attempt.completedAt).toLocaleString()
                    : 'In progress'}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <span className="text-lg font-bold text-slate-900 dark:text-white">
                  {Math.round(attempt.percentage)}%
                </span>
                <span className="text-sm text-slate-600 dark:text-slate-400">
                  {attempt.correctAnswers}/{attempt.totalQuestions} correct
                </span>
                <span
                  className={`inline-flex items-center gap-1 text-sm font-medium ${
                    attempt.isPassed
                      ? 'text-green-700 dark:text-green-400'
                      : 'text-amber-700 dark:text-amber-400'
                  }`}
                >
                  {attempt.isPassed ? (
                    <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
                  ) : (
                    <XCircle aria-hidden="true" className="h-4 w-4" />
                  )}
                  {attempt.isPassed ? 'Passed' : 'Needs review'}
                </span>
              </div>
            </Card>
          ))}

          {results.attempts.length === 0 && (
            <Card className="p-6 text-center">
              <p className="text-slate-600 dark:text-slate-400">
                No quiz attempts have been recorded for this unit yet.
              </p>
              <Button className="mt-4" onClick={() => router.push(`/quiz/unit/${unitId}`)}>
                Start unit quiz
              </Button>
            </Card>
          )}
        </section>
      </div>
    </AppErrorBoundary>
  );
}
