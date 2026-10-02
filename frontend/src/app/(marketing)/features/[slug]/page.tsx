'use client';

import { useParams } from 'next/navigation';
import { features } from '@/core/marketing/data/features';

const FeaturePage = () => {
  const params = useParams();
  const slug = params?.slug;
  const feature =
    typeof slug === 'string'
      ? features.find(f => f.title.toLowerCase().replace(/\s+/g, '-') === slug)
      : undefined;

  if (!feature) {
    return (
      <main className="min-h-[50vh] px-4 py-16 text-center sm:px-6">
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">Feature not found</h1>
        <p className="mt-3 text-base text-gray-600">This feature page is not available.</p>
      </main>
    );
  }

  return (
    <main className="min-h-[60vh] bg-white py-12 sm:py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12 sm:mb-16">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">{feature.title}</h1>
          <p className="text-base sm:text-xl text-gray-600 max-w-3xl mx-auto">{feature.description}</p>
        </div>
        {feature.details.length > 0 && (
          <div className="max-w-2xl mx-auto">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4">Key Details</h2>
            <ul className="list-disc list-inside space-y-2">
              {feature.details.map(detail => (
                <li key={detail} className="text-base text-gray-700">
                  {detail}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </main>
  );
};

export default FeaturePage;
