'use client';

import { useParams } from 'next/navigation';
import { UnitLayout } from '@/features/courses/components/units/UnitLayout';
import { ProtectedRoute } from '@/features/auth/components/ProtectedRoute';

export default function CoursesUnitPage() {
  const params = useParams();
  const unitId = params.unitId as string;
  
  return (
    <ProtectedRoute>
      <UnitLayout unitId={unitId} />
    </ProtectedRoute>
  );
}
