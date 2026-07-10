import React from 'react';
import type { Metadata } from 'next';
import StudyPlannerClient from './StudyPlannerClient';

export const metadata: Metadata = {
  title: 'Study Planner | MedTrack Hub',
  description: 'Track your study goals, manage daily tasks, and monitor your medical education progress.',
};

export default function StudyPlannerDashboardPage() {
  return <StudyPlannerClient />;
}
