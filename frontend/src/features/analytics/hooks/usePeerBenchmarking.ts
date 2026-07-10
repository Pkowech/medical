import { useState, useEffect, useCallback } from 'react';
import type { PeerBenchmark, BenchmarkStats } from '@/shared/types/analyticsInterface';

export const usePeerBenchmarking = () => {
  const [benchmarks, setBenchmarks] = useState<PeerBenchmark[]>([]);
  const [stats, setStats] = useState<BenchmarkStats>({
    userRank: 0,
    userPercentile: 0,
    averageScore: 0,
    topScore: 0,
    totalParticipants: 0,
    userScore: 0,
  });
  const [isLoading, setIsLoading] = useState(false);

  const getBenchmarks = useCallback(async (_topic?: string) => {
    setIsLoading(true);
    try {
      // Mock data - in real implementation, this would fetch from API
      const mockBenchmarks: PeerBenchmark[] = [
        {
          userId: 'user1',
          username: 'John Doe',
          score: 85,
          rank: 1,
          percentile: 95,
          totalParticipants: 100,
        },
        {
          userId: 'user2',
          username: 'Jane Smith',
          score: 82,
          rank: 2,
          percentile: 92,
          totalParticipants: 100,
        },
        {
          userId: 'current-user',
          username: 'Current User',
          score: 78,
          rank: 5,
          percentile: 85,
          totalParticipants: 100,
        },
      ];

      setBenchmarks(mockBenchmarks);

      // Calculate stats
      const userBenchmark = mockBenchmarks.find(b => b.userId === 'current-user');
      if (userBenchmark) {
        setStats({
          userRank: userBenchmark.rank,
          userPercentile: userBenchmark.percentile,
          averageScore: mockBenchmarks.reduce((sum, b) => sum + b.score, 0) / mockBenchmarks.length,
          topScore: Math.max(...mockBenchmarks.map(b => b.score)),
          totalParticipants: userBenchmark.totalParticipants,
          userScore: userBenchmark.score,
        });
      }
    } catch (error) {
      console.error('Error fetching benchmarks:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const submitScore = useCallback(async (score: number, topic: string) => {
    setIsLoading(true);
    try {
      // Mock API call to submit score
      console.warn('Submitting score:', score, 'for topic:', topic);

      // Refresh benchmarks after submission
      await getBenchmarks(topic);
    } catch (error) {
      console.error('Error submitting score:', error);
    } finally {
      setIsLoading(false);
    }
  }, [getBenchmarks]);

  useEffect(() => {
    getBenchmarks();
  }, [getBenchmarks]);

  const getPeerStats = useCallback(() => {
    return stats;
  }, [stats]);

  return {
    benchmarks,
    stats,
    isLoading,
    getBenchmarks,
    submitScore,
    getPeerStats,
  };
};
