'use client';

import React from 'react';
import { ProtectedRoute } from '@/features/auth/components/ProtectedRoute';
import LearningPathInterface from '@/features/learning-management/components/learning-paths/learning-path-interface';

export default function LearningPathsClient() {
  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50/50 dark:bg-slate-900/50">
        <LearningPathInterface />
      </div>
    </ProtectedRoute>
  );
}
