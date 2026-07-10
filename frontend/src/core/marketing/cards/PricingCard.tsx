import { Check } from 'lucide-react';
import Link from 'next/link';

interface PricingCardProps {
  name: string;
  price: string;
  priceSuffix: string;
  description: string;
  features: string[];
  cta: string;
  highlighted?: boolean;
}

export function PricingCard({
  name,
  price,
  priceSuffix,
  description,
  features,
  cta,
  highlighted,
}: PricingCardProps) {
  return (
    <div
      className={`bg-white p-8 rounded-2xl border-2 ${highlighted ? 'border-blue-500' : 'border-gray-200'} hover:border-blue-500 transition-all`}
    >
      <div className="text-center mb-8">
        <h3 className="text-2xl font-bold text-gray-900 mb-2">{name}</h3>
        <div className="text-4xl font-bold text-blue-600 mb-2">
          {price}
          <span className="text-lg text-gray-600">{priceSuffix}</span>
        </div>
        <p className="text-gray-600">{description}</p>
      </div>
      <ul className="space-y-4 mb-8">
        {features.map(feature => (
          <li key={feature} className="flex items-center">
            <Check className="h-5 w-5 text-green-500 mr-3" />
            <span>{feature}</span>
          </li>
        ))}
      </ul>
      <Link
        href="/auth/register"
        className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 transition-colors text-center block"
      >
        {cta}
      </Link>
    </div>
  );
}
