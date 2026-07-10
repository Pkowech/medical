// frontend/src/components/gamification/UserPointsWidget.tsx

'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { getUserPoints } from '../services/gamificationService';
import { UserPoints } from '@/features/community/gamification/types/gamification';
import { Star } from 'lucide-react';

export const UserPointsWidget: React.FC = () => {
  const [userPoints, setUserPoints] = useState<UserPoints | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Assuming a fixed user ID for mock data
  const currentUserId = 'user-1';

  useEffect(() => {
    const fetchUserPoints = async () => {
      try {
        const points = await getUserPoints(currentUserId);
        setUserPoints(points);
      } catch (err) {
        setError('Failed to fetch user points.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchUserPoints();
  }, [currentUserId]);

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
        {userPoints ? (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Total Points</p>
              <p className="text-3xl font-bold text-primary">{userPoints.totalPoints}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Earned Today</p>
              <p className="text-3xl font-bold text-green-500">+{userPoints.pointsEarnedToday}</p>
            </div>
          </div>
        ) : (
          <p>No points data available.</p>
        )}
      </CardContent>
    </Card>
  );
};
