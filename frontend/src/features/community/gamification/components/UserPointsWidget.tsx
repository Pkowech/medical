// frontend/src/components/gamification/UserPointsWidget.tsx

'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { getUserPoints } from '../services/gamificationService';
import { Star } from 'lucide-react';
import { useAuthStore } from '@/features/auth/store/useAuthStore';

export const UserPointsWidget: React.FC = () => {
  const userId = useAuthStore(state => state.user?.id);
  const [userPoints, setUserPoints] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setError('Sign in to view your points.');
      setLoading(false);
      return;
    }

    let isCurrent = true;
    const fetchUserPoints = async () => {
      setLoading(true);
      setError(null);
      try {
        const points = await getUserPoints(userId);
        if (isCurrent) setUserPoints(points);
      } catch (err) {
        if (isCurrent) {
          setError(err instanceof Error ? err.message : 'Failed to fetch user points.');
        }
      } finally {
        if (isCurrent) setLoading(false);
      }
    };

    void fetchUserPoints();
    return () => {
      isCurrent = false;
    };
  }, [userId]);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 text-center">Loading points...</CardContent>
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
          <Star className="mr-2" /> Your Points
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {userPoints !== null ? (
          <div>
            <div>
              <p className="text-sm text-muted-foreground">Total Points</p>
              <p className="text-3xl font-bold text-primary">{userPoints}</p>
            </div>
          </div>
        ) : (
          <p>No points data available.</p>
        )}
      </CardContent>
    </Card>
  );
};
