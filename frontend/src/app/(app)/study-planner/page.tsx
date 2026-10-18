import React from 'react';
import type { Metadata } from 'next';
import StudyPlannerClient from './StudyPlannerClient';
import { getPageMetadata } from '@/core/metadata/pageMetadata';

export const metadata: Metadata = getPageMetadata('/study-planner');

export default function StudyPlannerDashboardPage() {
  return <StudyPlannerClient />;
}
