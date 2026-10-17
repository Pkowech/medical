import { getData, postData } from '@/features/auth/services/apiClient';

export const getRedeemedRewards = async (userId: string): Promise<string[]> => {
  if (!userId) throw new Error('A user ID is required to load redeemed rewards.');

  const response = await getData<unknown>(
    `/rewards/user/${encodeURIComponent(userId)}`,
  );
  let rewards = response.data;

  if (typeof rewards === 'string') {
    const rawReward = rewards.trim();
    if (!rawReward) return [];

    try {
      rewards = JSON.parse(rawReward);
    } catch {
      return [rawReward];
    }
  }

  if (typeof rewards === 'string') return rewards.trim() ? [rewards] : [];

  if (!Array.isArray(rewards) || !rewards.every(reward => typeof reward === 'string')) {
    throw new Error('The rewards service returned an invalid reward list.');
  }

  return rewards;
};

export const redeemReward = async (userId: string, rewardId: string): Promise<void> => {
  if (!userId || !rewardId) {
    throw new Error('A user ID and reward ID are required to redeem a reward.');
  }

  await postData<void>(`/rewards/grant/${encodeURIComponent(userId)}`, { rewardId });
};
