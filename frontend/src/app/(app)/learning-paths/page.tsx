import type { Metadata } from 'next';
import LearningPathsClient from './LearningPathsClient';

export const metadata: Metadata = {
  title: 'Learning Paths | MedTrack Hub',
  description: 'Explore structured curriculums, guided tracks, and personalized medical education pathways.',
};

export default function LearningPathsPage() {
  return <LearningPathsClient />;
}
