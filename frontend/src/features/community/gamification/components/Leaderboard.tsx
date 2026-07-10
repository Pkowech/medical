// frontend/src/components/gamification/Leaderboard.tsx

'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { getLeaderboard } from '../services/gamificationService';
import { LeaderboardEntry } from '@/features/community/gamification/services/services';
import { ListOrdered, Crown } from 'lucide-react';

export const Leaderboard: React.FC = () => {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const data = await getLeaderboard();
        setLeaderboard(data);
      } catch (err) {
        setError('Failed to fetch leaderboard.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, []);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 text-center">Loading leaderboard...</CardContent>
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
          <ListOrdered className="mr-2" /> Leaderboard
        </CardTitle>
      </CardHeader>
      <CardContent>
        {leaderboard.length === 0 ? (
          <p className="text-muted-foreground text-center">No leaderboard data available.</p>
        ) : (
          <div className="space-y-2">
            {leaderboard.map((entry, index) => (
              <div
                key={entry.userId}
                className={`flex items-center p-3 rounded-lg ${index < 3 ? 'bg-yellow-50/50' : 'hover:bg-muted'}`}
              >
                <span className="font-bold w-8 text-center">{entry.rank ?? index + 1}.</span>
                <div className="flex-1 flex items-center">
                  {index === 0 && (
                    <Crown className="h-5 w-5 text-yellow-500 mr-2" fill="currentColor" />
                  )}
                  <span className="font-medium">
                    {entry.userName || entry.displayName || entry.name || 'Unknown'}
                  </span>
                </div>
                <span className="font-semibold text-primary">
                  {entry.totalPoints ?? entry.points ?? entry.score ?? 0} Points
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
