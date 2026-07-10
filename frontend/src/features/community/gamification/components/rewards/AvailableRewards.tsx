// frontend/src/components/rewards/AvailableRewards.tsx

'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import {
  getAvailableRewards,
  redeemReward,
} from '@/features/community/gamification/services/rewardService';
import { Reward } from '@/features/community/gamification/services/services';
import { Gift } from 'lucide-react';
import Image from 'next/image';
import { useAuthStore } from '@/features/auth/store/useAuthStore'; // Use Zustand store

export const AvailableRewards: React.FC = () => {
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [redeemingId, setRedeemingId] = useState<string | null>(null);
  const { user } = useAuthStore(); // Get current user from the auth store

  const currentUserId = user?.id || 'user-1'; // Fallback to mock user-1 if no authenticated user

  const fetchRewards = async () => {
    try {
      const fetchedRewards = await getAvailableRewards();
      setRewards(fetchedRewards);
    } catch (err) {
      setError('Failed to fetch available rewards.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRewards();
  }, []);

  const handleRedeem = async (rewardId: string) => {
    setRedeemingId(rewardId);
    try {
      const success = await redeemReward(currentUserId, rewardId);
      if (success) {
        // Optionally show a toast notification
        alert('Reward redeemed successfully!');
        fetchRewards(); // Re-fetch to update the list
      } else {
        alert('Failed to redeem reward. Not enough points or reward not found.');
      }
    } catch (err) {
      setError('Error redeeming reward.');
      console.error(err);
    } finally {
      setRedeemingId(null);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 text-center">Loading available rewards...</CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-red-500">Error: {error}</CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Gift className="mr-2" /> Available Rewards
        </CardTitle>
      </CardHeader>
      <CardContent>
        {rewards.length === 0 ? (
          <p className="text-muted-foreground text-center">No rewards currently available.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {rewards.map(reward => (
              <div
                key={reward.id}
                className="border rounded-lg p-4 flex flex-col items-center text-center"
              >
                <div className="relative w-24 h-24 mb-4">
                  {reward.imageUrl ? (
                    <Image
                      src={reward.imageUrl}
                      alt={reward.name ?? reward.title ?? 'Reward image'}
                      layout="fill"
                      objectFit="contain"
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-200 rounded-lg flex items-center justify-center text-gray-500">
                      <Gift className="w-12 h-12" />
                    </div>
                  )}
                </div>
                <h3 className="font-semibold text-lg mb-1">{reward.name}</h3>
                <p className="text-sm text-muted-foreground mb-3 flex-1">{reward.description}</p>
                <p className="text-lg font-bold text-primary mb-4">{reward.pointsCost} Points</p>
                <Button
                  onClick={() => handleRedeem(reward.id)}
                  disabled={redeemingId === reward.id} // Disable button while redeeming
                  className="w-full"
                >
                  {redeemingId === reward.id ? 'Redeeming...' : 'Redeem Now'}
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
