import { LearningRecommendation } from '@/shared/types/analyticsInterface';
import { toast } from 'sonner';
import { apiService } from '@/features/auth/services/apiClient';
import { ApiResponse } from '@/shared/types/base-responseInterface';

// const AI_ANALYTICS_BASE_URL = '/ai-analytics';

/**
 * Fetches personalized learning path recommendations for the authenticated user.
 */
export const getLearningPathRecommendations = async (): Promise<
  LearningRecommendation[]
> => {
  try {
    const response = await apiService.get<ApiResponse<LearningRecommendation[]>>(
      '/learning-paths/discovery/personalized'
    );
    const data = (response.data as any)?.data ?? response.data ?? [];
    return Array.isArray(data) ? data : [];
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error(
      'Error fetching learning path recommendations:',
      err.message,
      err.stack
    );
    return [];
  }
};
