import { apiService } from '@/features/auth/services/apiClient';
import type {
  LearningRecommendation,
  StudyPattern,
  AdaptiveLearningConfig,
  ApiResponse,
  AISuggestion,
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

  async getAISuggestions(_userId: string): Promise<AISuggestion[]> {
    // This is a mock implementation. In a real scenario, this would call an API.
    console.warn('Using mock AI suggestions. Implement actual API call for getAISuggestions.');
    return Promise.resolve([
      {
        id: 'ai-sugg-1',
        title: 'Review Pharmacology of CNS Drugs',
        description:
          'Your recent assessment scores indicate a weakness in CNS pharmacology. Consider reviewing modules 3 and 7.',
        type: 'Content Review',
        link: '/courses/pharmacology/cns-drugs',
        priority: 'High',
        rationale: 'Low accuracy in recent CNS-related quizzes.',
        relatedTopics: ['Neurotransmitters', 'Psychopharmacology'],
        estimatedTime: '2 hours',
      },
      {
        id: 'ai-sugg-2',
        title: 'Practice Clinical Case Studies: Cardiology',
        description:
          'You are performing well in theoretical cardiology, but could benefit from applying knowledge to clinical scenarios.',
        type: 'Practice',
        link: '/practice/case-studies/cardiology',
        priority: 'Medium',
        rationale: 'High theoretical knowledge, but moderate application scores.',
        relatedTopics: ['ECG Interpretation', 'Heart Failure Management'],
        estimatedTime: '1.5 hours',
      },
      {
        id: 'ai-sugg-3',
        title: 'Explore Advanced Diagnostic Techniques',
        description:
          'Based on your learning path, consider diving into advanced diagnostic imaging for oncology.',
        type: 'Exploration',
        link: '/resources/advanced-diagnostics/oncology',
        priority: 'Low',
        rationale: 'Consistent high performance; ready for advanced topics.',
        relatedTopics: ['Medical Imaging', 'Oncology'],
        estimatedTime: '3 hours',
      },
    ]);
  }
}

export const aiRecommendationService = new AiRecommendationService();
