'use client';

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
// Progress component not used
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { BarChart } from '@/shared/components/charts/BarChart';
import { LineChart } from '@/shared/components/charts/LineChart';
// PieChart not used
import { Lightbulb, BookOpen, Target, Clock, Flame, FlaskConical } from 'lucide-react';
import { useSession } from 'next-auth/react';
import type {
  UserAnalytics,
  PerformanceData,
} from '@/shared/types/analyticsInterface';
import type { LearningPath } from '@/shared/types/learningInterface';
import { userService } from '@/features/profile/services/userService';
import { getLearningPathRecommendations } from '@/features/learning-management/services/learningManagementService';
import { PerformanceAnalyticsContent } from '@/features/assessment/components/PerformanceAnalytics'; // Renamed to avoid conflict
import { usePageHeader } from '@/core/providers/HeaderContext';
import { useLearningStreak } from '@/shared/hooks/useProgress';

function AnalyticsErrorCard({ title, message }: { title: string; message: string }) {
  return (
    <Card className="border-red-200 bg-red-50">
      <CardHeader>
        <CardTitle className="text-red-700">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-red-600">{message}</p>
      </CardContent>
    </Card>
  );
}

export default function AnalyticsDashboard() {
  const { data: session } = useSession() || {};
  const { setHeader } = usePageHeader();
  const userId = session?.user?.id;
  const {
    streak: learningStreak,
    isLoading: isLoadingLearningStreak,
    error: learningStreakError,
  } = useLearningStreak();

  useEffect(() => {
    setHeader({
      title: 'My Analytics',
      description: 'Review your learning progress and assessment results',
      icon: '📊',
    });

    return () => setHeader(null);
  }, [setHeader]);

  const {
    data: userAnalytics,
    isLoading: isLoadingUserAnalytics,
    error: errorUserAnalytics,
  } = useQuery<UserAnalytics | null>({
    queryKey: ['userAnalytics', userId],
    queryFn: () => userService.getUserAnalytics(userId as string),
    enabled: !!userId,
    throwOnError: false,
  });

  const {
    data: learningPathRecommendations,
    isLoading: isLoadingLearningPathRecommendations,
    error: errorLearningPathRecommendations,
  } = useQuery<LearningPath[]>({
    queryKey: ['learningPathRecommendations', userId],
    queryFn: async () => (await getLearningPathRecommendations()) ?? [],
    enabled: !!userId,
    throwOnError: false,
  });

  const {
    data: performanceData,
    isLoading: isLoadingPerformanceData,
    error: errorPerformanceData,
  } = useQuery<PerformanceData | null>({
    queryKey: ['performanceData', userId, 'summary'],
    queryFn: async () => {
      const res = await fetch('/api/assessment-progress/summary', {
        headers: {
          Authorization: `Bearer ${session?.user?.accessToken}`,
        },
      });
      if (!res.ok) {
        throw new Error('Failed to fetch performance data');
      }
      const payload = await res.json();
      return payload.data ?? payload;
    },
    enabled: !!userId && !!session?.user?.accessToken,
    throwOnError: false,
  });

  const progressData = {
    labels: userAnalytics?.progressOverTime?.map(p => new Date(p.date).toLocaleDateString()) || [],
    datasets: [
      {
        label: 'Progress',
        data: userAnalytics?.progressOverTime?.map(p => p.progress) || [],
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.5)',
      },
    ],
  };

  const moduleCompletionData = {
    labels: userAnalytics?.moduleCompletion?.map(m => m.moduleName) || [],
    datasets: [
      {
        label: 'Completion',
        data: userAnalytics?.moduleCompletion?.map(m => m.completion) || [],
        backgroundColor: '#10b981',
      },
    ],
  };

  if (isLoadingUserAnalytics) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="space-y-6">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
            <div className="h-4 bg-gray-200 rounded w-2/3 mb-8"></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <div className="animate-pulse space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="animate-pulse space-y-2">
                    <div className="h-3 bg-gray-200 rounded"></div>
                    <div className="h-3 bg-gray-200 rounded w-5/6"></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="progress">Progress</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          {errorUserAnalytics ? (
            <AnalyticsErrorCard
              title="Overview Unavailable"
              message={errorUserAnalytics instanceof Error ? errorUserAnalytics.message : 'Failed to load your analytics.'}
            />
          ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Courses Completed</CardTitle>
                <BookOpen className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{userAnalytics?.coursesCompleted || 0}</div>
                <p className="text-xs text-muted-foreground">Total courses finished</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Average Score</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {userAnalytics?.metrics.quizzesTaken
                    ? `${userAnalytics.averageScore.toFixed(1)}%`
                    : 'No scores yet'}
                </div>
                <p className="text-xs text-muted-foreground">Across all assessments</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Study Hours</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {userAnalytics?.totalStudyHours?.toFixed(1) || 0}
                </div>
                <p className="text-xs text-muted-foreground">Total time spent learning</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Assessments Completed</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{userAnalytics?.metrics.quizzesTaken || 0}</div>
                <p className="text-xs text-muted-foreground">Completed quiz attempts</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Course Completion</CardTitle>
                <BookOpen className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {Math.round((userAnalytics?.completionRate || 0) * 100)}%
                </div>
                <p className="text-xs text-muted-foreground">Completed enrollments</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Learning Streak</CardTitle>
                <Flame className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {isLoadingLearningStreak ? '…' : typeof learningStreak === 'number' ? learningStreak : '—'}
                </div>
                <p className="text-xs text-muted-foreground">
                  {learningStreakError
                    ? `Learning streak unavailable: ${learningStreakError.message}`
                    : 'Consecutive days with learning activity'}
                </p>
              </CardContent>
            </Card>
          </div>
          )}
        </TabsContent>

        <TabsContent value="progress" className="mt-6">
          {errorUserAnalytics ? (
            <AnalyticsErrorCard
              title="Progress Unavailable"
              message={errorUserAnalytics instanceof Error ? errorUserAnalytics.message : 'Failed to load your progress.'}
            />
          ) : (
          <>
          <Card>
            <CardHeader>
              <CardTitle>Learning Progress Over Time</CardTitle>
            </CardHeader>
            <CardContent>
              {userAnalytics?.progressOverTime && userAnalytics.progressOverTime.length > 0 ? (
                <LineChart data={progressData} />
              ) : (
                <p className="text-center text-gray-500">No progress data available.</p>
              )}
            </CardContent>
          </Card>
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Module Completion</CardTitle>
            </CardHeader>
            <CardContent>
              {userAnalytics?.moduleCompletion && userAnalytics.moduleCompletion.length > 0 ? (
                <BarChart data={moduleCompletionData} />
              ) : (
                <p className="text-center text-gray-500">No module completion data available.</p>
              )}
            </CardContent>
          </Card>
          </>
          )}
        </TabsContent>

        <TabsContent value="performance" className="mt-6">
          {isLoadingPerformanceData ? (
            <Card><CardContent className="p-6 text-center">Loading performance analytics...</CardContent></Card>
          ) : errorPerformanceData ? (
            <AnalyticsErrorCard
              title="Performance Unavailable"
              message={errorPerformanceData instanceof Error ? errorPerformanceData.message : 'Failed to load performance analytics.'}
            />
          ) : performanceData ? (
            <PerformanceAnalyticsContent userId={userId as string} data={performanceData} />
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <FlaskConical className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <h3 className="text-lg font-medium mb-2">No Performance Analytics Data</h3>
                <p className="text-gray-600">
                  Complete some assessments to see your performance analytics.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="recommendations" className="mt-6">
          {isLoadingLearningPathRecommendations ? (
            <Card><CardContent className="p-6 text-center">Loading recommendations...</CardContent></Card>
          ) : errorLearningPathRecommendations ? (
            <AnalyticsErrorCard
              title="Recommendations Unavailable"
              message={errorLearningPathRecommendations instanceof Error ? errorLearningPathRecommendations.message : 'Failed to load recommendations.'}
            />
          ) : <div className="space-y-4">
            {learningPathRecommendations && learningPathRecommendations.length > 0 ? (
              learningPathRecommendations.map(rec => (
                <Card key={rec.id}>
                  <CardHeader>
                    <CardTitle>{rec.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p>{rec.description}</p>
                    <p className="text-sm text-gray-500">Difficulty: {rec.difficulty}</p>
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card>
                <CardContent className="p-6 text-center text-gray-500">
                  <Lightbulb className="h-10 w-10 mx-auto mb-3" />
                  <p>No learning path recommendations available at the moment.</p>
                </CardContent>
              </Card>
            )}
          </div>}
        </TabsContent>
      </Tabs>
    </div>
  );
}
export { AnalyticsDashboard };
