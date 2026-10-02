import { Check } from 'lucide-react';

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  details: string[];
}

export function FeatureCard({ icon, title, description, details }: FeatureCardProps) {
  return (
    <article className="flex h-full min-w-0 flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-lg sm:p-6">
      <div className="mb-4 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 sm:mb-5">{icon}</div>
      <h3 className="text-lg font-bold leading-snug text-slate-950 sm:text-xl">{title}</h3>
      <p className="mt-2 flex-1 text-sm leading-6 text-slate-600 sm:mt-3 sm:text-base sm:leading-7">{description}</p>
      <ul className="mt-4 space-y-2.5 text-sm leading-5 text-slate-700 sm:mt-5">
        {details.map(detail => (
          <li key={detail} className="flex min-w-0 items-start gap-2">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
            <span className="min-w-0">{detail}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}
