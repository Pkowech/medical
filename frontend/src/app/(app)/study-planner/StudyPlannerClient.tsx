'use client';

import React from 'react';
import { StudyDashboard } from '@/features/learning-management/study/components/study-dashboard';
import { usePageHeader } from '@/core/providers/HeaderContext';

export default function StudyPlannerClient() {
  const { setHeader } = usePageHeader();

  React.useEffect(() => {
    setHeader({
      title: 'Study Planner',
      description: 'Your personalized study dashboard and progress tracker.',
    });

    return () => setHeader(null);
  }, [setHeader]);

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <StudyDashboard />
    </div>
  );
}
