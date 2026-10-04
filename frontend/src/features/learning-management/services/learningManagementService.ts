import { apiService } from '@/features/auth/services/apiClient';
import { ApiResponse } from '@/shared/types/base-responseInterface';
import { LearningPath } from '@/shared/types/learningInterface';

// const AI_ANALYTICS_BASE_URL = '/ai-analytics';

/**
 * Fetches personalized learning path recommendations for the authenticated user.
 */
export const getLearningPathRecommendations = async (): Promise<
  LearningPath[]
> => {
  const response = await apiService.get<ApiResponse<LearningPath[]> | LearningPath[]>(
    '/learning-paths/discovery/personalized'
  );
  const payload = response.data;
  const paths = Array.isArray(payload) ? payload : payload.data;
  if (!Array.isArray(paths)) {
    throw new Error('The learning-path recommendations response was invalid.');
  }
  return paths;
};
