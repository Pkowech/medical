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
    try {
      const response = await apiService.get<ApiResponse<LearningPath[]>>(
        `${LEARNING_PATH_BASE_URL}/discovery/personalized?limit=${limit}`
      );
      return response.data?.data || (Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.warn('Failed to fetch recommended paths', error);
      return [];
    }
  }

  async getTrendingPaths(limit: number = 5): Promise<LearningPath[]> {
    try {
      const response = await apiService.get<ApiResponse<LearningPath[]>>(
        `${LEARNING_PATH_BASE_URL}/discovery/trending?limit=${limit}`
      );
      return response.data?.data || (Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.warn('Failed to fetch trending paths', error);
      return [];
    }
  }

  async getCollaborativePaths(limit: number = 5): Promise<LearningPath[]> {
    try {
      const response = await apiService.get<ApiResponse<LearningPath[]>>(
        `${LEARNING_PATH_BASE_URL}/discovery/collaborative?limit=${limit}`
      );
      return response.data?.data || (Array.isArray(response.data) ? response.data : []);
    } catch (error) {
       console.warn('Failed to fetch collaborative paths', error);
      return [];
    }
  }

  async completeLearningPath(learningPathId: string): Promise<void> {
    await apiService.post(`${LEARNING_PATH_BASE_URL}/${learningPathId}/complete`);
  }

  async deleteLearningPath(learningPathId: string): Promise<void> {
    await apiService.delete(`${LEARNING_PATH_BASE_URL}/${learningPathId}`);
  }
}

export const learningPathService = new LearningPathService();
