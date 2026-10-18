import MaterialsDashboard from '@/features/materials/components/materials-dashboard';
import { Metadata } from 'next';
import { Suspense } from 'react';
import { LoadingSpinner } from '@/shared/components/ui/loading-spinner';
import { getPageMetadata } from '@/core/metadata/pageMetadata';

export const metadata: Metadata = getPageMetadata('/study-planner/materials');

export default function MaterialsPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <MaterialsDashboard />
    </Suspense>
  );
}
