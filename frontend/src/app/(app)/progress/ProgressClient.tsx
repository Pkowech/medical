'use client';

import React from 'react';
import { ProgressDashboard } from '@/features/learning-management/components/progress/progress-dashboard';
import { ProtectedRoute } from '@/features/auth/components/ProtectedRoute';

export default function ProgressClient() {
  return (
    <ProtectedRoute>
      <ProgressDashboard />
    </ProtectedRoute>
  );
}
