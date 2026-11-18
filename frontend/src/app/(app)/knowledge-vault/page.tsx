import MaterialsDashboard from '@/features/materials/components/materials-dashboard';
import { getPageMetadata } from '@/core/metadata/pageMetadata';
import { LoadingSpinner } from '@/shared/components/ui/loading-spinner';
import type { Metadata } from 'next';
import { Suspense } from 'react';

export const metadata: Metadata = getPageMetadata('/knowledge-vault');

export default function KnowledgeVaultPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <MaterialsDashboard />
    </Suspense>
  );
}
