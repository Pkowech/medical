'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Target,
  TrendingUp,
  Calendar,
  Flame,
  ChevronRight,
  AlertCircle,
  CheckCircle,
  Clock,
} from 'lucide-react';
import { LearningGoal, GoalAnalytics } from '@/shared/types/learningGoalsInterface';
import { apiService } from '@/features/auth/services/apiClient';
import progressService from '../../services/progressService';
import { useAuthStore } from '@/features/auth/store/useAuthStore';

export const GoalsProgressWidget: React.FC = () => {
  const { user } = useAuthStore();
  const [goals, setGoals] = useState<LearningGoal[]>([]);
  const [analytics, setAnalytics] = useState<GoalAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchGoals();
    fetchAnalytics();
  }, [user?.id]);

  const fetchGoals = async () => {
    try {
      // Fetch goals with either active status or no status filter but let's use the explicit GoalStatus string "active"
      // Wait, learning-goals.dto.ts allows status: GoalStatus. But wait, we can just use status=active or simply fetch all and filter. The validation in GoalFiltersDto expects GoalStatus enum which contains 'active'.
      const response = await apiService.get<LearningGoal[]>(`/learning-goals?status=active`);
      if (response.success && Array.isArray(response.data)) {
        setGoals(response.data.slice(0, 3));
      } else {
        setGoals([]);
      }
    } catch (error) {
      console.error('Error fetching goals:', error);
      setGoals([]);
    }
  };

  const fetchAnalytics = async () => {
    try {
      const [analyticsApiResponse, streakData] = await Promise.all([
        apiService.get<GoalAnalytics>(`/learning-goals/stats/overview`),
        user?.id ? progressService.getUserStreaks(user.id) : Promise.resolve(null),
      ]);

      let baseAnalytics: Partial<GoalAnalytics> = {};
      if (analyticsApiResponse.success && analyticsApiResponse.data) {
        baseAnalytics = analyticsApiResponse.data;
      }

      const enrichedAnalytics: GoalAnalytics = {
        totalGoals: baseAnalytics.totalGoals ?? 0,
        activeGoals: baseAnalytics.activeGoals ?? 0,
        completedGoals: baseAnalytics.completedGoals ?? 0,
        overdueGoals: baseAnalytics.overdueGoals ?? 0,
        completionRate: baseAnalytics.completionRate ?? 0,
        averageCompletionTimeDays: baseAnalytics.averageCompletionTimeDays ?? 0,
        goalsByCategory: baseAnalytics.goalsByCategory ?? {},
        goalsByPriority: baseAnalytics.goalsByPriority ?? {},
        streakData: {
          currentStreak: streakData?.currentStreak ?? baseAnalytics.streakData?.currentStreak ?? 0,
          longestStreak: streakData?.longestStreak ?? baseAnalytics.streakData?.longestStreak ?? 0,
        },
        upcomingDeadlines: baseAnalytics.upcomingDeadlines ?? [],
      };

      setAnalytics(enrichedAnalytics);
    } catch (error) {
      console.error('Error fetching goal analytics:', error);
      // Set default analytics with zero streak if fetch fails
      setAnalytics({
        totalGoals: 0,
        activeGoals: 0,
        completedGoals: 0,
        overdueGoals: 0,
        completionRate: 0,
        averageCompletionTimeDays: 0,
        goalsByCategory: {},
        goalsByPriority: {},
        streakData: { currentStreak: 0, longestStreak: 0 },
        upcomingDeadlines: [],
      });
    } finally {
      setLoading(false);
    }
  };

  const getPriorityColor = (priority: string | undefined | null) => {
    if (!priority || typeof priority !== 'string') {
      return 'text-gray-600 bg-gray-100 dark:bg-slate-800 dark:text-slate-300';
    }
    switch (priority.toLowerCase()) {
      case 'critical':
        return 'text-red-600 bg-red-100 dark:bg-red-950/50 dark:text-red-300';
      case 'high':
        return 'text-orange-600 bg-orange-100 dark:bg-orange-950/50 dark:text-orange-300';
      case 'medium':
        return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-950/50 dark:text-yellow-300';
      case 'low':
        return 'text-green-600 bg-green-100 dark:bg-green-950/50 dark:text-green-300';
      default:
        return 'text-gray-600 bg-gray-100 dark:bg-slate-800 dark:text-slate-300';
    }
  };

  const getDaysRemaining = (targetDate: string) => {
    const target = new Date(targetDate);
    const now = new Date();
    const diffTime = target.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const formatDaysRemaining = (days: number) => {
    if (days < 0) return `${Math.abs(days)} days overdue`;
    if (days === 0) return 'Due today';
    if (days === 1) return 'Due tomorrow';
    if (days <= 7) return `${days} days left`;
    if (days <= 30) return `${Math.ceil(days / 7)} weeks left`;
    return `${Math.ceil(days / 30)} months left`;
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-4 flex items-center space-x-3">
          <div className="rounded-lg bg-green-100 p-2 dark:bg-green-950/50">
            <Target className="h-5 w-5 text-green-600 dark:text-green-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Learning Goals</h3>
        </div>
        <div className="animate-pulse space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-16 rounded-lg bg-gray-100 dark:bg-slate-800"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="rounded-lg bg-green-100 p-2 dark:bg-green-950/50">
            <Target className="h-5 w-5 text-green-600 dark:text-green-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Learning Goals</h3>
        </div>
        <Link
          href="/study-planner/goals"
          className="flex items-center space-x-1 text-sm font-medium text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300"
        >
          <span>View All</span>
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>

      {/* Quick Stats */}
      {analytics && (
        <div className="mt-6 grid grid-cols-2 gap-4 border-t border-gray-200 pt-6 text-center dark:border-slate-700">
          <div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{analytics.activeGoals}</div>
            <div className="text-xs text-gray-500 dark:text-slate-400">Active Goals</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {Math.round(analytics.completionRate)}%
            </div>
            <div className="text-xs text-gray-500 dark:text-slate-400">Completion Rate</div>
          </div>
        </div>
      )}

      {goals.length === 0 ? (
        <div className="text-center py-8">
          <Target className="mx-auto mb-3 h-12 w-12 text-gray-400 dark:text-slate-500" />
          <h4 className="mb-2 text-lg font-medium text-gray-900 dark:text-white">No Active Goals</h4>
          <p className="mb-4 text-gray-500 dark:text-slate-400">
            Set learning goals to track your progress and stay motivated
          </p>
          <Link
            href="/study-planner/goals"
            className="inline-flex items-center space-x-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
          >
            <Target className="w-4 h-4" />
            <span>Create Your First Goal</span>
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {goals.map(goal => {
            const daysRemaining = getDaysRemaining(goal.targetDate);
            const isOverdue = daysRemaining < 0;
            const isDueSoon = daysRemaining <= 7 && daysRemaining >= 0;

            return (
              <div
                key={goal.id}
                className="rounded-lg border border-gray-200 p-4 transition-all hover:border-green-300 hover:shadow-sm dark:border-slate-700 dark:hover:border-green-800"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h4 className="mb-1 font-medium text-gray-900 dark:text-white">{goal.title}</h4>
                    <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-slate-400">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(goal.priority)}`}
                      >
                        {goal.priority}
                      </span>
                      <span className="capitalize">{goal.category.replace('_', ' ')}</span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    {goal.streakCount > 0 && (
                      <div className="flex items-center space-x-1 text-orange-600 dark:text-orange-400">
                        <Flame className="w-3 h-3" />
                        <span className="text-xs font-medium">{goal.streakCount}</span>
                      </div>
                    )}

                    {goal.status === 'completed' ? (
                      <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                    ) : isOverdue ? (
                      <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                    ) : isDueSoon ? (
                      <Clock className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                    ) : (
                      <Target className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    )}
                  </div>
                </div>

                <div className="mb-3">
                  <div className="mb-1 flex items-center justify-between text-sm text-gray-600 dark:text-slate-300">
                    <span>Progress</span>
                    <span>{Math.round(goal.progressPercentage)}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-gray-200 dark:bg-slate-700">
                    <div
                      className={`h-2 rounded-full transition-all duration-300 dynamic-width ${
                        goal.status === 'completed' ? 'bg-green-600' : 'bg-blue-600'
                      }`}
                      style={{ '--width': `${goal.progressPercentage}%` } as React.CSSProperties} />
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <div className="text-gray-600 dark:text-slate-300">
                    <span className="font-medium">Target: </span>
                    {goal.targetCriteria?.targetValue || 0} {goal.targetCriteria?.unit || ''}
                  </div>

                  <div
                    className={`flex items-center space-x-1 ${
                      isOverdue
                        ? 'text-red-600 dark:text-red-400'
                        : isDueSoon
                          ? 'text-orange-600 dark:text-orange-400'
                          : 'text-gray-500 dark:text-slate-400'
                    }`}
                  >
                    <Calendar className="w-3 h-3" />
                    <span className="text-xs">{formatDaysRemaining(daysRemaining)}</span>
                  </div>
                </div>
              </div>
            );
          })}

          <div className="border-t border-gray-100 pt-2 dark:border-slate-700">
            <Link
              href="/study-planner/goals"
              className="flex items-center justify-center space-x-2 py-2 text-sm font-medium text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300"
            >
              <TrendingUp className="w-4 h-4" />
              <span>Manage All Goals</span>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};