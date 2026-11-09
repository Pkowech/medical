import { useState, useEffect, useCallback } from 'react';
import {
  Assessment,
  AssessmentHistory,
  fetchAssessments,
  fetchAssessmentHistory,
  fetchUserAssessmentSummary,
} from '@/features/assessment/services/assessmentService';
import type { PerformanceData } from '@/shared/types/analyticsInterface';

export const useAssessments = () => {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [summary, setSummary] = useState<PerformanceData | null>(null);
  const [history, setHistory] = useState<AssessmentHistory['attempts']>([]);
  const [historyError, setHistoryError] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [assessmentsResult, summaryResult, historyResult] =
      await Promise.allSettled([
        fetchAssessments(),
        fetchUserAssessmentSummary(),
        fetchAssessmentHistory(),
      ]);

    if (assessmentsResult.status === 'fulfilled') {
      setAssessments(assessmentsResult.value);
    } else {
      console.error('Failed to load assessments:', assessmentsResult.reason);
      setAssessments([]);
    }

    setSummary(summaryResult.status === 'fulfilled' ? summaryResult.value : null);
    if (historyResult.status === 'fulfilled') {
      setHistory(historyResult.value);
      setHistoryError(false);
    } else {
      console.error('Failed to load assessment history:', historyResult.reason);
      setHistory([]);
      setHistoryError(true);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  return {
    assessments,
    summary,
    history,
    historyError,
    loading,
    refreshAssessments: loadData,
  };
};
