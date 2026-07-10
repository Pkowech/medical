'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Sparkles, ArrowRight, BookOpen } from 'lucide-react';
import { learningPathService } from '@/features/learning-management/services/learningPathService';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { LearningPath } from '@/shared/types/learningInterface';

export const RecommendationsWidget = () => {
  const { data: session } = useSession();
  const router = useRouter();
  const [recommendations, setRecommendations] = useState<LearningPath[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRecommendations = async () => {
      if (!session?.user?.id) return;

      try {
        setIsLoading(true);
        setError(null);
        const paths = await learningPathService.getRecommendedPaths(5);
        setRecommendations(paths);
      } catch (err) {
        console.error('Error fetching recommendations:', err);
        setError('Failed to load recommendations');
        setRecommendations([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRecommendations();
  }, [session?.user?.id]);

  if (isLoading) {
    return (
      <Card className="bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-950/20 dark:to-indigo-950/20 border-purple-200 dark:border-purple-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-purple-700 dark:text-purple-300">
            <Sparkles className="w-5 h-5" />
            Recommended For You
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-purple-200 dark:bg-purple-800 rounded-lg" />
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
            <Sparkles className="w-5 h-5" />
            Recommended For You
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-red-600 dark:text-red-400">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (recommendations.length === 0) {
    return (
      <Card className="bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-950/20 dark:to-indigo-950/20 border-purple-200 dark:border-purple-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-purple-700 dark:text-purple-300">
            <Sparkles className="w-5 h-5" />
            Recommended For You
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600 dark:text-gray-400 text-center py-4">
            Complete more courses to get personalized recommendations
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-950/20 dark:to-indigo-950/20 border-purple-200 dark:border-purple-800">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-purple-700 dark:text-purple-300">
          <Sparkles className="w-5 h-5" />
          Recommended For You
        </CardTitle>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Based on your learning progress and mastery level
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {recommendations.map((path) => (
            <div
              key={path.id}
              className="flex items-start justify-between p-4 bg-white dark:bg-slate-800 rounded-lg border border-purple-100 dark:border-purple-900 hover:shadow-md transition-shadow"
            >
              <div className="flex-1">
                <div className="flex items-start gap-2">
                  <BookOpen className="w-5 h-5 text-purple-600 dark:text-purple-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-white">
                      {path.title}
                    </h4>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                      {path.description}
                    </p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-500 dark:text-gray-400">
                      <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 rounded">
                        {path.difficulty || 'Intermediate'}
                      </span>
                      <span>
                        ~{path.estimatedDurationWeeks || 4} weeks
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="ml-2 flex-shrink-0 border-purple-200 dark:border-purple-800 hover:bg-purple-100 dark:hover:bg-purple-900"
                onClick={() => router.push(`/learning-paths/${path.id}`)}
              >
                Start
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
