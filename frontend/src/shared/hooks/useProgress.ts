import { useQuery } from '@tanstack/react-query';
import progressService from '../../features/learning-management/services/progressService';
import { ProgressData } from '@/shared/types/progressInterface';
import { useAuthStore } from '@/features/auth/store/useAuthStore';

export function useProgress() {
  const { user } = useAuthStore();

  const {
    data: progressData,
    isLoading,
    error,
    refetch,
  } = useQuery<ProgressData>({
    queryKey: ['userProgress', user?.id],
    queryFn: async () => {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }
      return await progressService.getEnrichedProgressData(user.id);
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });

  const streak = progressData?.stats?.streak ?? progressData?.streak ?? 0;

  return { 
    progressData: progressData || null, 
    isLoading, 
    error: error instanceof Error ? error : null,
    streak,
    refetch 
  };
}
