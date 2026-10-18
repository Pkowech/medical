'use client';

import React from 'react';
import { ProtectedRoute } from '@/features/auth/components/ProtectedRoute';
import LearningPathInterface from '@/features/learning-management/components/learning-paths/learning-path-interface';

export default function LearningPathsClient() {
  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background">
        <LearningPathInterface />
      </div>
    </ProtectedRoute>
  );
}
