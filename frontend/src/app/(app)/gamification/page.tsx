// frontend/src/app/(app)/gamification/page.tsx

'use client';

import React, { useState, useEffect } from 'react';
import { UserPointsWidget } from '@/features/community/gamification/components/UserPointsWidget';
import { BadgesDisplay } from '@/features/community/gamification/components/BadgesDisplay';
import { Leaderboard } from '@/features/community/gamification/components/Leaderboard';
import { Trophy } from 'lucide-react';

export default function GamificationPage() {
  const [loading, setLoading] = useState(true);

  // In a real app, you might fetch all data here or let sub-components fetch their own
  // For simplicity, we'll assume sub-components handle their own fetching from the mock service

  useEffect(() => {
    // Simulate a brief loading for the page itself
    const timer = setTimeout(() => {
      setLoading(false);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  if (loading) {
    return <div className="text-center py-8">Loading Gamification Dashboard...</div>;
  }

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold flex items-center">
        <Trophy className="mr-2" /> Gamification Dashboard
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">
          <UserPointsWidget />
        </div>
        <div className="lg:col-span-2">
          <BadgesDisplay />
        </div>
      </div>

      <Leaderboard />
    </div>
  );
}
