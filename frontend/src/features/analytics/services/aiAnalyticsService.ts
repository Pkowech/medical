import { AssessmentPrediction } from '@/shared/types/analyticsInterface';
import { toast } from 'sonner';
import { apiService } from '@/features/auth/services/apiClient';
import { ApiResponse, ProgressData, ConsolidatedAnalytics, AnalyticsMetrics } from '@/shared/types';

// ANALYTICS_BASE_URL removed as endpoints are now distributed across domain controllers

/**
 * Fetches an AI-driven prediction for a user's performance on a specific assessment.
 */
export const getAssessmentPrediction = async (
  assessmentId: string,
  _userId: string
): Promise<AssessmentPrediction | null> => {
  try {
    const response = await apiService.get<ApiResponse<AssessmentPrediction>>(
      `/assessment-progress/predictions/${assessmentId}`
    );
    return response.data.data;
  } catch (error) {
    console.error('Error fetching assessment prediction:', error);
    toast.error('Failed to load assessment prediction.');
    return null;
  }
};

export const getAllAssessmentPredictions = async (
  _userId: string
): Promise<AssessmentPrediction[]> => {
  try {
    const response = await apiService.get<ApiResponse<AssessmentPrediction[]>>(
      '/assessment-progress/predictions'
    );
    return response.data.data;
  } catch (error) {
    console.error('Error fetching assessment predictions:', error);
    toast.error('Failed to load assessment predictions.');
    return [];
  }
};

/**
 * Get BKT (Bayesian Knowledge Tracing) prediction for a user
 * Better than linear regression for quiz-based knowledge tracing
 */
export const getBKTPrediction = async (
  _userId: string,
): Promise<Record<string, unknown> | null> => {
  try {
    const response = await apiService.get<ApiResponse<Record<string, unknown>>>(
      '/learning/predictions/bkt'
    );
    return response.data.data;
  } catch (error) {
    console.error('Error fetching BKT prediction:', error instanceof Error ? error.message : String(error));
    toast.error('Failed to load BKT prediction.');
    return null;
  }
};

/**
 * Get Burn neural network model prediction for a user
 * Advanced predictions for complex pattern recognition
 */
export const getBurnPrediction = async (_userId: string, features?: number[]): Promise<Record<string, unknown> | null> => {
  void features;
  console.info('Burn-model estimates are unavailable until a trained model is installed.');
  return null;
};

/**
 * Get comprehensive learning analytics for a user
 * Includes learning patterns, performance metrics, engagement, and insights
 */
export const getLearningAnalytics = async (userId: string): Promise<Record<string, unknown> | null> => {
  try {
    const response = await apiService.get<ApiResponse<Record<string, unknown>>>(
      `/progress/learning-insights/${userId}`
    );
    return response.data.data;
  } catch (error) {
    console.error('Error fetching learning analytics:', error instanceof Error ? error.message : String(error));
    toast.error('Failed to load learning analytics.');
    return null;
  }
};

/**
 * Fetches consolidated analytics for the authenticated user.
 */
export const getConsolidatedAnalytics = async (): Promise<ConsolidatedAnalytics | null> => {
  try {
    const response = await apiService.get<ConsolidatedAnalytics>(
      `/admin/system-overview/consolidated-data`
    );
    return response.data ?? null;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('Error fetching consolidated analytics:', err.message, err.stack);
    toast.error('Failed to load consolidated analytics.');
    return null;
  }
};

export const getProgressData = async (): Promise<ProgressData> => {
  try {
    const response = await apiService.get<ApiResponse<ProgressData>>('/analytics/progress');
    return response.data.data;
  } catch (error) {
    console.error('Error fetching progress data:', error);
    throw new Error('Failed to fetch progress data');
  }
};

export const getAnalyticsMetrics = async (): Promise<AnalyticsMetrics> => {
  try {
    const response = await apiService.get<ApiResponse<AnalyticsMetrics>>('/analytics/metrics');
    return response.data.data;
  } catch (error) {
    console.error('Error fetching analytics metrics:', error);
    throw new Error('Failed to fetch analytics metrics');
  }
};

export const getWeakAreasAnalysis = async (): Promise<{ topic: string; score: number }[]> => {
  try {
    const response =
      await apiService.get<ApiResponse<{ topic: string; score: number }[]>>(
        '/analytics/weak-areas'
      );
    return response.data.data;
  } catch (error) {
    console.error('Error fetching weak areas analysis:', error);
    throw new Error('Failed to fetch weak areas analysis');
  }
};

export const getLearningPathProgress = async (pathId: string): Promise<{
  progress: number;
  estimatedCompletion: string;
  milestones: { id: string; title: string; completed: boolean }[];
}> => {
  try {
    const response = await apiService.get<
      ApiResponse<{
        progress: number;
        estimatedCompletion: string;
        milestones: { id: string; title: string; completed: boolean }[];
      }>
    >(`/analytics/learning-paths/${pathId}/progress`);
    return response.data.data;
  } catch (error) {
    console.error('Error fetching learning path progress:', error);
    throw new Error('Failed to fetch learning path progress');
  }
};

export const generateProgressReport = async (from: Date, to: Date): Promise<Blob> => {
  try {
    const response = await apiService.get<Blob>('/analytics/report', {
      params: { from: from.toISOString(), to: to.toISOString() },
      responseType: 'blob',
    });
    return response.data as Blob;
  } catch (error) {
    console.error('Error generating progress report:', error);
    throw new Error('Failed to generate progress report');
  }
};

export const updateLearningGoals = async (goals: { type: string; target: number }[]): Promise<void> => {
  try {
    await apiService.put('/analytics/goals', { goals });
  } catch (error) {
    console.error('Error updating learning goals:', error);
    throw new Error('Failed to update learning goals');
  }
};

export const aiAnalyticsService = {
  getAssessmentPrediction,
  getAllAssessmentPredictions,
  getBKTPrediction,
  getBurnPrediction,
  getLearningAnalytics,
  getConsolidatedAnalytics,
  getProgressData,
  getAnalyticsMetrics,
  getWeakAreasAnalysis,
  getLearningPathProgress,
  generateProgressReport,
  updateLearningGoals,
};
