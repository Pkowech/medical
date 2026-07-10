'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Calendar, Target, Trophy, AlertTriangle, TrendingDown } from 'lucide-react';
import { AnalyticsMetrics } from '@/shared/types';
import { LineChart } from '@/shared/components/charts/LineChart';
import { BarChart } from '@/shared/components/charts/BarChart';
// date helpers provided by displayUtils
import { ProgressData } from '@/shared/types/progressInterface';
import { useSession } from 'next-auth/react';
// progressUtils helpers not needed in this consolidated dashboard
import CourseProgressList from '@/features/learning-management/components/progress/CourseProgressList';
import ActivitiesList from '@/features/learning-management/components/progress/ActivitiesList';
import AchievementsList from '@/features/learning-management/components/progress/AchievementsList';
import { RecommendationsWidget } from '@/features/learning-management/components/RecommendationsWidget';
import { SpacedRepetitionWidget } from '@/features/assessment/components/SpacedRepetitionWidget';
import { LearningGoalsWidget } from '@/features/learning-management/components/LearningGoalsWidget';
import { usePageHeader } from '@/core/providers/HeaderContext';
import progressService from '@/features/learning-management/services/progressService';
import { StatCard } from '@/shared/components/ui/StatCard';
// ProgressBar is used inside CourseProgressList

type WeaknessChain = {
  weakTopic: { id: string; name: string; pKnown: number };
  dependentTopics: Array<{ id: string; name: string; unitName: string }>;
  riskLevel: 'HIGH' | 'MEDIUM' | 'LOW';
};

export const ProgressDashboard = () => {
  const { data: session } = useSession();
  const { setHeader } = usePageHeader();
  useEffect(() => {
    setHeader({
      title: 'Progress Dashboard',
      description: 'Comprehensive overview of your academic journey and achievements',
    });
    return () => setHeader(null);
  }, [setHeader]);

  const [progressData, setProgressData] = useState<ProgressData | null>(null);
  const [analyticsMetrics, setAnalyticsMetrics] = useState<AnalyticsMetrics | null>(null);
  const [weaknessChains, setWeaknessChains] = useState<WeaknessChain[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProgressData = async () => {
      if (!session?.user?.id) return;

      try {
        setIsLoading(true);
        setError(null);

        const data = await progressService.getAllProgressData(session.user.id);
        setProgressData(data);

        // Fetch weakness chains
        try {
          const response = await fetch('/api/assessments/analytics/weakness-chains');
          if (response.ok) {
            const weaknessData = await response.json();
            setWeaknessChains(weaknessData.data || []);
          }
        } catch (error) {
          console.error('Error fetching weakness chains:', error);
          // Continue loading dashboard even if this fails
        }
        // Map real performanceTrends to AnalyticsMetrics structure
        if (data.performanceTrends) {
          const labels = data.performanceTrends.map(t => t.month);
          const scoreData = data.performanceTrends.map(t => t.score);
          const hourData = data.performanceTrends.map(t => t.hours);

          setAnalyticsMetrics({
            studyTime: {
              daily: 0,
              weekly: 0,
              monthly: hourData.reduce((a, b) => a + b, 0),
            },
            quizPerformance: {
              avgScore: scoreData.reduce((a, b) => a + b, 0) / (scoreData.length || 1),
              totalQuizzes: 0,
              improvement: 0,
            },
            learningRate: {
              currentSpeed: 1,
              trend: 'stable',
            },
            weakAreas: [],
            strengths: [],
            progressOverTime: {
              labels,
              datasets: [
                {
                  label: 'Performance Score',
                  data: scoreData,
                  borderColor: 'rgb(99, 102, 241)', // Indigo-500
                  backgroundColor: 'rgba(99, 102, 241, 0.5)',
                },
              ],
            },
            quizScores: {
              labels,
              datasets: [
                {
                  label: 'Average Score',
                  data: scoreData,
                  backgroundColor: 'rgba(99, 102, 241, 0.7)', // Indigo-500
                },
                {
                  label: 'Study Hours',
                  data: hourData,
                  backgroundColor: 'rgba(71, 85, 105, 0.7)', // Slate-600
                },
              ],
            },
          });
        }

        setIsLoading(false);
      } catch (error) {
        console.error('Error loading progress data:', error);
        setError('Failed to load progress data. Please try again.');
        setIsLoading(false);
      }
    };

    fetchProgressData();
  }, [session?.user?.id]);

  // date helpers are used by child components via displayUtils

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] text-red-500 font-medium">
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-10 animate-in fade-in duration-500">
      {/* Areas Needing Attention */}
      {weaknessChains.length > 0 && (
        <div className="mb-6">
          <Card className="border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-red-700 dark:text-red-400">
                <AlertTriangle className="w-5 h-5" />
                Areas Needing Attention
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {weaknessChains
                  .filter(w => w.riskLevel === 'HIGH' || w.riskLevel === 'MEDIUM')
                  .map(chain => (
                    <div
                      key={chain.weakTopic.id}
                      className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-red-200 dark:border-red-800"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <p className="font-semibold text-gray-900 dark:text-white">
                            {chain.weakTopic.name}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Current Mastery: {(chain.weakTopic.pKnown * 100).toFixed(0)}%
                          </p>
                        </div>
                        <span
                          className={`px-2 py-1 text-xs font-semibold rounded ${
                            chain.riskLevel === 'HIGH'
                              ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200'
                              : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-200'
                          }`}
                        >
                          {chain.riskLevel}
                        </span>
                      </div>

                      {chain.dependentTopics.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                          <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                            <TrendingDown className="w-3 h-3 inline mr-1" />
                            May affect:
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {chain.dependentTopics.slice(0, 3).map(topic => (
                              <span
                                key={topic.id}
                                className="text-xs bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200 px-2 py-1 rounded"
                              >
                                {topic.name}
                              </span>
                            ))}
                            {chain.dependentTopics.length > 3 && (
                              <span className="text-xs text-gray-500">
                                +{chain.dependentTopics.length - 3} more
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-3">
                💡 Check the Study Dashboard for AI-generated practice quizzes to strengthen these areas.
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="bg-indigo-600/10 px-4 py-2 rounded-2xl border border-indigo-600/20 shadow-sm backdrop-blur-xs">
          <p className="text-sm font-black text-indigo-700 dark:text-indigo-400 flex items-center gap-2 uppercase tracking-widest">
            <Target className="w-4 h-4" />
            Performance Insights
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          icon={Target}
          title="Overall Progress"
          value={`${Math.round(progressData?.overallProgress || 0)}%`}
          subtitle={`${progressData?.coursesCompleted || 0}/${progressData?.totalCourses || 0} Courses`}
          colorClass="bg-indigo-600"
        />
        <StatCard
          icon={Calendar}
          title="Study Hours"
          value={analyticsMetrics?.studyTime?.monthly ?? 0}
          subtitle="Monthly total"
          colorClass="bg-indigo-500"
        />
        <StatCard
          icon={Trophy}
          title="Achievements"
          value={progressData?.achievements?.length ?? 0}
          subtitle="Earned Badges"
          colorClass="bg-amber-500"
        />
      </div>

      {/* Recommendations & Spaced Repetition & Learning Goals Section */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 h-full">
            <RecommendationsWidget />
            <SpacedRepetitionWidget />
          </div>
        </div>
        <LearningGoalsWidget />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Progress Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            {analyticsMetrics?.progressOverTime && (
              <LineChart data={analyticsMetrics.progressOverTime} height={300} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quiz Scores</CardTitle>
          </CardHeader>
          <CardContent>
            {analyticsMetrics?.quizScores && (
              <BarChart data={analyticsMetrics.quizScores} height={300} />
            )}
          </CardContent>
        </Card>
      </div>

      <CourseProgressList courses={progressData?.courseProgress} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ActivitiesList activities={progressData?.recentActivities} />
        <AchievementsList achievements={progressData?.achievements} />
      </div>
    </div>
  );
};
