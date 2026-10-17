// frontend/src/app/(app)/rewards/page.tsx

'use client';

import React from 'react';
import { AvailableRewards } from '@/features/community/gamification/components/rewards/AvailableRewards';
import { RedeemedRewards } from '@/features/community/gamification/components/rewards/RedeemedRewards';
import { Gift } from 'lucide-react';

export default function RewardsPage() {
  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold flex items-center">
        <Gift className="mr-2" /> Rewards Center
      </h1>

      <AvailableRewards />

      <RedeemedRewards />
    </div>
  );
}
