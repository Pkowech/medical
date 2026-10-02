import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { features } from '@/core/marketing/data/features';
import { FeatureCard } from '@/core/marketing/cards/FeatureCard';

export default function FeaturesPage() {
  return (
    <main className="min-h-[60vh] bg-gray-50 py-12 sm:py-20">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <header className="mx-auto mb-10 max-w-3xl text-center sm:mb-16">
          <h1 className="text-3xl font-bold text-gray-900 sm:text-4xl">Learning tools available today</h1>
          <p className="mt-4 text-base text-gray-600 sm:text-lg">
            Explore current course, practice, progress, study-group, and offline capabilities.
          </p>
        </header>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {features.map(feature => {
            const slug = feature.title.toLowerCase().replace(/\s+/g, '-');
            return (
              <article key={feature.title} className="flex min-w-0 flex-col">
                <FeatureCard
                  icon={<feature.icon className="h-8 w-8 text-blue-600" aria-hidden="true" />}
                  title={feature.title}
                  description={feature.description}
                  details={feature.details}
                />
                <Link
                  href={`/features/${slug}`}
                  className="mt-3 inline-flex items-center self-start font-semibold text-blue-700 hover:underline"
                >
                  View details <ArrowRight className="ml-1 h-4 w-4" aria-hidden="true" />
                </Link>
              </article>
            );
          })}
        </div>
      </div>
    </main>
  );
}
