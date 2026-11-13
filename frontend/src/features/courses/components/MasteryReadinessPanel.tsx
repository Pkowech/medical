import Link from 'next/link';
import type { GateDecision } from '@/shared/types/mastery.types';

interface MasteryReadinessPanelProps {
  decision: GateDecision;
}

export function MasteryReadinessPanel({ decision }: MasteryReadinessPanelProps) {
  return (
    <section
      aria-label="Mastery readiness guidance"
      className="mb-6 rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-left dark:border-amber-900/50 dark:bg-amber-950/20"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h4 className="font-semibold text-foreground">Knowledge-readiness guidance</h4>
          <p className="mt-1 text-sm text-muted-foreground">
            {decision.canProceed
              ? 'Your estimated knowledge meets the guidance target.'
              : 'Additional review is recommended based on your estimated knowledge.'}
          </p>
        </div>
        <span className="rounded-full bg-background px-3 py-1 text-sm font-semibold text-foreground">
          {Math.round(decision.pKnown * 100)}% estimate
        </span>
      </div>

      <p className="mt-3 text-sm text-muted-foreground">{decision.reason}</p>
      <p className="mt-2 text-xs text-muted-foreground">
        This estimate is advisory; your quiz result determines topic unlocking.
      </p>

      {decision.recommendations && decision.recommendations.length > 0 && (
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          {decision.recommendations.map(recommendation => (
            <li key={recommendation}>{recommendation}</li>
          ))}
        </ul>
      )}

      {decision.supportOptions && decision.supportOptions.length > 0 && (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {decision.supportOptions.map(option => (
            <li key={`${option.type}:${option.label}`} className="rounded-lg border bg-background p-3">
              {option.link?.startsWith('/') && !option.link.startsWith('//') ? (
                <Link href={option.link} className="font-medium text-blue-700 underline dark:text-blue-300">
                  {option.label}
                </Link>
              ) : (
                <p className="font-medium text-foreground">{option.label}</p>
              )}
              <p className="mt-1 text-xs text-muted-foreground">{option.description}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
