import UploadMaterialPage from '@/app/(app)/study-planner/materials/upload/page';
import { getPageMetadata } from '@/core/metadata/pageMetadata';
import type { Metadata } from 'next';

export const metadata: Metadata = getPageMetadata('/knowledge-vault/upload');

export default function KnowledgeVaultUploadPage() {
  return <UploadMaterialPage />;
}
