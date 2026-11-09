'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Target, Trophy, AlertTriangle, TrendingDown, Clock } from 'lucide-react';
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
  const { data: session, status: sessionStatus } = useSession();
  const { setHeader } = usePageHeader();
  useEffect(() => {
    setHeader({
      title: 'Progress Dashboard',
      description: 'Comprehensive overview of your academic journey and achievements',
    });
    return () => setHeader(null);
  }, [setHeader]);

  const [progressData, setProgressData] = useState<ProgressData | null>(null);
  const [weaknessChains, setWeaknessChains] = useState<WeaknessChain[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const userId = session?.user?.id;
    let active = true;

    const fetchProgressData = async () => {
      if (sessionStatus === 'loading') return;
      if (!userId) {
        setError('Sign in to view your progress.');
        setIsLoading(false);
        return;
      }

      const loadWeaknessChains = async () => {
        try {
          const response = await fetch('/api/assessments/analytics/weakness-chains');
          if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
          const weaknessData = await response.json();
          if (active) {
            setWeaknessChains(Array.isArray(weaknessData.data) ? weaknessData.data : []);
          }
        } catch (error) {
          console.error('Error fetching weakness chains:', error);
        }
      };

      void loadWeaknessChains();
      try {
        setIsLoading(true);
        setError(null);

        const data = await progressService.getAllProgressData(userId);
        if (!active) return;
        setProgressData(data);
      } catch (error) {
        console.error('Error loading progress data:', error);
        if (active) setError('Failed to load progress data. Please try again.');
      } finally {
        if (active) setIsLoading(false);
      }
    };

    fetchProgressData();
    return () => {
      active = false;
    };
  }, [session?.user?.id, sessionStatus, reloadKey]);

  // date helpers are used by child components via displayUtils

  const trends = progressData?.performanceTrends ?? [];
  const assessmentTrends = trends.filter((trend) => (trend.scoreCount ?? 0) > 0);
  const studyTimeTrends = trends.filter((trend) => (trend.hoursCount ?? 0) > 0);
  const attentionChains = weaknessChains.filter(
    chain => chain.riskLevel === 'HIGH' || chain.riskLevel === 'MEDIUM',
  );
  const assessmentChartData = {
    labels: assessmentTrends.map((trend) => trend.month),
    datasets: [
      {
        label: 'Average assessment score (%)',
        data: assessmentTrends.map((trend) => trend.score),
        borderColor: 'rgb(99, 102, 241)',
        backgroundColor: 'rgba(99, 102, 241, 0.5)',
      },
    ],
  };
  const studyTimeChartData = {
    labels: studyTimeTrends.map((trend) => trend.month),
    datasets: [
      {
        label: 'Study hours',
        data: studyTimeTrends.map((trend) => trend.hours),
        backgroundColor: 'rgba(71, 85, 105, 0.7)',
      },
    ],
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[30vh] items-center justify-center" role="status" aria-live="polite">
        <span className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-600" />
        <span className="sr-only">Loading progress data</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[30vh] flex-col items-center justify-center gap-3 text-center">
        <p className="font-medium text-destructive" role="alert">{error}</p>
        <button
          type="button"
          onClick={() => setReloadKey((key) => key + 1)}
          className="rounded-md border px-3 py-2 text-sm hover:bg-muted"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {progressData?.dataWarnings && progressData.dataWarnings.length > 0 && (
        <Card className="border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/20">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-amber-900 dark:text-amber-200">
              Some progress data is unavailable ({progressData.dataWarnings.join(', ')}). The sections below may be incomplete.
            </p>
            <button
              type="button"
              onClick={() => setReloadKey((key) => key + 1)}
              className="shrink-0 rounded-md border border-amber-400 px-3 py-1.5 text-sm text-amber-950 hover:bg-amber-100 dark:border-amber-800 dark:text-amber-100 dark:hover:bg-amber-900/40"
            >
              Retry
            </button>
          </CardContent>
        </Card>
      )}
      {/* Areas Needing Attention */}
      {attentionChains.length > 0 && (
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
                {attentionChains.map(chain => (
                  <div
                    key={chain.weakTopic.id}
                    className="p-3 bg-card dark:bg-card rounded-lg border border-red-200 dark:border-red-800"
                  >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <p className="font-semibold text-foreground dark:text-foreground">
                            {chain.weakTopic.name}
                          </p>
                          <p className="text-xs text-muted-foreground dark:text-muted-foreground">
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
                        <div className="mt-2 pt-2 border-t border-border dark:border-border">
                          <p className="text-xs text-muted-foreground dark:text-muted-foreground mb-1">
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
                              <span className="text-xs text-muted-foreground">
                                +{chain.dependentTopics.length - 3} more
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground dark:text-muted-foreground mt-3">
                💡 Check the Study Dashboard for AI-generated practice quizzes to strengthen these areas.
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          icon={Target}
          title="Overall Progress"
          value={`${Math.round(progressData?.overallProgress || 0)}%`}
          subtitle={`${progressData?.coursesCompleted || 0}/${progressData?.totalCourses || 0} Courses`}
          colorClass="bg-indigo-600"
        />
        <StatCard
          icon={Clock}
          title="Study Hours"
          value={progressData?.stats?.studyHours ?? '—'}
          subtitle="All-time total"
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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Assessment Scores by Month</CardTitle>
          </CardHeader>
          <CardContent>
            {assessmentTrends.length > 0
              ? <LineChart data={assessmentChartData} height={260} />
              : <p className="py-8 text-center text-sm text-muted-foreground">No assessment trend data available.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Study Hours by Month</CardTitle>
          </CardHeader>
          <CardContent>
            {studyTimeTrends.length > 0
              ? <BarChart data={studyTimeChartData} height={260} />
              : <p className="py-8 text-center text-sm text-muted-foreground">No study-time trend data available.</p>}
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
