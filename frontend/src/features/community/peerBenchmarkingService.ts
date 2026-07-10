import { apiService } from '@/features/auth/services/apiClient';
import { ApiResponse } from '@/shared/types/base-responseInterface';

export interface PeerStats {
  averageScore: number;
  completionRate: number;
  studyTime: number;
  rank: number;
  totalPeers: number;
}

export interface DetailedComparison {
  category: string;
  userScore: number;
  peerAverage: number;
  percentile: number;
}

export interface TrendData {
  period: string;
  userScore: number;
  peerAverage: number;
}

export interface PeerGroup {
  id: string;
  name: string;
  memberCount: number;
  averageScore: number;
}

class PeerBenchmarkingService {
  private static instance: PeerBenchmarkingService;

  private constructor() {}

  static getInstance(): PeerBenchmarkingService {
    if (!PeerBenchmarkingService.instance) {
      PeerBenchmarkingService.instance = new PeerBenchmarkingService();
    }
    return PeerBenchmarkingService.instance;
  }

  async getPeerStats(userId: string): Promise<PeerStats> {
    try {
      const response = await apiService.get<ApiResponse<PeerStats>>(
        `/benchmarking/${userId}/stats`
      );
      return response.data.data;
    } catch (error) {
      console.error('Error fetching peer stats:', error);
      throw new Error('Failed to fetch peer stats');
    }
  }

  async getDetailedComparison(userId: string): Promise<DetailedComparison[]> {
    try {
      const response = await apiService.get<ApiResponse<DetailedComparison[]>>(
        `/benchmarking/${userId}/detailed`
      );
      return response.data.data;
    } catch (error) {
      console.error('Error fetching detailed comparison:', error);
      throw new Error('Failed to fetch detailed comparison');
    }
  }

  async getTrends(userId: string, timeframe: 'week' | 'month' | 'year'): Promise<TrendData[]> {
    try {
      const response = await apiService.get<ApiResponse<TrendData[]>>(
        `/benchmarking/${userId}/trends/${timeframe}`
      );
      return response.data.data;
    } catch (error) {
      console.error('Error fetching trends:', error);
      throw new Error('Failed to fetch trends');
    }
  }

  async getPeerGroups(): Promise<PeerGroup[]> {
    try {
      const response = await apiService.get<ApiResponse<PeerGroup[]>>('/benchmarking/peer-groups');
      return response.data.data;
    } catch (error) {
      console.error('Error fetching peer groups:', error);
      throw new Error('Failed to fetch peer groups');
    }
  }

  async joinPeerGroup(userId: string, groupId: string): Promise<void> {
    try {
      await apiService.post(`/benchmarking/peer-groups/${groupId}/join`, {
        userId,
      });
    } catch (error) {
      console.error('Error joining peer group:', error);
      throw new Error('Failed to join peer group');
    }
  }

  async leavePeerGroup(userId: string, groupId: string): Promise<void> {
    try {
      await apiService.post(`/benchmarking/peer-groups/${groupId}/leave`, {
        userId,
      });
    } catch (error) {
      console.error('Error leaving peer group:', error);
      throw new Error('Failed to leave peer group');
    }
  }

  async getPerformanceInsights(userId: string): Promise<{
    strengths: string[];
    areasToImprove: string[];
    recommendations: string[];
  }> {
    try {
      const response = await apiService.get<
        ApiResponse<{
          strengths: string[];
          areasToImprove: string[];
          recommendations: string[];
        }>
      >(`/benchmarking/${userId}/insights`);
      return response.data.data;
    } catch (error) {
      console.error('Error fetching performance insights:', error);
      throw new Error('Failed to fetch performance insights');
    }
  }
}

export const peerBenchmarkingService = PeerBenchmarkingService.getInstance();
