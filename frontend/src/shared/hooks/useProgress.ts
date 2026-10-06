import { useQuery } from '@tanstack/react-query';
import progressService from '../../features/learning-management/services/progressService';
import { ProgressData } from '@/shared/types/progressInterface';
import { useAuthStore } from '@/features/auth/store/useAuthStore';

export function useLearningStreak() {
  const { user } = useAuthStore();
  const {
    data: streakData,
    isLoading: isStreakLoading,
    error: streakError,
  } = useQuery({
    queryKey: ['userLearningStreak', user?.id],
    queryFn: () => {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }
      return progressService.getUserStreaks(user.id);
    },
    enabled: !!user?.id,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
    meta: { persist: Boolean(user?.id) },
  });

  return {
    streak: streakData?.currentStreak,
    longestStreak: streakData?.longestStreak,
    isLoading: isStreakLoading,
    error: streakError instanceof Error ? streakError : null,
  };
}

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
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
    meta: { persist: Boolean(user?.id) },
  });
  const {
    streak,
    longestStreak,
    isLoading: isStreakLoading,
    error: streakError,
  } = useLearningStreak();

  return { 
    progressData: progressData || null, 
    isLoading, 
    error: error instanceof Error ? error : null,
    streak,
    longestStreak,
    isStreakLoading,
    streakError,
    refetch 
  };
}
