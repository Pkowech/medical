import type { Metadata } from 'next';
import LearningPathsClient from './LearningPathsClient';
import { getPageMetadata } from '@/core/metadata/pageMetadata';

export const metadata: Metadata = getPageMetadata('/learning-paths');

export default function LearningPathsPage() {
  return <LearningPathsClient />;
}
