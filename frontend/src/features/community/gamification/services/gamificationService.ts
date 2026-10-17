// frontend/src/services/gamificationService.ts

import {
  type UserPoints,
} from '@/features/community/gamification/types/gamification';
import apiClient from '@/features/auth/services/apiClient';

class GamificationService {
  private readonly baseUrl = '/gamification';

  async getUserPoints(userId: string): Promise<UserPoints> {
    if (!userId) throw new Error('A user ID is required to load points.');
    const response = await apiClient.get<number>(
      `${this.baseUrl}/points/${encodeURIComponent(userId)}`,
    );
    if (typeof response.data !== 'number' || !Number.isFinite(response.data)) {
      throw new Error('The points service returned an invalid total.');
    }
    return response.data;
  }
}

export const gamificationService = new GamificationService();

export const getUserPoints = (userId: string) => gamificationService.getUserPoints(userId);
