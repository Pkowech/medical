import { useQuery } from '@tanstack/react-query';
import apiService from '@/features/auth/services/apiClient';

interface HighRiskTopic {
  topic: string;
  cardCount: number;
  passRate: number;
}

export const useHighRiskTopics = (userId: string) => {
  return useQuery({
    queryKey: ['high-risk-topics', userId],
    queryFn: async () => {
      const response = await apiService.get<HighRiskTopic[]>(`/flashcards/high-risk-topics/${userId}`);
      return response.data;
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};
