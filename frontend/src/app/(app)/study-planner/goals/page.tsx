import type { Metadata } from 'next';
import GoalsComponent from '@/features/learning-management/components/goals/goals-component';

export const metadata: Metadata = {
  title: 'Learning Goals — Study Planner',
  description: 'Set and track your learning goals to stay organized and motivated.',
};

export default function GoalsPage() {
  return <GoalsComponent />;
}
