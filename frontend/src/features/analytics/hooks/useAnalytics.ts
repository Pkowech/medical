import { useState, useEffect } from 'react';
import { aiAnalyticsService } from '@/features/analytics/services/aiAnalyticsService';
import { useAuthStore } from '@/features/auth/store/useAuthStore';
import type { ConsolidatedAnalytics, AISuggestion } from '@/shared/types/analyticsInterface';

export function useAnalytics() {
  const { user } = useAuthStore();
  const [learningPatterns, setLearningPatterns] = useState<unknown | null>(null);
  const [performancePredictions, setPerformancePredictions] = useState<unknown | null>(null);
  const [studyRecommendations, setStudyRecommendations] = useState<AISuggestion[] | null>(null);
  const [bktPrediction, setBKTPrediction] = useState<Record<string, unknown> | null>(null);
  const [burnPrediction, setBurnPrediction] = useState<Record<string, unknown> | null>(null);
  const [learningAnalytics, setLearningAnalytics] = useState<Record<string, unknown> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const loadAnalytics = async () => {
      if (!user?.id) return;

      try {
        setIsLoading(true);
        const analytics: ConsolidatedAnalytics | null =
          await aiAnalyticsService.getConsolidatedAnalytics();

        setLearningPatterns(analytics?.learningPatterns || null);
        setPerformancePredictions(analytics?.performancePredictions || null);
        setStudyRecommendations(
          Array.isArray(analytics?.studyRecommendations)
            ? (analytics!.studyRecommendations as AISuggestion[])
            : null
        );

        // Load advanced predictions in parallel
        const [bkt, burn, learning] = await Promise.all([
          aiAnalyticsService.getBKTPrediction(user.id),
          aiAnalyticsService.getBurnPrediction(user.id),
          aiAnalyticsService.getLearningAnalytics(user.id),
        ]);

        setBKTPrediction(bkt);
        setBurnPrediction(burn);
        setLearningAnalytics(learning);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to load analytics'));
      } finally {
        setIsLoading(false);
      }
    };

    loadAnalytics();
  }, [user?.id]);

  const refreshAnalytics = async () => {
    if (!user?.id) return;

    try {
      setIsLoading(true);
      const analytics: ConsolidatedAnalytics | null =
        await aiAnalyticsService.getConsolidatedAnalytics();

      setLearningPatterns(analytics?.learningPatterns || null);
      setPerformancePredictions(analytics?.performancePredictions || null);
      setStudyRecommendations(
        Array.isArray(analytics?.studyRecommendations)
          ? (analytics!.studyRecommendations as AISuggestion[])
          : null
      );

      // Refresh advanced predictions in parallel
      const [bkt, burn, learning] = await Promise.all([
        aiAnalyticsService.getBKTPrediction(user.id),
        aiAnalyticsService.getBurnPrediction(user.id),
        aiAnalyticsService.getLearningAnalytics(user.id),
      ]);

      setBKTPrediction(bkt);
      setBurnPrediction(burn);
      setLearningAnalytics(learning);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to refresh analytics'));
    } finally {
      setIsLoading(false);
    }
  };

  return {
    learningPatterns,
    performancePredictions,
    studyRecommendations,
    bktPrediction,
    burnPrediction,
    learningAnalytics,
    isLoading,
    error,
    refreshAnalytics,
  };
}
