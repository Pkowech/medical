'use client';

import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  TrendingUp,
  Users,
  Star,
  Clock,
  Target,
  BookOpen,
  ChevronRight,
  Lightbulb,
  Brain,
} from 'lucide-react';

import type { RecommendationScore, TrendingPath } from '@/shared/types/recommendationInterface';

interface LearningPathRecommendationsProps {
  userId?: string;
  limit?: number;
  showTrending?: boolean;
  showCollaborative?: boolean;
}

export const LearningPathRecommendations: React.FC<LearningPathRecommendationsProps> = ({
  userId,
  limit = 6,
  showTrending = true,
  showCollaborative = true,
}) => {
  const [personalizedRecs, setPersonalizedRecs] = useState<RecommendationScore[]>([]);
  const [collaborativeRecs, setCollaborativeRecs] = useState<RecommendationScore[]>([]);
  const [trendingPaths, setTrendingPaths] = useState<TrendingPath[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'personalized' | 'collaborative' | 'trending'>(
    'personalized'
  );

  useEffect(() => {
    fetchRecommendations();
  }, [userId, limit]);

  const fetchRecommendations = async () => {
    try {
      setLoading(true);

      // Fetch personalized recommendations
      const personalizedResponse = await fetch(
        `/api/learning-paths/recommendations?limit=${limit}`
      );
      if (personalizedResponse.ok) {
        const personalizedData = await personalizedResponse.json();
        if (Array.isArray(personalizedData)) {
          const enrichedPersonalized = await Promise.all(
            personalizedData.map(async (raw: unknown) => {
              const item = raw as Record<string, unknown>;
              const rec: RecommendationScore = {
                pathId: String(item.path_id ?? item.pathId ?? ''),
                score: Number(item.score ?? 0),
                reasons: Array.isArray(item.reasons) ? item.reasons.map(String) : [],
                confidence: Number(item.confidence ?? 0),
                estimatedCompletionTime: Number(item.estimated_completion_time ?? item.estimatedCompletionTime ?? 0),
              };
              try {
                const pathResponse = await fetch(`/api/learning-paths/${rec.pathId}`);
                if (pathResponse.ok) {
                  const pathData = await pathResponse.json();
                  return { ...rec, learningPath: pathData };
                }
                return rec;
              } catch {
                return rec;
              }
            })
          );
          setPersonalizedRecs(enrichedPersonalized);
        } else {
          setPersonalizedRecs([]);
        }
      }
      // Fetch collaborative recommendations if enabled
      if (showCollaborative) {
        const collaborativeResponse = await fetch(
          `/api/learning-paths/recommendations/collaborative?limit=${Math.ceil(limit / 2)}`
        );
        if (collaborativeResponse.ok) {
          const collaborativeData = await collaborativeResponse.json();
          if (Array.isArray(collaborativeData)) {
            const enrichedCollaborative = await Promise.all(
              collaborativeData.map(async (raw: unknown) => {
                const item = raw as Record<string, unknown>;
                const rec: RecommendationScore = {
                  pathId: String(item.path_id ?? item.pathId ?? ''),
                  score: Number(item.score ?? 0),
                  reasons: Array.isArray(item.reasons) ? item.reasons.map(String) : [],
                  confidence: Number(item.confidence ?? 0),
                  estimatedCompletionTime: Number(item.estimated_completion_time ?? item.estimatedCompletionTime ?? 0),
                };
                try {
                  const pathResponse = await fetch(`/api/learning-paths/${rec.pathId}`);
                  if (pathResponse.ok) {
                    const pathData = await pathResponse.json();
                    return { ...rec, learningPath: pathData };
                  }
                  return rec;
                } catch {
                  return rec;
                }
              })
            );
            setCollaborativeRecs(enrichedCollaborative);
          } else {
            setCollaborativeRecs([]);
          }
        }
      }

      // Fetch trending paths if enabled
      if (showTrending) {
        const trendingResponse = await fetch(
          `/api/learning-paths/trending?limit=${Math.ceil(limit / 2)}`
        );
        if (trendingResponse.ok) {
          const trendingData = await trendingResponse.json();
          if (Array.isArray(trendingData)) {
            // Normalize backend trending path shape to our TrendingPath type
            const mapped: TrendingPath[] = trendingData.map((p: unknown) => {
              const rec = p as Record<string, unknown>;
              const analyticsRaw = (rec.analytics as Record<string, unknown>) ?? {};
              return {
                id: String(rec.path_id ?? rec.id ?? ''),
                pathId: String(rec.path_id ?? rec.id ?? ''),
                title: String(rec.title ?? ''),
                description: String(rec.description ?? ''),
                difficulty: String(rec.difficulty ?? ''),
                category: String(rec.category ?? ''),
                analytics: {
                  userRatings: {
                    average: Number(analyticsRaw.user_ratings?.average ?? analyticsRaw.userRatings?.average ?? 0),
                    count: Number(analyticsRaw.user_ratings?.count ?? analyticsRaw.userRatings?.count ?? 0),
                  },
                  totalEnrollments: Number(analyticsRaw.total_enrollments ?? analyticsRaw.totalEnrollments ?? 0),
                  completionRate: Number(analyticsRaw.completion_rate ?? analyticsRaw.completionRate ?? 0),
                },
                estimatedDurationWeeks: Number(rec.estimated_duration_weeks ?? rec.estimatedDurationWeeks ?? 0),
                popularity: rec.popularity ?? rec.popularity_score,
              };
            });
            setTrendingPaths(mapped);
          } else {
            setTrendingPaths([]);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching recommendations:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDifficultyColor = (difficulty?: string) => {
    if (!difficulty) return 'bg-gray-100 text-gray-800';
    switch (difficulty.toLowerCase()) {
      case 'beginner':
        return 'bg-green-100 text-green-800';
      case 'intermediate':
        return 'bg-yellow-100 text-yellow-800';
      case 'advanced':
        return 'bg-orange-100 text-orange-800';
      case 'expert':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600';
    if (confidence >= 0.6) return 'text-yellow-600';
    return 'text-gray-600';
  };

  const renderRecommendationCard = (
    rec: RecommendationScore,
    type: 'personalized' | 'collaborative' | 'trending'
  ) => {
    const path = rec.learningPath;
    if (!path) return null;

    return (
      <div
        key={rec.pathId}
        className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow p-6"
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{path.title}</h3>
            <p className="text-gray-600 text-sm mb-3 line-clamp-2">{path.description}</p>

            <div className="flex flex-wrap gap-2 mb-3">
              <span
                className={`px-2 py-1 rounded-full text-xs font-medium ${getDifficultyColor(path.difficulty)}`}
              >
                {path.difficulty}
              </span>
              <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                {path.category.replace('_', ' ')}
              </span>
            </div>
          </div>

          <div className="flex flex-col items-end space-y-2">
            <div className="flex items-center space-x-1">
              <Star className="w-4 h-4 text-yellow-400 fill-current" />
              <span className="text-sm text-gray-600">
                {path.analytics.userRatings.average.toFixed(1)}
              </span>
            </div>

            {type === 'personalized' && (
              <div className={`text-sm font-medium ${getConfidenceColor(rec.confidence)}`}>
                {Math.round(rec.score)}% match
              </div>
            )}
          </div>
        </div>

        {/* Recommendation reasons */}
        {rec.reasons && rec.reasons.length > 0 && (
          <div className="mb-4">
            <div className="flex items-center space-x-2 mb-2">
              <Lightbulb className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium text-gray-700">Why this path?</span>
            </div>
            <ul className="space-y-1">
              {rec.reasons.slice(0, 2).map((reason, index) => (
                <li key={index} className="text-sm text-gray-600 flex items-start space-x-2">
                  <span className="w-1 h-1 bg-blue-600 rounded-full mt-2 shrink-0"></span>
                  <span>{reason}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Path stats */}
        <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-1">
              <Clock className="w-4 h-4" />
              <span>{path.estimatedDurationWeeks}w</span>
            </div>
            <div className="flex items-center space-x-1">
              <Users className="w-4 h-4" />
              <span>{path.analytics.totalEnrollments}</span>
            </div>
            <div className="flex items-center space-x-1">
              <TrendingUp className="w-4 h-4" />
              <span>{Math.round(path.analytics.completionRate)}%</span>
            </div>
          </div>

          {rec.estimatedCompletionTime && (
            <div className="flex items-center space-x-1 text-blue-600">
              <Target className="w-4 h-4" />
              <span>~{rec.estimatedCompletionTime}w for you</span>
            </div>
          )}
        </div>

        {/* Confidence indicator */}
        {type === 'personalized' && (
          <div className="mb-4">
            <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
              <span>Recommendation confidence</span>
              <span>{Math.round(rec.confidence * 100)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all duration-300 ${
                  rec.confidence >= 0.8
                    ? 'bg-green-600'
                    : rec.confidence >= 0.6
                      ? 'bg-yellow-600'
                      : 'bg-gray-600'
                }`}
                style={{ width: `${rec.confidence * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Action button */}
        <button className="w-full flex items-center justify-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
          <BookOpen className="w-4 h-4" />
          <span>View Learning Path</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    );
  };

  const renderTrendingCard = (path: TrendingPath) => (
    <div
      key={path.id}
      className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow p-6"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">{path.title}</h3>
          <p className="text-gray-600 text-sm mb-3 line-clamp-2">{path.description}</p>

          <div className="flex flex-wrap gap-2 mb-3">
            <span
              className={`px-2 py-1 rounded-full text-xs font-medium ${getDifficultyColor(path.difficulty)}`}
            >
              {path.difficulty}
            </span>
            <span className="px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
              Trending
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-1 text-yellow-400">
          <Star className="w-4 h-4 fill-current" />
          <span className="text-sm text-gray-600">
            {path.analytics?.userRatings?.average?.toFixed(1) || 'New'}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-1">
            <Clock className="w-4 h-4" />
            <span>{path.estimatedDurationWeeks}w</span>
          </div>
          <div className="flex items-center space-x-1">
            <Users className="w-4 h-4" />
            <span>{path.analytics?.totalEnrollments || 0}</span>
          </div>
        </div>

        <div className="flex items-center space-x-1 text-green-600">
          <TrendingUp className="w-4 h-4" />
          <span>Popular this month</span>
        </div>
      </div>

      <button className="w-full flex items-center justify-center space-x-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors">
        <BookOpen className="w-4 h-4" />
        <span>Join the Trend</span>
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-3">
          <Sparkles className="w-6 h-6 text-blue-600" />
          <h2 className="text-2xl font-bold text-gray-900">Recommended for You</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="animate-pulse space-y-4">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-3 bg-gray-200 rounded w-full"></div>
                <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                <div className="h-8 bg-gray-200 rounded"></div>
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
          <Sparkles className="w-6 h-6 text-blue-600" />
          <h2 className="text-2xl font-bold text-gray-900">Recommended for You</h2>
        </div>

        {/* Tab navigation */}
        <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setActiveTab('personalized')}
            className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'personalized'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <div className="flex items-center space-x-1">
              <Brain className="w-4 h-4" />
              <span>For You</span>
            </div>
          </button>

          {showCollaborative && (
            <button
              onClick={() => setActiveTab('collaborative')}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'collaborative'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <div className="flex items-center space-x-1">
                <Users className="w-4 h-4" />
                <span>Similar Learners</span>
              </div>
            </button>
          )}

          {showTrending && (
            <button
              onClick={() => setActiveTab('trending')}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'trending'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <div className="flex items-center space-x-1">
                <TrendingUp className="w-4 h-4" />
                <span>Trending</span>
              </div>
            </button>
          )}
        </div>
      </div>

      {/* Content based on active tab */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {activeTab === 'personalized' &&
          personalizedRecs.map(rec => renderRecommendationCard(rec, 'personalized'))}
        {activeTab === 'collaborative' &&
          collaborativeRecs.map(rec => renderRecommendationCard(rec, 'collaborative'))}
        {activeTab === 'trending' && trendingPaths.map(path => renderTrendingCard(path))}
      </div>

      {/* Empty state */}
      {((activeTab === 'personalized' && personalizedRecs.length === 0) ||
        (activeTab === 'collaborative' && collaborativeRecs.length === 0) ||
        (activeTab === 'trending' && trendingPaths.length === 0)) && (
        <div className="text-center py-12">
          <Sparkles className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No recommendations available</h3>
          <p className="text-gray-500">
            {activeTab === 'personalized'
              ? 'Complete some courses or assessments to get personalized recommendations'
              : activeTab === 'collaborative'
                ? 'Not enough similar learners found yet'
                : 'No trending paths at the moment'}
          </p>
        </div>
      )}
    </div>
  );
};
