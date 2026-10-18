import MaterialsDashboard from '@/features/materials/components/materials-dashboard';
import { Metadata } from 'next';
import { Suspense } from 'react';
import { LoadingSpinner } from '@/shared/components/ui/loading-spinner';

export const metadata: Metadata = {
  title: 'Study Materials — Study Planner',
  description: 'Browse and manage your study materials. Upload, share, and track reading progress.',
};

export default function MaterialsPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <MaterialsDashboard />
    </Suspense>
  );
}
