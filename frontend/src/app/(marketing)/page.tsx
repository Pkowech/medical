import { Metadata } from 'next';
import MarketingPage from '@/core/marketing/MarketingPage';

export const metadata: Metadata = {
  title: 'MedTrack Hub - Intelligent Medical Education',
  description:
    'Explore medical courses, practice with quizzes and flashcards, plan study sessions, and track your learning progress with MedTrack Hub.',
  openGraph: {
    title: 'MedTrack Hub - Intelligent Medical Education',
    description:
      'Explore medical courses, practice with quizzes and flashcards, plan study sessions, and track your learning progress with MedTrack Hub.',
    type: 'website',
    images: ['/og-image.png'],
  },
};

export default function Page() {
  return <MarketingPage />;
}
