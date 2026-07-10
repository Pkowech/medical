'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { AlertCircle } from 'lucide-react';
import { aiAnalyticsService } from '@/features/analytics/services/aiAnalyticsService';
import { AnalyticsMetrics } from '@/shared/types/analyticsInterface';

export function ConsolidatedAnalyticsView() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // const [progressData, setProgressData] = useState<any | null>(null);
  const [analyticsMetrics, setAnalyticsMetrics] = useState<AnalyticsMetrics | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // const [pd, am] = await Promise.all([
        //   consolidatedAnalyticsService.getProgressData(),
        //   consolidatedAnalyticsService.getAnalyticsMetrics(),
        // ]);
        // setProgressData(pd);
        const am = await aiAnalyticsService.getAnalyticsMetrics();
        setAnalyticsMetrics(am);
      } catch (err) {
        console.error('Failed to fetch consolidated analytics data:', err);
        setError('Failed to load consolidated analytics data. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  if (error) {
    return (
      <div className="flex items-center justify-center p-8 text-red-600">
        <AlertCircle className="mr-2 h-5 w-5" />
        <span>{error}</span>
      </div>
    );
  }

  if (isLoading || !analyticsMetrics) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      {/* <Card>
        <CardHeader>
          <CardTitle>Progress Data</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={progressData.weeklyProgress}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="studyTime" fill="#8884d8" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card> */}

      <Card>
        <CardHeader>
          <CardTitle>Analytics Metrics</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Average Score: {analyticsMetrics.quizPerformance?.avgScore}</p>
          {/* <p>Completion Rate: {analyticsMetrics.userAnalytics?.completionRate}</p>
          <p>Total Study Time: {analyticsMetrics.userAnalytics?.totalStudyHours}</p> */}
        </CardContent>
      </Card>
    </div>
  );
}
