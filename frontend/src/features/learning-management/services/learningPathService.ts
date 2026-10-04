import { apiService } from '@/features/auth/services/apiClient';
import { LearningPath, LearningPathProgress } from '@/shared/types/learningInterface';
import { ApiResponse } from '@/shared/types/base-responseInterface';

const LEARNING_PATH_BASE_URL = '/learning-paths';

class LearningPathService {
  async getMyProgress(): Promise<LearningPathProgress[]> {
    const response = await apiService.get<ApiResponse<LearningPathProgress[]>>(
      `${LEARNING_PATH_BASE_URL}/my-progress`
    );
    return response.data.data;
  }

  async getRecommendedPaths(limit: number = 5): Promise<LearningPath[]> {
    const response = await apiService.get<ApiResponse<LearningPath[]>>(
      `${LEARNING_PATH_BASE_URL}/discovery/personalized?limit=${limit}`
    );
    return response.data?.data || (Array.isArray(response.data) ? response.data : []);
  }

  async getTrendingPaths(limit: number = 5): Promise<LearningPath[]> {
    const response = await apiService.get<ApiResponse<LearningPath[]>>(
      `${LEARNING_PATH_BASE_URL}/discovery/trending?limit=${limit}`
    );
    return response.data?.data || (Array.isArray(response.data) ? response.data : []);
  }

  async getCollaborativePaths(limit: number = 5): Promise<LearningPath[]> {
    const response = await apiService.get<ApiResponse<LearningPath[]>>(
      `${LEARNING_PATH_BASE_URL}/discovery/collaborative?limit=${limit}`
    );
    return response.data?.data || (Array.isArray(response.data) ? response.data : []);
  }

  async deleteLearningPath(learningPathId: string): Promise<void> {
    await apiService.delete(`${LEARNING_PATH_BASE_URL}/${learningPathId}`);
  }
}

export const learningPathService = new LearningPathService();
