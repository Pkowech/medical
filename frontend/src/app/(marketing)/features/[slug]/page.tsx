'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { features } from '@/core/marketing/data/features';
import { MarketingHeader } from '@/core/marketing/MarketingHeader';
import { AppFooter as Footer } from '@/core/app/components/layout/AppFooter';

interface Feature {
  icon: React.ForwardRefExoticComponent<
    Omit<React.SVGProps<SVGSVGElement>, 'ref'> & React.RefAttributes<SVGSVGElement>
  >;
  title: string;
  description: string;
  details: string[];
}

const FeaturePage = () => {
  const params = useParams();
  const slug = params?.slug;
  const [feature, setFeature] = useState<Feature | null>(null);

  useEffect(() => {
    if (slug) {
      const foundFeature = features.find(f => f.title.toLowerCase().replace(/\s+/g, '-') === slug);
      setFeature(foundFeature || null);
    }
  }, [slug]);

  if (!feature) {
    return <div>Feature not found</div>;
  }

  return (
    <>
      <MarketingHeader />
      <main className="min-h-screen bg-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">{feature.title}</h1>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">{feature.description}</p>
          </div>
          {feature.details && feature.details.length > 0 && (
            <div className="max-w-2xl mx-auto">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Key Details</h2>
              <ul className="list-disc list-inside space-y-2">
                {feature.details.map((detail, index) => (
                  <li key={index} className="text-gray-700">
                    {detail}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
};

export default FeaturePage;
