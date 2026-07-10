// /src/hooks/useAdaptiveLearning.ts
import { useQuery } from '@tanstack/react-query';
import { apiService } from '@/features/auth/services/apiClient';

export const useAdaptiveLearning = (userId: string, materialId: string) => {
  return useQuery({
    queryKey: ['recommendations', userId, materialId],
    queryFn: async () => {
      const response = await apiService.get<Record<string, unknown>>('/ai-recommendations', {
        params: { userId, materialId },
      });
      return response;
    },
  });
};
