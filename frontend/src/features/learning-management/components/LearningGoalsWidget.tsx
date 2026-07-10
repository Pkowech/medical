'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import {
  Target,
  CheckCircle,
  Clock,
  TrendingUp,
  Plus,
  Flame,
  AlertCircle,
  ArrowRight,
} from 'lucide-react';
import { learningGoalsService, LearningGoal, GoalStats } from '@/features/learning-management/services/learningGoalsService';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

export const LearningGoalsWidget = () => {
  const { data: session } = useSession();
  const router = useRouter();
  const [goals, setGoals] = useState<LearningGoal[]>([]);
  const [stats, setStats] = useState<GoalStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!session?.user?.id) return;

      try {
        setIsLoading(true);
        setError(null);

        const [activeGoals, goalsStats] = await Promise.all([
          learningGoalsService.getActiveGoals(),
          learningGoalsService.getGoalsStats(),
        ]);

        setGoals(activeGoals);
        setStats(goalsStats);
      } catch (err) {
        console.error('Error fetching goals data:', err);
        setError('Failed to load goals');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [session?.user?.id]);

  const handleCompleteGoal = async (goalId: string) => {
    try {
      await learningGoalsService.completeGoal(goalId);
      setGoals((prev) => prev.filter((g) => g.id !== goalId));
      toast.success('Goal completed! 🎉');
      // Refresh stats
      const updatedStats = await learningGoalsService.getGoalsStats();
      setStats(updatedStats);
    } catch (error) {
      console.error('Error completing goal:', error);
      toast.error('Failed to complete goal');
    }
  };

  const handlePauseGoal = async (goalId: string) => {
    try {
      await learningGoalsService.pauseGoal(goalId);
      setGoals((prev) =>
        prev.map((g) =>
          g.id === goalId ? { ...g, status: 'paused' as const } : g
        )
      );
      toast.success('Goal paused');
    } catch (error) {
      console.error('Error pausing goal:', error);
      toast.error('Failed to pause goal');
    }
  };

  if (isLoading) {
    return (
      <Card className="bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-950/20 dark:to-blue-950/20 border-indigo-200 dark:border-indigo-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-indigo-700 dark:text-indigo-300">
            <Target className="w-5 h-5" />
            Learning Goals
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-20 bg-indigo-200 dark:bg-indigo-800 rounded-lg" />
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
            <Target className="w-5 h-5" />
            Learning Goals
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-red-600 dark:text-red-400">{error}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-950/20 dark:to-blue-950/20 border-indigo-200 dark:border-indigo-800">
      <CardHeader className="flex items-start justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-indigo-700 dark:text-indigo-300 mb-1">
            <Target className="w-5 h-5" />
            Learning Goals
          </CardTitle>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Track and achieve your learning objectives
          </p>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats Overview */}
        {stats && (
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <div className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-indigo-100 dark:border-indigo-900">
              <div className="text-lg font-bold text-indigo-600 dark:text-indigo-400">
                {stats.activeGoals}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Active</div>
            </div>
            <div className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-indigo-100 dark:border-indigo-900">
              <div className="text-lg font-bold text-green-600 dark:text-green-400">
                {stats.completedGoals}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Completed</div>
            </div>
            <div className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-indigo-100 dark:border-indigo-900">
              <div className="flex items-center gap-1">
                <Flame className="w-4 h-4 text-orange-500" />
                <div className="text-lg font-bold">{stats.currentStreak}</div>
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Streak</div>
            </div>
            <div className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-indigo-100 dark:border-indigo-900">
              <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
                {Math.round(stats.completionRate)}%
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Rate</div>
            </div>
          </div>
        )}

        {/* Active Goals List */}
        {goals.length > 0 ? (
          <div className="space-y-2">
            {goals.slice(0, 4).map((goal) => (
              <div
                key={goal.id}
                className="flex items-start justify-between p-3 bg-white dark:bg-slate-800 rounded-lg border border-indigo-100 dark:border-indigo-900 hover:shadow-md transition-shadow"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-semibold text-gray-900 dark:text-white truncate text-sm">
                      {goal.title}
                    </h4>
                    <Badge
                      variant="secondary"
                      className={`text-xs flex-shrink-0 ${
                        goal.priority === 'high'
                          ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200'
                          : goal.priority === 'medium'
                            ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-200'
                            : 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200'
                      }`}
                    >
                      {goal.priority}
                    </Badge>
                  </div>

                  {/* Progress Bar */}
                  {goal.progress !== undefined && (
                    <div className="mb-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-gray-600 dark:text-gray-400">
                          Progress
                        </span>
                        <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                          {Math.round(goal.progress)}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                        <div
                          className="h-1.5 rounded-full bg-gradient-to-r from-indigo-500 to-blue-500 transition-all"
                          style={{ width: `${goal.progress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Target Date */}
                  <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                    <Clock className="w-3 h-3" />
                    <span>
                      Due:{' '}
                      {new Date(goal.targetDate).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0"
                    onClick={() => handleCompleteGoal(goal.id)}
                    title="Mark as complete"
                  >
                    <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0"
                    onClick={() => handlePauseGoal(goal.id)}
                    title="Pause"
                  >
                    <AlertCircle className="w-4 h-4 text-gray-400" />
                  </Button>
                </div>
              </div>
            ))}

            {goals.length > 4 && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => router.push('/goals')}
              >
                View All {goals.length} Goals
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            )}
          </div>
        ) : (
          <div className="text-center py-6 text-gray-600 dark:text-gray-400">
            <Target className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm mb-3">No active goals yet</p>
            <Button
              size="sm"
              className="gap-2"
              onClick={() => router.push('/goals/create')}
            >
              <Plus className="w-4 h-4" />
              Create Your First Goal
            </Button>
          </div>
        )}

        {/* CTA */}
        {goals.length > 0 && (
          <Button
            className="w-full bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-700 text-white gap-2"
            onClick={() => router.push('/goals')}
          >
            <TrendingUp className="w-4 h-4" />
            Manage All Goals
          </Button>
        )}
      </CardContent>
    </Card>
  );
};
