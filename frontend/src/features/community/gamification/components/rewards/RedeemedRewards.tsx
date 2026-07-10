// frontend/src/components/rewards/RedeemedRewards.tsx

'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { getRedeemedRewards } from '@/features/community/gamification/services/rewardService';
import { Reward } from '@/shared/types/systemInterface';
import { History, Gift } from 'lucide-react';
import Image from 'next/image';
import { useAuthStore } from '@/features/auth/store/useAuthStore'; // Use Zustand store

export const RedeemedRewards: React.FC = () => {
  const [redeemedRewards, setRedeemedRewards] = useState<Reward[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuthStore(); // Get current user from the auth store

  const currentUserId = user?.id || 'user-1'; // Fallback to mock user-1 if no authenticated user

  const fetchRedeemedRewards = async () => {
    try {
      const fetchedRewards = await getRedeemedRewards(currentUserId);
      setRedeemedRewards(fetchedRewards);
    } catch (err) {
      setError('Failed to fetch redeemed rewards.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRedeemedRewards();
  }, [currentUserId]);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 text-center">Loading redeemed rewards...</CardContent>
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
          <History className="mr-2" /> Redeemed Rewards
        </CardTitle>
      </CardHeader>
      <CardContent>
        {redeemedRewards.length === 0 ? (
          <p className="text-muted-foreground text-center">No rewards redeemed yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {redeemedRewards.map(reward => (
              <div
                key={reward.id}
                className="border rounded-lg p-4 flex flex-col items-center text-center bg-gray-50"
              >
                <div className="relative w-24 h-24 mb-4 opacity-70">
                  {reward.imageUrl ? (
                    <Image
                      src={reward.imageUrl}
                      alt={reward.name ?? reward.title ?? 'Redeemed reward image'}
                      fill
                      style={{ objectFit: 'contain' }}
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-200 rounded-lg flex items-center justify-center text-gray-500">
                      <Gift className="w-12 h-12" />
                    </div>
                  )}
                </div>
                <h3 className="font-semibold text-lg mb-1">{reward.name}</h3>
                <p className="text-sm text-muted-foreground mb-3 flex-1">{reward.description}</p>
                {reward.redeemedDate && (
                  <p className="text-xs text-muted-foreground mt-auto">
                    Redeemed on: {new Date(reward.redeemedDate).toLocaleDateString()}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
