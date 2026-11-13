import { useState, useEffect, useCallback } from 'react';
import {
  Assessment,
  AssessmentHistory,
  fetchAssessments,
  fetchAssessmentHistory,
  fetchUserAssessmentSummary,
} from '@/features/assessment/services/assessmentService';
import { courseService } from '@/features/courses/services/courseService';
import { learningPathService } from '@/features/learning-management/services/learningPathService';
import type { CourseEnrollment } from '@/shared/types/courseInterface';
import type { LearningPathProgress } from '@/shared/types/learningInterface';
import type { PerformanceData } from '@/shared/types/analyticsInterface';

export interface AssessmentCourseContext {
  id: string;
  title: string;
}

export const useAssessments = () => {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [activeCourses, setActiveCourses] = useState<AssessmentCourseContext[]>([]);
  const [activePaths, setActivePaths] = useState<LearningPathProgress[]>([]);
  const [summary, setSummary] = useState<PerformanceData | null>(null);
  const [history, setHistory] = useState<AssessmentHistory['attempts']>([]);
  const [historyError, setHistoryError] = useState(false);
  const [contextError, setContextError] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [
      assessmentsResult,
      summaryResult,
      historyResult,
      coursesResult,
      pathsResult,
    ] =
      await Promise.allSettled([
        fetchAssessments(),
        fetchUserAssessmentSummary(),
        fetchAssessmentHistory(),
        courseService.getEnrolledCourses({ status: 'active', page: 1, limit: 100 }),
        learningPathService.getMyProgress(),
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

    let failedToLoadContext = false;
    if (coursesResult.status === 'fulfilled') {
      const enrollments = coursesResult.value.items as CourseEnrollment[];
      setActiveCourses(
        enrollments
          .filter(enrollment => enrollment.status === 'active')
          .flatMap(enrollment => {
            const id = enrollment.course?.id ?? enrollment.courseId;
            if (!id) return [];
            return [{
              id,
              title: enrollment.course?.title || enrollment.course?.name || 'Enrolled course',
            }];
          }),
      );
    } else {
      console.error('Failed to load active course enrollments:', coursesResult.reason);
      setActiveCourses([]);
      failedToLoadContext = true;
    }

    if (pathsResult.status === 'fulfilled') {
      setActivePaths(
        pathsResult.value.filter(path => {
          const status = path.status.toLowerCase().replace(/[_-]/g, '');
          return status === 'active' || status === 'inprogress' || status === 'notstarted';
        }),
      );
    } else {
      console.error('Failed to load active learning paths:', pathsResult.reason);
      setActivePaths([]);
      failedToLoadContext = true;
    }
    setContextError(failedToLoadContext);

    setLoading(false);
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  return {
    assessments,
    activeCourses,
    activePaths,
    summary,
    history,
    historyError,
    contextError,
    loading,
    refreshAssessments: loadData,
  };
};
