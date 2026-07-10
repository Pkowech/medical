import { useState, useEffect } from 'react';
import { Assessment, fetchAssessments } from '@/features/assessment/services/assessmentService';

export const useAssessments = () => {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAssessments = async () => {
      setLoading(true);
      const data = await fetchAssessments();
      setAssessments(data);
      setLoading(false);
    };
    loadAssessments();
  }, []);

  return {
    assessments,
    loading,
  };
};
