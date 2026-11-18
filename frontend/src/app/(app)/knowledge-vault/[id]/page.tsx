import MaterialViewPage from '@/app/(app)/study-planner/materials/[id]/page';
import { getPageMetadata } from '@/core/metadata/pageMetadata';
import type { Metadata } from 'next';

export const metadata: Metadata = getPageMetadata('/knowledge-vault/:id');

export default function KnowledgeVaultMaterialPage() {
  return <MaterialViewPage />;
}
