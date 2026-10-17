// frontend/src/components/gamification/Leaderboard.tsx

'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { ListOrdered } from 'lucide-react';

export const Leaderboard: React.FC = () => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <ListOrdered aria-hidden="true" className="mr-2" /> Leaderboard
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p role="status" className="text-sm text-muted-foreground">
          A leaderboard is not available in the current backend, so no sample rankings are shown.
        </p>
      </CardContent>
    </Card>
  );
};
