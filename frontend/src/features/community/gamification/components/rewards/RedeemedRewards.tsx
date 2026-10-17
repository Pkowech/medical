// frontend/src/components/rewards/RedeemedRewards.tsx

'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { getRedeemedRewards } from '@/features/community/gamification/services/rewardService';
import { History } from 'lucide-react';
import { useAuthStore } from '@/features/auth/store/useAuthStore';

export const RedeemedRewards: React.FC = () => {
  const userId = useAuthStore(state => state.user?.id);
  const [redeemedRewards, setRedeemedRewards] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setError('Sign in to view redeemed rewards.');
      setLoading(false);
      return;
    }

    let isCurrent = true;
    setLoading(true);
    setError(null);
    void getRedeemedRewards(userId)
      .then(rewards => {
        if (isCurrent) setRedeemedRewards(rewards);
      })
      .catch((err: unknown) => {
        if (isCurrent) {
          setError(err instanceof Error ? err.message : 'Failed to fetch redeemed rewards.');
        }
      })
      .finally(() => {
        if (isCurrent) setLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [userId]);

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
            {redeemedRewards.map((rewardId, index) => (
              <div
                key={`${rewardId}-${index}`}
                className="border rounded-lg p-4 flex flex-col items-center text-center bg-gray-50"
              >
                <h3 className="font-semibold text-lg">Reward ID</h3>
                <p className="mt-1 break-all text-sm text-muted-foreground">{rewardId}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
