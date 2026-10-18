import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { features } from '@/core/marketing/data/features';

type FeaturePageProps = {
  params: Promise<{ slug: string }>;
};

const getFeature = (slug: string) =>
  features.find(feature => feature.title.toLowerCase().replace(/\s+/g, '-') === slug);

export async function generateMetadata({ params }: FeaturePageProps): Promise<Metadata> {
  const { slug } = await params;
  const feature = getFeature(slug);

  if (!feature) {
    return {
      title: 'Feature Not Found',
      description: 'The requested MedTrack Hub feature page is not available.',
    };
  }

  return {
    title: feature.title,
    description: feature.description,
  };
}

export default async function FeaturePage({ params }: FeaturePageProps) {
  const { slug } = await params;
  const feature = getFeature(slug);

  if (!feature) {
    notFound();
  }

  return (
    <main className="min-h-[60vh] bg-card py-12 sm:py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12 sm:mb-16">
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">{feature.title}</h1>
          <p className="text-base sm:text-xl text-muted-foreground max-w-3xl mx-auto">{feature.description}</p>
        </div>
        {feature.details.length > 0 && (
          <div className="max-w-2xl mx-auto">
            <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-4">Key Details</h2>
            <ul className="list-disc list-inside space-y-2">
              {feature.details.map(detail => (
                <li key={detail} className="text-base text-muted-foreground">
                  {detail}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </main>
  );
}
