'use client';

import React from 'react';
import { CoursesDashboard } from '@/features/courses/components/courses-dashboard';
import { ProtectedRoute } from '@/features/auth/components/ProtectedRoute';

export default function CoursesPage() {
  return (
    <ProtectedRoute>
      <CoursesDashboard />
    </ProtectedRoute>
  );
}
