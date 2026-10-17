// frontend/src/app/(app)/gamification/page.tsx

'use client';

import React from 'react';
import { UserPointsWidget } from '@/features/community/gamification/components/UserPointsWidget';
import { BadgesDisplay } from '@/features/community/gamification/components/BadgesDisplay';
import { Leaderboard } from '@/features/community/gamification/components/Leaderboard';
import { Trophy } from 'lucide-react';

export default function GamificationPage() {
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
