'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { apiService } from '@/features/auth/services/apiClient';
import { AppErrorBoundary } from '@/features/security/components/AppErrorBoundary';
import { LoadingSpinner } from '@/shared/components/ui/loading-spinner';
import { SEO } from '@/shared/components/layout/SEO';
import { Clock, CheckCircle, XCircle, Brain } from 'lucide-react';

interface QuizResult {
  id: string;
  quizTitle: string;
  score: number;
  totalQuestions: number;
  correctAnswers: number;
  timeSpent: number;
  date: string;
  category: string;
  difficulty: string;
  questions: {
    id: string;
    question: string;
    userAnswer: string;
    correctAnswer: string;
    isCorrect: boolean;
  }[];
}

export default function QuizResultsPage() {
  const { quizId } = useParams();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<QuizResult[]>([]);
  const [selectedResult, setSelectedResult] = useState<QuizResult | null>(null);

  useEffect(() => {
    const fetchQuizResults = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const response = await apiService.get<QuizResult[]>(`/quiz/results/${quizId}`);
        setResults(response.data);
      } catch (err: unknown) {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError('Failed to load quiz results');
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchQuizResults();
  }, []);

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy':
        return 'text-green-500';
      case 'medium':
        return 'text-yellow-500';
      case 'hard':
        return 'text-red-500';
      default:
        return 'text-gray-500';
    }
  };

  if (isLoading) {
    return <LoadingSpinner fullScreen />;
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow-lg">
          <div className="text-center">
            <h2 className="mt-6 text-3xl font-extrabold text-gray-900">Error Loading Results</h2>
            <p className="mt-2 text-sm text-gray-600">{error}</p>
            <div className="mt-5">
              <button
                onClick={() => window.location.reload()}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <AppErrorBoundary>
      <SEO title="Quiz Results" description="View your quiz results and performance analytics" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Quiz Results</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Review your quiz performance and track your progress
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Results List */}
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
              <div className="p-6">
                <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                  Recent Results
                </h2>
                <div className="space-y-4">
                  {results.map(result => (
                    <div
                      key={result.id}
                      className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                      onClick={() => setSelectedResult(result)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                            {result.quizTitle}
                          </h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {result.category}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className={`text-2xl font-bold ${getScoreColor(result.score)}`}>
                            {result.score}%
                          </span>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {result.correctAnswers}/{result.totalQuestions} correct
                          </p>
                        </div>
                      </div>
                      <div className="mt-2 flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
                        <div className="flex items-center">
                          <Clock className="h-4 w-4 mr-1" />
                          {result.timeSpent} minutes
                        </div>
                        <span
                          className={`px-2 py-1 rounded-full ${getDifficultyColor(
                            result.difficulty
                          )} bg-opacity-10`}
                        >
                          {result.difficulty}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Selected Result Details */}
          <div className="lg:col-span-1">
            {selectedResult ? (
              <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
                <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                  Result Details
                </h2>
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Quiz</h3>
                    <p className="mt-1 text-lg text-gray-900 dark:text-white">
                      {selectedResult.quizTitle}
                    </p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Score</h3>
                    <p className={`mt-1 text-3xl font-bold ${getScoreColor(selectedResult.score)}`}>
                      {selectedResult.score}%
                    </p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      Questions
                    </h3>
                    <div className="mt-2 space-y-2">
                      {selectedResult.questions.map(question => (
                        <div
                          key={question.id}
                          className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                        >
                          <p className="text-sm text-gray-900 dark:text-white">
                            {question.question}
                          </p>
                          <div className="mt-2 flex items-center space-x-2">
                            {question.isCorrect ? (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            ) : (
                              <XCircle className="h-4 w-4 text-red-500" />
                            )}
                            <span className="text-sm text-gray-500 dark:text-gray-400">
                              Your answer: {question.userAnswer}
                            </span>
                          </div>
                          {!question.isCorrect && (
                            <p className="mt-1 text-sm text-green-500">
                              Correct answer: {question.correctAnswer}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
                <div className="text-center">
                  <Brain className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
                    No Result Selected
                  </h3>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Select a result to view details
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppErrorBoundary>
  );
}
