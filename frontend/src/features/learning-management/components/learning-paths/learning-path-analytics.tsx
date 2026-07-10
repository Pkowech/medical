'use client';

import React, { useState, useEffect } from 'react';
import { apiService } from '@/features/auth/services/apiClient';
import {
  BarChart3,
  TrendingUp,
  Users,
  Clock,
  Target,
  Award,
  AlertTriangle,
  CheckCircle,
  Brain,
  Zap,
  Star,
} from 'lucide-react';
import { LearningPathAnalyticsProps, PathAnalytics } from '@/shared/types/learningInterface';
import { UserInsights } from '@/shared/types/analyticsInterface';

export const LearningPathAnalytics: React.FC<LearningPathAnalyticsProps> = ({
  pathId,
  showUserInsights = true,
}) => {
  const [pathAnalytics, setPathAnalytics] = useState<PathAnalytics | null>(null);
  const [userInsights, setUserInsights] = useState<UserInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'engagement' | 'milestones' | 'insights'>(
    'overview'
  );

  useEffect(() => {
    fetchAnalytics();
  }, [pathId]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);

      if (pathId) {
        const pathResponse = await apiService.get<PathAnalytics>(
          `/learning-paths/${pathId}/summary`
        );
        setPathAnalytics(pathResponse.data);
      }

      if (showUserInsights) {
        const userResponse = await apiService.get<UserInsights>(
          '/learning-paths/discovery/user-insights'
        );
        setUserInsights(userResponse.data);
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatPercentage = (value: number) => `${Math.round(value)}%`;
  const formatDays = (days: number) => {
    if (days < 7) return `${Math.round(days)} days`;
    return `${Math.round(days / 7)} weeks`;
  };

  const renderOverviewTab = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Users className="w-6 h-6 text-blue-600" />
          </div>
          <div className="ml-4">
            <p className="text-sm font-medium text-gray-600">Total Enrollments</p>
            <p className="text-2xl font-bold text-gray-900">
              {pathAnalytics?.totalEnrollments || 0}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center">
          <div className="p-2 bg-green-100 rounded-lg">
            <CheckCircle className="w-6 h-6 text-green-600" />
          </div>
          <div className="ml-4">
            <p className="text-sm font-medium text-gray-600">Completion Rate</p>
            <p className="text-2xl font-bold text-gray-900">
              {formatPercentage(pathAnalytics?.completionRate || 0)}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center">
          <div className="p-2 bg-yellow-100 rounded-lg">
            <Clock className="w-6 h-6 text-yellow-600" />
          </div>
          <div className="ml-4">
            <p className="text-sm font-medium text-gray-600">Avg. Completion Time</p>
            <p className="text-2xl font-bold text-gray-900">
              {formatDays(pathAnalytics?.averageCompletionTimeDays || 0)}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center">
          <div className="p-2 bg-red-100 rounded-lg">
            <AlertTriangle className="w-6 h-6 text-red-600" />
          </div>
          <div className="ml-4">
            <p className="text-sm font-medium text-gray-600">Dropout Rate</p>
            <p className="text-2xl font-bold text-gray-900">
              {formatPercentage(pathAnalytics?.dropoutRate || 0)}
            </p>
          </div>
        </div>
      </div>

      {/* User Satisfaction */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 md:col-span-2">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">User Satisfaction</h3>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Star className="w-5 h-5 text-yellow-400 fill-current" />
            <span className="text-2xl font-bold text-gray-900">
              {pathAnalytics?.userSatisfaction?.averageRating?.toFixed(1) || '0.0'}
            </span>
          </div>
          <div className="text-sm text-gray-600">
            Based on {pathAnalytics?.userSatisfaction?.totalRatings || 0} ratings
          </div>
        </div>
      </div>

      {/* Progress Distribution */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 md:col-span-2">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Progress Overview</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Active Learners</span>
            <span className="font-medium">{pathAnalytics?.activeEnrollments || 0}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Completed</span>
            <span className="font-medium">{pathAnalytics?.completedEnrollments || 0}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Average Progress</span>
            <span className="font-medium">
              {formatPercentage(pathAnalytics?.averageProgressPercentage || 0)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  const renderEngagementTab = () => (
    <div className="grid grid-cols-1 gap-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Session Metrics</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Average Session Duration</span>
            <span className="font-medium">
              {Math.round(pathAnalytics?.engagementMetrics?.averageSessionDuration || 0)} min
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Sessions per Week</span>
            <span className="font-medium">
              {pathAnalytics?.engagementMetrics?.sessionsPerWeek?.toFixed(1) || '0.0'}
            </span>
          </div>
        </div>
      </div>

      {/* Bottlenecks */}
      {pathAnalytics?.bottlenecks && pathAnalytics.bottlenecks.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 md:col-span-2">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Potential Bottlenecks</h3>
          <div className="space-y-3">
            {pathAnalytics.bottlenecks.map((bottleneck, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-red-50 rounded-lg"
              >
                <div>
                  <h4 className="font-medium text-gray-900">{bottleneck.phaseTitle}</h4>
                  <p className="text-sm text-gray-600">
                    Avg. time: {formatDays(bottleneck.averageTimeSpent)}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium text-red-600">
                    {formatPercentage(bottleneck.dropoutRate)} dropout
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const renderMilestonesTab = () => (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-6">Milestone Analytics</h3>
      {pathAnalytics?.milestoneAnalytics && pathAnalytics.milestoneAnalytics.length > 0 ? (
        <div className="space-y-4">
          {pathAnalytics.milestoneAnalytics.map((milestone, index) => (
            <div key={index} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-gray-900">{milestone.title}</h4>
                <div className="flex items-center space-x-2">
                  <Award className="w-4 h-4 text-yellow-600" />
                  <span className="text-sm font-medium text-gray-600">
                    {formatPercentage(milestone.achievementRate)} achieved
                  </span>
                </div>
              </div>

              <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                <div
                  className="dynamic-progress-width bg-yellow-600 h-2 rounded-full transition-all duration-300"
                  style={{ '--progress-width': `${milestone.achievementRate}%` } as React.CSSProperties}
                />
              </div>

              <div className="text-sm text-gray-600">
                Average time to achieve: {formatDays(milestone.averageTimeToAchieve)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8">
          <Award className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">No milestone data available</p>
        </div>
      )}
    </div>
  );

  const renderInsightsTab = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Learning Velocity */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Your Learning Velocity</h3>
        <div className="flex items-center space-x-4">
          <div className="p-3 bg-blue-100 rounded-lg">
            <Zap className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">
              {userInsights?.learningVelocity?.toFixed(1)}x
            </div>
            <div className="text-sm text-gray-600">
              {(userInsights?.learningVelocity || 0) > 1
                ? 'Faster than average'
                : 'Take your time'}
            </div>
          </div>
        </div>
      </div>

      {/* Goal Achievement */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Goal Achievement</h3>
        <div className="flex items-center space-x-4">
          <div className="p-3 bg-green-100 rounded-lg">
            <Target className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">
              {formatPercentage(userInsights?.goalAchievementRate || 0)}
            </div>
            <div className="text-sm text-gray-600">Success rate</div>
          </div>
        </div>
      </div>

      {/* Strongest Categories */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Your Strengths</h3>
        <div className="space-y-2">
          {userInsights?.strongestCategories?.map((category, index) => (
            <div key={index} className="px-3 py-2 bg-green-100 text-green-800 rounded-lg text-sm">
              {category.replace('_', ' ')}
            </div>
          ))}
        </div>
      </div>

      {/* Improvement Areas */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Areas for Improvement</h3>
        <div className="space-y-2">
          {userInsights?.improvementAreas?.map((area, index) => (
            <div key={index} className="px-3 py-2 bg-yellow-100 text-yellow-800 rounded-lg text-sm">
              {area.replace('_', ' ')}
            </div>
          ))}
        </div>
      </div>

      {/* Recommended Next Steps */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 md:col-span-2">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recommended Next Steps</h3>
        <div className="space-y-3">
          {userInsights?.recommendedNextSteps?.map((step, index) => (
            <div key={index} className="flex items-start space-x-3 p-3 bg-blue-50 rounded-lg">
              <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-medium">
                {index + 1}
              </div>
              <div className="text-sm text-gray-700">{step}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-3">
          <BarChart3 className="w-6 h-6 text-blue-600" />
          <h2 className="text-2xl font-bold text-gray-900">Analytics & Insights</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="animate-pulse space-y-4">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-8 bg-gray-200 rounded w-1/2"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <BarChart3 className="w-6 h-6 text-blue-600" />
          <h2 className="text-2xl font-bold text-gray-900">
            {pathAnalytics ? `${pathAnalytics.title} - Analytics` : 'Analytics & Insights'}
          </h2>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'overview', label: 'Overview', icon: BarChart3 },
            { id: 'engagement', label: 'Engagement', icon: TrendingUp },
            { id: 'milestones', label: 'Milestones', icon: Award },
            ...(showUserInsights
              ? [{ id: 'insights', label: 'Personal Insights', icon: Brain }]
              : []),
          ].map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`flex items-center space-x-2 py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'overview' && renderOverviewTab()}
        {activeTab === 'engagement' && renderEngagementTab()}
        {activeTab === 'milestones' && renderMilestonesTab()}
        {activeTab === 'insights' && renderInsightsTab()}
      </div>
    </div>
  );
};
