import type { Metadata } from 'next';
import ScheduleComponent from '@/features/learning-management/components/schedule/schedule-component';

export const metadata: Metadata = {
  title: 'Academic Schedule | MedTrack Hub',
  description: 'Manage your medical school timetable, lectures, study sessions, and exam deadlines.',
};

export default function SchedulePage() {
  return <ScheduleComponent />;
}
