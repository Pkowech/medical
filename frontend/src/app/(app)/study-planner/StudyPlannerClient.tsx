'use client';

import React from 'react';
import { StudyDashboard } from '@/features/learning-management/study/components/study-dashboard';
import { usePageHeader } from '@/core/providers/HeaderContext';

export default function StudyPlannerClient() {
  const { setHeader } = usePageHeader();

  React.useEffect(() => {
    setHeader({
      title: 'Study Planner',
      description: 'Plan focused study sessions, track learning goals, and organize materials to stay on top of your progress.',
    });

    return () => setHeader(null);
  }, [setHeader]);

  return (
    <div className="w-full min-w-0 flex-1">
      <StudyDashboard />
    </div>
  );
}
