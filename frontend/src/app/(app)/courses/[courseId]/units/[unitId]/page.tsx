'use client';

import { useParams } from 'next/navigation';
import { UnitLayout } from '@/features/courses/components/units/UnitLayout';
import { ProtectedRoute } from '@/features/auth/components/ProtectedRoute';

export default function CoursesUnitPage() {
  const params = useParams();
  const unitId = params.unitId as string;
  const courseId = params.courseId as string;
  
  return (
    <ProtectedRoute>
      <UnitLayout unitId={unitId} courseId={courseId} />
    </ProtectedRoute>
  );
}
