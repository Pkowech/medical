import { Check } from 'lucide-react';

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  details: string[];
}

export function FeatureCard({ icon, title, description, details }: FeatureCardProps) {
  return (
    <div className="bg-white p-8 rounded-2xl shadow-sm hover:shadow-lg transition-all border border-gray-100">
      <div className="bg-blue-100 p-3 rounded-xl w-fit mb-6">{icon}</div>
      <h3 className="text-xl font-bold mb-3">{title}</h3>
      <p className="text-gray-600 mb-4">{description}</p>
      <ul className="space-y-2 text-sm text-gray-600">
        {details.map(detail => (
          <li key={detail} className="flex items-center">
            <Check className="h-4 w-4 text-green-500 mr-2" />
            {detail}
          </li>
        ))}
      </ul>
    </div>
  );
}
