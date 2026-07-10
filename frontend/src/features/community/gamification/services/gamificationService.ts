// frontend/src/services/gamificationService.ts

import {
  UserPoints,
  Badge,
  GamificationResponse,
  BadgeListResponse,
  LeaderboardResponse,
} from '@/features/community/gamification/types/gamification';
import apiClient from '@/features/auth/services/apiClient';

class GamificationService {
  private readonly baseUrl = '/gamification';

  async getUserPoints(userId: string): Promise<UserPoints> {
    const response = await apiClient.get<GamificationResponse<UserPoints>>(
      `${this.baseUrl}/users/${userId}/points`
    );
    return response.data.data;
  }

  async getAllBadges(): Promise<Badge[]> {
    const response = await apiClient.get<BadgeListResponse>(`${this.baseUrl}/badges`);
    return response.data.data;
  }

  async getUserBadges(userId: string): Promise<Badge[]> {
    const response = await apiClient.get<BadgeListResponse>(
      `${this.baseUrl}/users/${userId}/badges`
    );
    return response.data.data;
  }

  async getLeaderboard(): Promise<LeaderboardResponse['data']> {
    const response = await apiClient.get<LeaderboardResponse>(`${this.baseUrl}/leaderboard`);
    return response.data.data;
  }
}

export const gamificationService = new GamificationService();

// Convenience named exports for components that import functions directly
export const getUserPoints = (userId: string) => gamificationService.getUserPoints(userId);
export const getAllBadges = () => gamificationService.getAllBadges();
export const getUserBadges = (userId: string) => gamificationService.getUserBadges(userId);
export const getLeaderboard = () => gamificationService.getLeaderboard();
