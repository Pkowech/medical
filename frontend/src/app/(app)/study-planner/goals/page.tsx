import type { Metadata } from 'next';
import GoalsComponent from '@/features/learning-management/components/goals/goals-component';
import { getPageMetadata } from '@/core/metadata/pageMetadata';

export const metadata: Metadata = getPageMetadata('/study-planner/goals');

export default function GoalsPage() {
  return <GoalsComponent />;
}
