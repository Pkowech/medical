'use client';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { DynamicPageProps, resolveRouteParams } from '@/shared/types/nextPageProps';
import { QuizPanel } from '@/features/courses/components/QuizPanel';

type UnitQuizPageProps = DynamicPageProps<{ unitId: string }>;

export default function UnitQuizPage({ params }: UnitQuizPageProps) {
  const router = useRouter();
  const [unitId, setUnitId] = useState<string>('');

  useEffect(() => {
    let mounted = true;
    void resolveRouteParams(params).then(({ unitId: resolvedUnitId }) => {
      if (mounted) setUnitId(resolvedUnitId);
    });

    return () => {
      mounted = false;
    };
  }, [params]);

  return (
    <main className="min-h-full bg-slate-50 p-4 pt-[calc(1rem+env(safe-area-inset-top))] dark:bg-slate-950 sm:p-6 sm:pt-[calc(1.5rem+env(safe-area-inset-top))] md:p-8 md:pt-[calc(2rem+env(safe-area-inset-top))]">
      <div className="mx-auto max-w-4xl">
        <header className="mb-5 flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm transition-colors hover:bg-slate-100 active:scale-95 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 motion-reduce:transition-none"
            aria-label="Exit quiz"
          >
            <ArrowLeft aria-hidden="true" className="h-5 w-5" />
          </button>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300">
              Focus session
            </p>
            <h1 className="text-lg font-semibold text-slate-900 dark:text-white">
              Pharmacology unit
            </h1>
          </div>
        </header>
        {unitId ? (
          <QuizPanel
            lessonId={unitId}
            lessonTitle="Pharmacology unit"
            scope="unit"
            immersive
            onReturn={() => router.back()}
          />
        ) : (
          <div
            className="animate-pulse rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900 motion-reduce:animate-none"
            role="status"
          >
            <span className="sr-only">Loading unit quiz</span>
            <div className="h-5 w-2/3 rounded bg-slate-200 dark:bg-slate-700" />
            <div className="mt-6 h-28 rounded-xl bg-slate-100 dark:bg-slate-800" />
            <div className="mt-4 h-12 rounded-xl bg-slate-100 dark:bg-slate-800" />
          </div>
        )}
      </div>
    </main>
  );
}
