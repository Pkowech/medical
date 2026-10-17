// frontend/src/components/rewards/AvailableRewards.tsx

'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Gift } from 'lucide-react';

export const AvailableRewards: React.FC = () => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Gift aria-hidden="true" className="mr-2" /> Available Rewards
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p role="status" className="text-sm text-muted-foreground">
          The reward catalog and point costs are not configured in the current backend, so
          redemptions are unavailable.
        </p>
      </CardContent>
    </Card>
  );
};
