'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { ProtectedRoute } from '@/features/auth/components/ProtectedRoute';
import { TopicViewer } from '@/features/courses/components/TopicViewer';

export default function TopicPage() {
  const params = useParams();
  const courseId = params.courseId as string;
  const unitId = params.unitId as string;
  const topicId = params.topicId as string;

  return (
    <ProtectedRoute>
      <TopicViewer courseId={courseId} unitId={unitId} topicId={topicId} />
    </ProtectedRoute>
  );
}
