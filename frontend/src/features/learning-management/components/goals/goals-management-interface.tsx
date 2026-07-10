'use client';

import React, { useState, useEffect } from 'react';
import {
  Target,
  Plus,
  Calendar,
  Clock,
  TrendingUp,
  CheckCircle,
  AlertCircle,
  Search,
  Edit,
  Trash2,
  Flame,
  BarChart3,
} from 'lucide-react';
import { apiService } from '@/features/auth/services/apiClient';
import { LearningGoal, GoalAnalytics } from '@/shared/types/learningGoalsInterface';
import progressService from '../../services/progressService';
import { useAuthStore } from '@/features/auth/store/useAuthStore';
import { usePageHeader } from '@/core/providers/HeaderContext';
import RecommendedGoals from './recommended-goals';
import { GoalCreationWizard } from './goal-creation-wizard';
import { StatCard } from '@/shared/components/ui/StatCard';

const getProgressBarWidth = (percentage: number): string => {
  if (percentage === 0) return 'w-0';
  if (percentage <= 10) return 'w-1/12';
  if (percentage <= 20) return 'w-1/6';
  if (percentage <= 30) return 'w-1/4';
  if (percentage <= 40) return 'w-2/5';
  if (percentage <= 50) return 'w-1/2';
  if (percentage <= 60) return 'w-3/5';
  if (percentage <= 70) return 'w-7/12';
  if (percentage <= 80) return 'w-4/5';
  if (percentage <= 90) return 'w-11/12';
  return 'w-full';
};

export const GoalsManagementInterface: React.FC = () => {
  const { user } = useAuthStore();
  const { setHeader } = usePageHeader();

  useEffect(() => {
    setHeader({
      title: 'Learning Goals',
      description: 'Track your academic milestones and progress',
    });
    return () => setHeader(null);
  }, [setHeader]);
  const [goals, setGoals] = useState<LearningGoal[]>([]);
  const [analytics, setAnalytics] = useState<GoalAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'active' | 'completed' | 'all'>('active');
  const [filters, setFilters] = useState({
    category: '',
    priority: '',
    search: '',
    dueSoon: false,
    overdue: false,
  });
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [recommendationToAccept, setRecommendationToAccept] = useState<Partial<LearningGoal> | null>(null);

  useEffect(() => {
    fetchGoals();
    fetchAnalytics();
  }, [filters, activeTab]);

  const fetchGoals = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams();

      // Add status filter based on active tab
      if (activeTab === 'active') {
        queryParams.append('status', 'active');
      } else if (activeTab === 'completed') {
        queryParams.append('status', 'completed');
      }

      // Add other filters
      Object.entries(filters).forEach(([key, value]) => {
        if (value) queryParams.append(key, value.toString());
      });

      const response = await apiService.get<LearningGoal[] | { data: LearningGoal[] } | { data: { data: LearningGoal[] } }>(`/learning-goals?${queryParams}`);
      // Handle potential different response structures
      const responseData = response.data;
      let data: LearningGoal[];
      if (Array.isArray(responseData)) {
        data = responseData;
      } else if ('data' in responseData) {
        data = Array.isArray(responseData.data) 
          ? responseData.data 
          : (typeof responseData.data === 'object' && responseData.data !== null && 'data' in responseData.data 
              ? (responseData.data as { data: LearningGoal[] }).data 
              : []);
      } else {
        data = [];
      }
      setGoals(data); 
    } catch (error) {
      console.error('Error fetching goals:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalytics = async () => {
    try {
      const [analyticsResponse, streakData] = await Promise.all([
        apiService.get<GoalAnalytics | { data: GoalAnalytics }>(`/learning-goals/stats/overview`),
        user?.id ? progressService.getUserStreaks(user.id) : Promise.resolve(null),
      ]);

      const responseData = analyticsResponse.data;
      const data = 'data' in responseData ? responseData.data : responseData;
      const enrichedAnalytics: GoalAnalytics = {
        ...data,
        streakData: streakData ? {
          currentStreak: streakData.currentStreak || data?.streakData?.currentStreak || 0,
          longestStreak: streakData.longestStreak || data?.streakData?.longestStreak || 0,
        } : (data?.streakData || { currentStreak: 0, longestStreak: 0 }),
      };

      setAnalytics(enrichedAnalytics);
    } catch (error) {
      console.error('Error fetching analytics:', error);
      // Set default analytics if fetch fails
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
    }
  };

  const updateGoalProgress = async (goalId: string, progressValue: number, notes?: string) => {
    try {
      const response = await apiService.post(`/learning-goals/${goalId}/progress`, {
        progressValue,
        notes,
        entryType: 'manual',
      });

      if (response) {
        fetchGoals();
        fetchAnalytics();
      }
    } catch (error) {
      console.error('Error updating goal progress:', error);
    }
  };

  const getPriorityColor = (priority: string | undefined | null) => {
    if (!priority || typeof priority !== 'string') {
      return 'bg-gray-100 text-gray-800 border-gray-200';
    }
    switch (priority.toLowerCase()) {
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusColor = (status: string | undefined | null) => {
    if (!status || typeof status !== 'string') {
      return 'bg-gray-100 text-gray-800';
    }
    switch (status.toLowerCase()) {
      case 'active':
        return 'bg-indigo-100 text-indigo-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'paused':
        return 'bg-yellow-100 text-yellow-800';
      case 'cancelled':
        return 'bg-gray-100 text-gray-800';
      case 'overdue':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getDaysRemaining = (targetDate: string) => {
    const target = new Date(targetDate);
    const now = new Date();
    const diffTime = target.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const renderAnalyticsCards = () => {
    if (!analytics) return null;

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard 
          icon={Target} 
          title="Active Goals" 
          value={analytics.activeGoals} 
          subtitle="Direct focus"
          colorClass="bg-indigo-600"
        />
        <StatCard 
          icon={CheckCircle} 
          title="Completion Rate" 
          value={`${Math.round(analytics.completionRate)}%`} 
          subtitle="Total efficacy"
          colorClass="bg-green-600"
        />
        <StatCard 
          icon={Flame} 
          title="Current Streak" 
          value={analytics.streakData.currentStreak} 
          subtitle="Consecutive days"
          colorClass="bg-orange-600"
        />
        <StatCard 
          icon={AlertCircle} 
          title="Overdue" 
          value={analytics.overdueGoals} 
          subtitle="Requires attention"
          colorClass="bg-red-600"
        />
      </div>
    );
  };

  const renderGoalCard = (goal: LearningGoal) => {
    const daysRemaining = getDaysRemaining(goal.targetDate);
    const isOverdue = daysRemaining < 0 && goal.status === 'active';
    const isDueSoon = daysRemaining <= 7 && daysRemaining >= 0 && goal.status === 'active';

    return (
      <div
        key={goal.id}
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 hover:shadow-md transition-all duration-300 overflow-hidden flex flex-col"
      >
        <div className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{goal.title}</h3>
              <p className="text-gray-600 text-sm mb-3 line-clamp-2">{goal.description}</p>

              <div className="flex flex-wrap gap-2 mb-3">
                <span
                  className={`px-2 py-1 rounded-full text-xs font-medium border ${getPriorityColor(goal.priority)}`}
                >
                  {goal.priority}
                </span>
                <span
                  className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(goal.status)}`}
                >
                  {goal.status}
                </span>
                <span className="px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                  {goal.category.replace('_', ' ')}
                </span>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              {goal.streakCount > 0 && (
                <div className="flex items-center space-x-1 text-orange-600">
                  <Flame className="w-4 h-4" />
                  <span className="text-sm font-medium">{goal.streakCount}</span>
                </div>
              )}
            </div>
          </div>

          {/* Progress bar */}
          <div className="mb-4">
            <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
              <span>Progress</span>
              <span>{Math.round(goal.progressPercentage)}%</span>
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ease-out ${
                  goal.status === 'completed' ? 'bg-emerald-500' : 'bg-indigo-600'
                } ${getProgressBarWidth(goal.progressPercentage)}`}
              />
            </div>
          </div>

          {/* Target and current values */}
          <div className="flex items-center justify-between text-sm text-gray-600 mb-4">
            <div>
              <span className="font-medium">Current: </span>
              {goal.targetCriteria?.currentValue || 0} {goal.targetCriteria?.unit || ''}
            </div>
            <div>
              <span className="font-medium">Target: </span>
              {goal.targetCriteria?.targetValue || 0} {goal.targetCriteria?.unit || ''}
            </div>
          </div>

          {/* Milestones */}
          {goal.milestones && goal.milestones.length > 0 && (
            <div className="mb-4">
              <div className="text-sm font-medium text-gray-700 mb-2">Milestones</div>
              <div className="space-y-1">
                {goal.milestones.slice(0, 3).map(milestone => (
                  <div key={milestone.id} className="flex items-center space-x-2 text-sm">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        milestone.completed ? 'bg-green-500' : 'bg-gray-300'
                      }`}
                    />
                    <span
                      className={
                        milestone.completed ? 'text-green-700 line-through' : 'text-gray-600'
                      }
                    >
                      {milestone.title}
                    </span>
                  </div>
                ))}
                {goal.milestones.length > 3 && (
                  <div className="text-xs text-gray-500">
                    +{goal.milestones.length - 3} more milestones
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Timeline */}
          <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
            <div className="flex items-center space-x-1">
              <Calendar className="w-4 h-4" />
              <span>Due {new Date(goal.targetDate).toLocaleDateString()}</span>
            </div>

            <div
              className={`flex items-center space-x-1 ${
                isOverdue ? 'text-red-600' : isDueSoon ? 'text-orange-600' : 'text-gray-500'
              }`}
            >
              <Clock className="w-4 h-4" />
              <span>
                {isOverdue
                  ? `${Math.abs(daysRemaining)} days overdue`
                  : `${daysRemaining} days left`}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between">
            <div className="flex space-x-2">
              <button type="button" title="Edit goal" aria-label="Edit goal" className="p-2 text-gray-400 hover:text-indigo-600 transition-colors">
                <Edit className="w-4 h-4" />
              </button>
              <button type="button" title="Delete goal" aria-label="Delete goal" className="p-2 text-gray-400 hover:text-red-600 transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
              <button type="button" title="View analytics" aria-label="View goal analytics" className="p-2 text-gray-400 hover:text-green-600 transition-colors">
                <BarChart3 className="w-4 h-4" />
              </button>
            </div>

            <div className="flex space-x-2">
              {goal.status === 'active' && (
                <button
                  onClick={() => {
                    const newValue = prompt(
                      'Enter progress value:',
                      goal.targetCriteria?.currentValue?.toString() || '0'
                    );
                    if (newValue !== null) {
                      updateGoalProgress(goal.id, parseFloat(newValue));
                    }
                  }}
                  className="px-3 py-1 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700 transition-colors"
                >
                  Update Progress
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderFilters = () => (
    <div className="bg-slate-50/50 dark:bg-slate-800/30 rounded-2xl border border-slate-200/60 dark:border-slate-700/50 p-5 mb-10 shadow-sm backdrop-blur-xs">
      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-1">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 w-4 h-4 transition-colors" />
            <input
              type="text"
              placeholder="Filter goals by title or description..."
              value={filters.search}
              onChange={e => setFilters({ ...filters, search: e.target.value })}
              className="w-full pl-11 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <select
            value={filters.category}
            onChange={e => setFilters({ ...filters, category: e.target.value })}
            aria-label="Filter by category"
            title="Filter by category"
            className="select-custom-arrow px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all appearance-none cursor-pointer pr-10 min-w-40 font-medium"
          >
            <option value="">All Categories</option>
            <option value="study_time">Study Time</option>
            <option value="course_completion">Course Completion</option>
            <option value="assessment_score">Assessment Score</option>
          </select>
          <select
            value={filters.priority}
            onChange={e => setFilters({ ...filters, priority: e.target.value })}
            aria-label="Filter by priority"
            title="Filter by priority"
            className="select-custom-arrow px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all appearance-none cursor-pointer pr-10 min-w-40 font-medium"
          >
            <option value="">All Priorities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>

          <div className="flex items-center gap-6 px-2">
            <label className="flex items-center gap-2 cursor-pointer group">
              <input
                type="checkbox"
                checked={filters.dueSoon}
                onChange={e => setFilters({ ...filters, dueSoon: e.target.checked })}
                className="w-4 h-4 rounded-sm border-slate-300 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-0 transition-all"
              />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">Due Soon</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer group">
              <input
                type="checkbox"
                checked={filters.overdue}
                onChange={e => setFilters({ ...filters, overdue: e.target.checked })}
                className="w-4 h-4 rounded-sm border-slate-300 text-red-600 focus:ring-red-500 focus:ring-offset-0 transition-all"
              />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">Overdue</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex items-center justify-between mb-12">
        <div className="bg-indigo-600/10 px-4 py-2 rounded-2xl border border-indigo-600/20 shadow-sm backdrop-blur-xs">
          <p className="text-sm font-black text-indigo-700 dark:text-indigo-400 flex items-center gap-2 uppercase tracking-widest">
            <TrendingUp className="w-4 h-4" />
            Performance Insights
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center space-x-2 bg-indigo-600 text-white px-6 py-3 rounded-2xl hover:bg-indigo-700 shadow-lg shadow-indigo-500/20 transition-all text-sm font-bold active:scale-95"
        >
          <Plus className="w-5 h-5" />
          <span>Define New Goal</span>
        </button>
      </div>

      {renderAnalyticsCards()}

      <div className="flex items-center space-x-2 bg-slate-100/80 dark:bg-slate-800/80 p-1.5 rounded-2xl mb-10 w-fit border border-slate-200/60 dark:border-slate-700/50 shadow-xs backdrop-blur-md">
        {( [
          { id: 'active', label: 'In Progress', count: analytics?.activeGoals },
          { id: 'completed', label: 'Archived', count: analytics?.completedGoals },
          { id: 'all', label: 'Overview', count: analytics?.totalGoals },
        ] as const).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`
              px-6 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all
              ${
                activeTab === tab.id
                  ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-black/5'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-white/50'
              }
            `}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] ${
                activeTab === tab.id ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-200 text-gray-500'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {renderFilters()}

      <div className="flex flex-col lg:flex-row gap-8">
        <div className="flex-1">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {goals.map(goal => renderGoalCard(goal))}
            </div>
          )}

          {goals.length === 0 && !loading && (
            <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-gray-200 shadow-xs">
              <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <Target className="w-10 h-10 text-gray-300" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Focus on what matters</h3>
              <p className="text-gray-500 mb-8 max-w-sm mx-auto">
                {activeTab === 'active'
                  ? "Set structured goals to track your progress and stay motivated on your academic journey."
                  : 'No goals found matching your selected criteria.'}
              </p>
              {activeTab === 'active' && (
                <button
                  onClick={() => {
                    setRecommendationToAccept(null);
                    setShowCreateModal(true);
                  }}
                  className="bg-gray-900 text-white px-8 py-3 rounded-2xl hover:bg-gray-800 transition-all font-bold shadow-md active:scale-95"
                >
                  Create Your First Goal
                </button>
              )}
            </div>
          )}
        </div>

        {/* Sidebar for Recommendations */}
        <div className="lg:w-80 space-y-8">
          <RecommendedGoals 
            onAccept={(rec) => {
              setRecommendationToAccept({
                title: rec.title,
                description: rec.description,
                category: rec.category,
                type: rec.type,
                targetCriteria: {
                  type: 'numeric',
                  targetValue: 10, // Default target
                  unit: 'units'
                }
              });
              setShowCreateModal(true);
            }} 
          />
        </div>
      </div>

      <GoalCreationWizard 
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          setRecommendationToAccept(null);
        }}
        onGoalCreated={() => {
          fetchGoals();
          fetchAnalytics();
        } }
        initialData={recommendationToAccept || undefined}
      />
    </div>
  );
};
