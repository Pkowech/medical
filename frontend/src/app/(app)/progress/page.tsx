import React from 'react';
import type { Metadata } from 'next';
import ProgressClient from './ProgressClient';

export const metadata: Metadata = {
  title: 'Progress & Analytics | MedTrack Hub',
  description: 'Visualize your learning trends, performance metrics, and study habits.',
};

export default function ProgressPage() {
  return <ProgressClient />;
}
