import { apiService } from '@/features/auth/services/apiClient';
import type {
  LearningRecommendation,
  StudyPattern,
  AdaptiveLearningConfig,
  ApiResponse,
} from '@/shared/types';

class AiRecommendationService {
  async getRecommendations(_userId: string): Promise<LearningRecommendation[]> {
    try {
      const response = await apiService.get<ApiResponse<LearningRecommendation[]>>(
        `/assessment-progress/recommendations`
      );
      return response.data.data;
    } catch (error) {
      console.error('Error fetching recommendations:', error);
      throw new Error('Failed to fetch recommendations');
    }
  }

  async getStudyPattern(_userId: string): Promise<StudyPattern> {
    try {
      const response = await apiService.get<ApiResponse<StudyPattern>>(
        `/assessment-progress/analytics`
      );
      return response.data.data;
    } catch (error) {
      console.error('Error fetching study pattern:', error);
      throw new Error('Failed to fetch study pattern');
    }
  }

  async updateLearningConfig(userId: string, config: AdaptiveLearningConfig): Promise<void> {
    try {
      await apiService.put(`/ai/learning-config/${userId}`, config);
    } catch (error) {
      console.error('Error updating learning config:', error);
      throw new Error('Failed to update learning configuration');
    }
  }

  async getFocusedRecommendations(
    userId: string,
    topic: string
  ): Promise<LearningRecommendation[]> {
    try {
      // Mapping focused recommendations to quiz recommendations if topic is treated as context
      const response = await apiService.get<ApiResponse<LearningRecommendation[]>>(
        `/quiz/${topic}/recommendations`
      );
      return response.data.data;
    } catch (error) {
      console.error('Error fetching focused recommendations:', error);
      throw new Error('Failed to fetch focused recommendations');
    }
  }

  async generatePersonalizedPlan(
    userId: string,
    goalId: string
  ): Promise<{
    schedule: Array<{
      date: string;
      activities: Array<{
        type: string;
        duration: number;
        resource: LearningRecommendation;
      }>;
    }>;
  }> {
    try {
      const response = await apiService.post<
        ApiResponse<{
          schedule: Array<{
            date: string;
            activities: Array<{
              type: string;
              duration: number;
              resource: LearningRecommendation;
            }>;
          }>;
        }>
      >(`/assessment-progress/next-steps`, { goalId }); // Best match for progress-based planning
      return response.data.data;
    } catch (error) {
      console.error('Error generating personalized plan:', error);
      throw new Error('Failed to generate personalized plan');
    }
  }

  async getWeakAreasRecommendations(
    _userId: string
  ): Promise<Array<{ topic: string; recommendations: LearningRecommendation[] }>> {
    try {
      const response = await apiService.get<
        ApiResponse<Array<{ topic: string; recommendations: LearningRecommendation[] }>>
      >(`/assessment-progress/study-materials`);
      return response.data.data;
    } catch (error) {
      console.error('Error fetching weak areas recommendations:', error);
      throw new Error('Failed to fetch weak areas recommendations');
    }
  }
}

export const aiRecommendationService = new AiRecommendationService();
