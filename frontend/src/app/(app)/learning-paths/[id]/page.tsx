'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { ProtectedRoute } from '@/features/auth/components/ProtectedRoute';
import { LearningPathVisualization } from '@/features/learning-management/components/learning-paths/learning-path-visualization';

export default function LearningPathDetailPage() {
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50">
        {id && <LearningPathVisualization pathId={id} />}
      </div>
    </ProtectedRoute>
  );
}
