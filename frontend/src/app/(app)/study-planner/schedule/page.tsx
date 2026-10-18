import type { Metadata } from 'next';
import ScheduleComponent from '@/features/learning-management/components/schedule/schedule-component';
import { getPageMetadata } from '@/core/metadata/pageMetadata';

export const metadata: Metadata = getPageMetadata('/study-planner/schedule');

export default function SchedulePage() {
  return <ScheduleComponent />;
}
