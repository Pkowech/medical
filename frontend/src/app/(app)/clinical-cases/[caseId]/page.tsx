'use client';

import { useEffect, useState } from 'react';
import { InteractiveCaseInterface } from '@/features/assessment/components/clinical-cases/InteractiveCaseInterface';
import { DynamicPageProps, resolveRouteParams } from '@/shared/types/nextPageProps';

type ClinicalCasePageProps = DynamicPageProps<{ caseId: string }>;

export default function ClinicalCaseDetailPage({ params }: ClinicalCasePageProps) {
  const [caseId, setCaseId] = useState('');

  useEffect(() => {
    let mounted = true;
    void resolveRouteParams(params).then(({ caseId: id }) => {
      if (mounted) setCaseId(id);
    });
    return () => {
      mounted = false;
    };
  }, [params]);

  if (!caseId) {
    return <div className="p-8 text-center text-slate-500">Loading clinical case…</div>;
  }

  return (
    <main className="min-h-full bg-slate-50 p-4 dark:bg-slate-950 md:p-8">
      <div className="mx-auto max-w-6xl">
        <InteractiveCaseInterface caseId={caseId} />
      </div>
    </main>
  );
}
