import MaterialsDashboard from '@/features/materials/components/materials-dashboard';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Study Materials — Study Planner',
  description: 'Browse and manage your study materials. Upload, share, and track reading progress.',
};

export default function MaterialsPage() {
  return <MaterialsDashboard />;
}
