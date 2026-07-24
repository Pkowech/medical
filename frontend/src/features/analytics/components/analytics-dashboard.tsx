'use client';

// useState removed — not required in this component
import dynamic from 'next/dynamic';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
// Progress component not used
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { BarChart } from '@/shared/components/charts/BarChart';
import { LineChart } from '@/shared/components/charts/LineChart';
// PieChart not used
import {
  Lightbulb,
  BookOpen,
  Target,
  TrendingUp,
  Users,
  Clock,
  Award,
  Brain,
  FlaskConical,
  Gauge,
} from 'lucide-react';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';
import { useSession } from 'next-auth/react';
import { usePermissions } from '@/features/auth/hooks/usePermissions';
import { Role } from '@/shared/enums/role.enum';
// toast not used in this file
import {
  UserAnalytics,
  ConsolidatedAnalytics,
  UserInsights,
  AssessmentPrediction,
  LearningRecommendation,
  SystemAnalytics,
  PerformanceData,
  AISuggestion,
} from '@/shared/types/analyticsInterface';
import { 
  getAllAssessmentPredictions, 
  aiAnalyticsService 
} from '@/features/analytics/services/aiAnalyticsService';
import { userService } from '@/features/profile/services/userService';
import { adminService } from '@/features/admin/services/adminService';
import { getLearningPathRecommendations } from '@/features/learning-management/services/learningManagementService';
import { aiRecommendationService } from '@/features/analytics/services/aiRecommendationService';
// Lazy-load admin-only visualizations to keep the bundle small for non-admins
const UserActivityChart = dynamic(
  () => import('@/features/analytics/components/UserActivityChart'),
  { ssr: false }
);
const ContentPerformanceTable = dynamic(
  () => import('@/features/analytics/components/ContentPerformanceTable'),
  { ssr: false }
);
import { PerformanceAnalyticsContent } from '@/features/assessment/components/PerformanceAnalytics'; // Renamed to avoid conflict
import { Badge } from '@/shared/components/ui/badge';

export default function AnalyticsDashboard() {
  const { data: session } = useSession() || {};
  const { allRoles } = usePermissions();
  const userId = session?.user?.id;
  const isAdmin = allRoles?.includes(Role.admin);

  // Strictly restrict access to admin features in this component.
  if (!isAdmin) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 text-center">
            <h2 className="text-xl font-semibold mb-2">Admin Access Required</h2>
            <p className="text-sm text-gray-600">
              The analytics dashboard contains administrative system metrics and is available only
              to users with administrator privileges.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const {
    data: consolidatedAnalytics,
    isLoading: isLoadingConsolidatedAnalytics,
    error: errorConsolidatedAnalytics,
  } = useQuery<ConsolidatedAnalytics | null>({
    queryKey: ['consolidatedAnalytics'],
    queryFn: () => aiAnalyticsService.getConsolidatedAnalytics(),
    enabled: !!userId, // Only fetch if userId is available
    throwOnError: false,
  });

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
    data: userInsights,
    isLoading: isLoadingUserInsights,
    error: errorUserInsights,
  } = useQuery<UserInsights | null>({
    queryKey: ['userInsights', userId],
    queryFn: () => userService.getUserInsights(userId as string),
    enabled: !!userId,
    throwOnError: false,
  });

  const {
    data: assessmentPredictions,
    isLoading: isLoadingAssessmentPredictions,
    error: errorAssessmentPredictions,
  } = useQuery<AssessmentPrediction[] | null>({
    queryKey: ['assessmentPredictions', userId],
    queryFn: () => getAllAssessmentPredictions(userId as string),
    enabled: !!userId,
    throwOnError: false,
  });

  const {
    data: learningPathRecommendations,
    isLoading: isLoadingLearningPathRecommendations,
    error: errorLearningPathRecommendations,
  } = useQuery<LearningRecommendation[] | null>({
    queryKey: ['learningPathRecommendations'],
    queryFn: () => getLearningPathRecommendations(),
    enabled: !!userId,
    throwOnError: false,
  });

  const {
    data: aiSuggestions,
    isLoading: isLoadingAiSuggestions,
    error: errorAiSuggestions,
  } = useQuery<AISuggestion[] | null>({
    queryKey: ['aiSuggestions', userId],
    queryFn: () => aiRecommendationService.getAISuggestions(userId as string),
    enabled: !!userId,
    throwOnError: false,
  });

  const {
    data: systemAnalytics,
    isLoading: isLoadingSystemAnalytics,
    error: errorSystemAnalytics,
  } = useQuery<SystemAnalytics | null>({
    queryKey: ['systemAnalytics'],
    queryFn: () => adminService.getSystemAnalytics(),
    enabled: isAdmin,
    throwOnError: false,
  });

  const {
    data: performanceData,
    isLoading: isLoadingPerformanceData,
    error: errorPerformanceData,
  } = useQuery<PerformanceData | null>({
    queryKey: ['performanceData', userId],
    queryFn: async () => {
      const res = await fetch(`/api/assessment-progress/summary/user/${userId}`, {
        headers: {
          Authorization: `Bearer ${session?.accessToken}`,
        },
      });
      if (!res.ok) {
        throw new Error('Failed to fetch performance data');
      }
      return res.json();
    },
    enabled: !!userId,
    throwOnError: false,
  });

  const loading =
    isLoadingConsolidatedAnalytics ||
    isLoadingUserAnalytics ||
    isLoadingUserInsights ||
    isLoadingAssessmentPredictions ||
    isLoadingLearningPathRecommendations ||
    isLoadingAiSuggestions ||
    isLoadingSystemAnalytics ||
    isLoadingPerformanceData;
  const error =
    errorConsolidatedAnalytics ||
    errorUserAnalytics ||
    errorUserInsights ||
    errorAssessmentPredictions ||
    errorLearningPathRecommendations ||
    errorAiSuggestions ||
    errorSystemAnalytics ||
    errorPerformanceData;

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

  const assessmentScoresData = {
    labels: userAnalytics?.assessmentScores?.map(s => s.assessmentName) || [],
    datasets: [
      {
        label: 'Score',
        data: userAnalytics?.assessmentScores?.map(s => s.score) || [],
        backgroundColor: '#f97316',
      },
    ],
  };

  const timeSpentData = {
    labels: userAnalytics?.timeSpentPerTopic?.map(t => t.topic) || [],
    datasets: [
      {
        data: userAnalytics?.timeSpentPerTopic?.map(t => t.time) || [],
        backgroundColor: ['#3b82f6', '#10b981', '#f97316', '#ef4444', '#8b5cf6'],
      },
    ],
  };

  if (loading) {
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

  if (error) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : typeof error === 'string'
          ? error
          : 'An unknown error occurred';
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-700">Failed to Load Analytics</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-red-600">{errorMessage}</p>
            <p className="text-sm text-red-500 mt-2">Please refresh the page to try again.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Your Learning Analytics</h1>
      <p className="text-gray-600 mb-8">
        Gain insights into your learning progress, performance, and personalized recommendations.
      </p>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-3 md:grid-cols-5 lg:grid-cols-7">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="progress">Progress</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="insights">Insights</TabsTrigger>
          <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
          <TabsTrigger value="ai-suggestions">AI Insights</TabsTrigger>
          <TabsTrigger value="predictions">Predictions</TabsTrigger>
          {isAdmin && <TabsTrigger value="system">System</TabsTrigger>}
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Courses Completed</CardTitle>
                <BookOpen className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {consolidatedAnalytics?.coursesCompleted || 0}
                </div>
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
                  {consolidatedAnalytics?.averageScore?.toFixed(1) || 0}%
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
                  {consolidatedAnalytics?.totalStudyHours?.toFixed(1) || 0}
                </div>
                <p className="text-xs text-muted-foreground">Total time spent learning</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Achievements Unlocked</CardTitle>
                <Award className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {consolidatedAnalytics?.achievementsUnlocked || 0}
                </div>
                <p className="text-xs text-muted-foreground">Milestones reached</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Peer Ranking</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {consolidatedAnalytics?.peerRanking || 'N/A'}
                </div>
                <p className="text-xs text-muted-foreground">Compared to other users</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Learning Efficiency</CardTitle>
                <Gauge className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {consolidatedAnalytics?.learningEfficiency?.toFixed(1) || 0}%
                </div>
                <p className="text-xs text-muted-foreground">Rate of knowledge acquisition</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="progress" className="mt-6">
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
        </TabsContent>

        <TabsContent value="performance" className="mt-6">
          {performanceData ? (
            <PerformanceAnalyticsContent userId={userId as string} initialData={performanceData} />
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

        <TabsContent value="insights" className="mt-6">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lightbulb className="h-5 w-5" /> Strengths
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="list-disc pl-5 space-y-1">
                  {userInsights?.motivationFactors && userInsights.motivationFactors.length > 0 ? (
                    userInsights.motivationFactors.map((s, i) => <li key={i}>{s}</li>)
                  ) : (
                    <li>No strengths identified yet. Keep learning!</li>
                  )}
                </ul>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-5 w-5" /> Areas for Improvement
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="list-disc pl-5 space-y-1">
                  {userInsights?.riskFactors && userInsights.riskFactors.length > 0 ? (
                    userInsights.riskFactors.map((a, i) => <li key={i}>{a}</li>)
                  ) : (
                    <li>No areas for improvement identified yet.</li>
                  )}
                </ul>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" /> Learning Style
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p>
                  {userInsights?.learningPattern || 'No specific learning style identified yet.'}
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="recommendations" className="mt-6">
          <div className="space-y-4">
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
          </div>
        </TabsContent>

        <TabsContent value="ai-suggestions" className="mt-6">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lightbulb className="h-5 w-5" /> AI-Powered Suggestions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {aiSuggestions && aiSuggestions.length > 0 ? (
                  aiSuggestions.map(suggestion => (
                    <div key={suggestion.id} className="border p-4 rounded-lg">
                      <h3 className="text-lg font-semibold">{suggestion.title}</h3>
                      <p className="text-muted-foreground text-sm mb-2">{suggestion.description}</p>
                      <div className="flex justify-between items-center text-sm">
                        <Badge variant="outline">{suggestion.type}</Badge>
                        {suggestion.link && (
                          <a href={suggestion.link} className="text-primary hover:underline">
                            View Details
                          </a>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-center text-gray-500">
                    No AI suggestions available at the moment.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="system" className="mt-6">
          {isAdmin && (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                    <Users className="h-4 w-4 text-blue-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{systemAnalytics?.totalUsers || 0}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Active Users</CardTitle>
                    <Users className="h-4 w-4 text-green-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{systemAnalytics?.activeUsers || 0}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Courses</CardTitle>
                    <Brain className="h-4 w-4 text-purple-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{systemAnalytics?.totalCourses || 0}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Enrollments</CardTitle>
                    <Award className="h-4 w-4 text-yellow-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {systemAnalytics?.totalEnrollments || 0}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <UserActivityChart />
              <Card>
                <CardHeader>
                  <CardTitle>User Sign-ups</CardTitle>
                </CardHeader>
                <CardContent className="pl-2">
                  <ResponsiveContainer width="100%" height={350}>
                    <AreaChart
                      data={systemAnalytics?.userActivity?.signups || []}
                      margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#fff', border: '1px solid #ccc' }}
                      />
                      <Area type="monotone" dataKey="count" stroke="#3b82f6" fill="#bfdbfe" />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <ContentPerformanceTable />
            </div>
          )}
          {!isAdmin && (
            <Card>
              <CardContent className="p-8 text-center text-gray-500">
                <Brain className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <h3 className="text-lg font-medium mb-2">Admin Access Required</h3>
                <p>System analytics are only available to administrators.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="predictions" className="mt-6">
          <div className="space-y-4">
            {assessmentPredictions && assessmentPredictions.length > 0 ? (
              assessmentPredictions.map(prediction => (
                <Card key={prediction.assessmentId}>
                  <CardHeader>
                    <CardTitle>Prediction for {prediction.assessmentName}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p>
                      <strong>Predicted Score:</strong> {prediction.predictedScore.toFixed(1)}%
                    </p>
                    <p>
                      <strong>Confidence:</strong> {prediction.confidence.toFixed(1)}%
                    </p>
                    <p>{prediction.recommendation}</p>
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card>
                <CardContent className="p-6 text-center text-gray-500">
                  <Brain className="h-10 w-10 mx-auto mb-3" />
                  <p>No assessment predictions available at the moment.</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
export { AnalyticsDashboard };
