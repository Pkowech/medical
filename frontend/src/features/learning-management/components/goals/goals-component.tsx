'use client';

import React from 'react';
import { ProtectedRoute } from '@/features/auth/components/ProtectedRoute';
import { GoalsManagementInterface } from '@/features/learning-management/components/goals/goals-management-interface';

export default function GoalsComponent() {
  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-7xl">
          <GoalsManagementInterface />
        </div>
      </div>
    </ProtectedRoute>
  );
}
