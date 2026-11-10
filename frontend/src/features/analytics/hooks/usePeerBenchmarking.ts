import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/features/auth/store/useAuthStore';
import { peerBenchmarkingService } from '@/features/analytics/services/peerBenchmarkingService';

export const usePeerBenchmarking = () => {
  const { user } = useAuthStore();
  const query = useQuery({
    queryKey: ['peerBenchmarking', user?.id],
    queryFn: () => {
      if (!user?.id) {
        throw new Error('Sign in to view peer benchmarking.');
      }
      return peerBenchmarkingService.getPeerStats(user.id);
    },
    enabled: Boolean(user?.id),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    meta: { persist: Boolean(user?.id) },
  });

  return {
    stats: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error instanceof Error ? query.error : null,
    refresh: query.refetch,
  };
};
