import { useState, useEffect, useCallback } from 'react';
import {
  Assessment,
  fetchAssessments,
  fetchUserAssessmentSummary,
} from '@/features/assessment/services/assessmentService';
import type { PerformanceData } from '@/shared/types/analyticsInterface';

export const useAssessments = () => {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [summary, setSummary] = useState<PerformanceData | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [assessmentsData, summaryData] = await Promise.all([
        fetchAssessments(),
        fetchUserAssessmentSummary(),
      ]);
      setAssessments(assessmentsData);
      setSummary(summaryData);
    } catch (err) {
      console.error('Failed to load assessment data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  return {
    assessments,
    summary,
    loading,
    refreshAssessments: loadData,
  };
};
