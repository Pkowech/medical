// frontend/src/services/rewardService.ts

import { Reward } from '@/features/community/gamification/services/services';
import { getData, postData } from '@/features/auth/services/apiClient';

export const getAvailableRewards = async (): Promise<Reward[]> => {
  try {
    const response = await getData<Reward[]>('/rewards');
    return response?.data || [];
  } catch (err) {
    console.warn('getAvailableRewards: API unavailable, returning empty list', err);
    return [];
  }
};

export const getRedeemedRewards = async (userId: string): Promise<Reward[]> => {
  try {
    const response = await getData<Reward[]>(`/users/${userId}/rewards`);
    return response?.data || [];
  } catch (err) {
    console.warn('getRedeemedRewards: API unavailable, returning empty list', err);
    return [];
  }
};

export const redeemReward = async (userId: string, rewardId: string): Promise<boolean> => {
  try {
    await postData<void>(`/users/${userId}/rewards/${rewardId}`);
    return true;
  } catch (err) {
    console.warn('redeemReward: API unavailable or failed', err);
    return false;
  }
};
