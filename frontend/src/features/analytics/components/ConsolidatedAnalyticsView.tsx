'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { AlertCircle } from 'lucide-react';
import { aiAnalyticsService } from '@/features/analytics/services/aiAnalyticsService';
import { AnalyticsMetrics } from '@/shared/types/analyticsInterface';

export function ConsolidatedAnalyticsView() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analyticsMetrics, setAnalyticsMetrics] = useState<AnalyticsMetrics | null>(null);

  useEffect(() => {
    let active = true;
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const am = await aiAnalyticsService.getAnalyticsMetrics();
        if (active) setAnalyticsMetrics(am);
      } catch (err) {
        console.error('Failed to fetch consolidated analytics data:', err);
        if (active) setError('Failed to load consolidated analytics data. Please try again.');
      } finally {
        if (active) setIsLoading(false);
      }
    };

    void fetchData();
    return () => {
      active = false;
    };
  }, []);

  if (error) {
    return (
      <Card className="border-destructive/30 bg-destructive/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            Analytics unavailable
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">{error}</CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return <p className="py-8 text-center text-sm text-muted-foreground" role="status">Loading analytics...</p>;
  }

  if (!analyticsMetrics) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground" role="status">
          Analytics data is not available yet.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Analytics Metrics</CardTitle>
        </CardHeader>
        <CardContent>
          <p>
            Average Score:{' '}
            {typeof analyticsMetrics.quizPerformance?.avgScore === 'number' &&
            Number.isFinite(analyticsMetrics.quizPerformance.avgScore)
              ? `${analyticsMetrics.quizPerformance.avgScore.toFixed(1)}%`
              : 'Not reported'}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
