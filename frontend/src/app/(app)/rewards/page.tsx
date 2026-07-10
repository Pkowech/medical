// frontend/src/app/(app)/rewards/page.tsx

'use client';

import React, { useState, useEffect } from 'react';
import { AvailableRewards } from '@/features/community/gamification/components/rewards/AvailableRewards';
import { RedeemedRewards } from '@/features/community/gamification/components/rewards/RedeemedRewards';
import { Gift } from 'lucide-react';

export default function RewardsPage() {
  const [loading, setLoading] = useState(true);
  const [error] = useState<string | null>(null);

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
    return <div className="text-center py-8">Loading Rewards Dashboard...</div>;
  }

  if (error) {
    return <div className="text-center py-8 text-red-500">Error: {error}</div>;
  }

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
