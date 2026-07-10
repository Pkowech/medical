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
      return 'text-gray-600 bg-gray-100';
    }
    switch (priority.toLowerCase()) {
      case 'critical':
        return 'text-red-600 bg-red-100';
      case 'high':
        return 'text-orange-600 bg-orange-100';
      case 'medium':
        return 'text-yellow-600 bg-yellow-100';
      case 'low':
        return 'text-green-600 bg-green-100';
      default:
        return 'text-gray-600 bg-gray-100';
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
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center space-x-3 mb-4">
          <div className="p-2 bg-green-100 rounded-lg">
            <Target className="w-5 h-5 text-green-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900">Learning Goals</h3>
        </div>
        <div className="animate-pulse space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-100 rounded-lg"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-green-100 rounded-lg">
            <Target className="w-5 h-5 text-green-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900">Learning Goals</h3>
        </div>
        <Link
          href="/study-planner/goals"
          className="text-green-600 hover:text-green-700 text-sm font-medium flex items-center space-x-1"
        >
          <span>View All</span>
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>

      {/* Quick Stats */}
      {analytics && (
        <div className="grid grid-cols-2 gap-4 text-center mt-6 pt-6 border-t border-gray-200">
          <div>
            <div className="text-2xl font-bold text-gray-900">{analytics.activeGoals}</div>
            <div className="text-xs text-gray-500">Active Goals</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">
              {Math.round(analytics.completionRate)}%
            </div>
            <div className="text-xs text-gray-500">Completion Rate</div>
          </div>
        </div>
      )}

      {goals.length === 0 ? (
        <div className="text-center py-8">
          <Target className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <h4 className="text-lg font-medium text-gray-900 mb-2">No Active Goals</h4>
          <p className="text-gray-500 mb-4">
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

            const pct = Math.min(100, Math.max(0, Math.round(goal.progressPercentage / 10) * 10));
            const widthClass = `w-[${pct}%]`;

            return (
              <div
                key={goal.id}
                className="p-4 border border-gray-200 rounded-lg hover:border-green-300 hover:shadow-sm transition-all"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900 mb-1">{goal.title}</h4>
                    <div className="flex items-center space-x-2 text-sm text-gray-500">
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
                      <div className="flex items-center space-x-1 text-orange-600">
                        <Flame className="w-3 h-3" />
                        <span className="text-xs font-medium">{goal.streakCount}</span>
                      </div>
                    )}

                    {goal.status === 'completed' ? (
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    ) : isOverdue ? (
                      <AlertCircle className="w-5 h-5 text-red-600" />
                    ) : isDueSoon ? (
                      <Clock className="w-5 h-5 text-orange-600" />
                    ) : (
                      <Target className="w-5 h-5 text-blue-600" />
                    )}
                  </div>
                </div>

                <div className="mb-3">
                  <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
                    <span>Progress</span>
                    <span>{Math.round(goal.progressPercentage)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all duration-300 dynamic-width ${
                        goal.status === 'completed' ? 'bg-green-600' : 'bg-blue-600'
                      }`}
                      style={{ '--width': `${goal.progressPercentage}%` } as React.CSSProperties} />
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <div className="text-gray-600">
                    <span className="font-medium">Target: </span>
                    {goal.targetCriteria?.targetValue || 0} {goal.targetCriteria?.unit || ''}
                  </div>

                  <div
                    className={`flex items-center space-x-1 ${
                      isOverdue ? 'text-red-600' : isDueSoon ? 'text-orange-600' : 'text-gray-500'
                    }`}
                  >
                    <Calendar className="w-3 h-3" />
                    <span className="text-xs">{formatDaysRemaining(daysRemaining)}</span>
                  </div>
                </div>
              </div>
            );
          })}

          <div className="pt-2 border-t border-gray-100">
            <Link
              href="/study-planner/goals"
              className="flex items-center justify-center space-x-2 text-green-600 hover:text-green-700 text-sm font-medium py-2"
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