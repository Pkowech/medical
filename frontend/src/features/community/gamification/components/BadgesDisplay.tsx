// frontend/src/components/gamification/BadgesDisplay.tsx

'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Award } from 'lucide-react';

export const BadgesDisplay: React.FC = () => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Award aria-hidden="true" className="mr-2" /> Badges
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p role="status" className="text-sm text-muted-foreground">
          Badge definitions and earned-badge tracking are not available in the current backend.
        </p>
      </CardContent>
    </Card>
  );
};
