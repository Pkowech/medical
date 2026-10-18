'use client';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { DynamicPageProps, resolveRouteParams } from '@/shared/types/nextPageProps';
import { QuizPanel } from '@/features/courses/components/QuizPanel';
import { unitService } from '@/features/courses/services/unitService';

type UnitQuizPageProps = DynamicPageProps<{ unitId: string }>;

export default function UnitQuizPage({ params }: UnitQuizPageProps) {
  const router = useRouter();
  const [unitId, setUnitId] = useState<string>('');
  const [unitTitle, setUnitTitle] = useState('Unit quiz');
  const [courseId, setCourseId] = useState<string>();

  const returnToUnit = () => {
    router.push(
      courseId && unitId
        ? `/courses/${courseId}/units/${unitId}`
        : '/courses',
    );
  };

  useEffect(() => {
    let mounted = true;
    void resolveRouteParams(params).then(({ unitId: resolvedUnitId }) => {
      if (mounted) setUnitId(resolvedUnitId);
    });

    return () => {
      mounted = false;
    };
  }, [params]);

  useEffect(() => {
    if (!unitId) return;

    let mounted = true;
    void unitService
      .getUnitById(unitId)
      .then(unit => {
        if (mounted) {
          setUnitTitle(unit.title || unit.name || 'Unit quiz');
          setCourseId(unit.courseId);
        }
      })
      .catch(error => {
        console.error('Unable to load the unit title for its quiz:', error);
      });

    return () => {
      mounted = false;
    };
  }, [unitId]);

  return (
    <main className="min-h-full bg-background p-4 pt-[calc(1rem+env(safe-area-inset-top))] dark:bg-background sm:p-6 sm:pt-[calc(1.5rem+env(safe-area-inset-top))] md:p-8 md:pt-[calc(2rem+env(safe-area-inset-top))]">
      <div className="mx-auto max-w-4xl">
        <header className="mb-5 flex items-center gap-3">
          <button
            type="button"
            onClick={returnToUnit}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground shadow-sm transition-colors hover:bg-muted active:scale-95 dark:border-border dark:bg-card dark:text-muted-foreground dark:hover:bg-card motion-reduce:transition-none"
            aria-label="Exit quiz"
          >
            <ArrowLeft aria-hidden="true" className="h-5 w-5" />
          </button>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300">
              Unit quiz
            </p>
            <h1 className="text-lg font-semibold text-foreground dark:text-foreground">
              {unitTitle}
            </h1>
          </div>
        </header>
        {unitId ? (
          <QuizPanel
            lessonId={unitId}
            lessonTitle={unitTitle}
            scope="unit"
            immersive
            onReturn={returnToUnit}
          />
        ) : (
          <div
            className="animate-pulse rounded-2xl border border-border bg-card p-6 dark:border-border dark:bg-card motion-reduce:animate-none"
            role="status"
          >
            <span className="sr-only">Loading unit quiz</span>
            <div className="h-5 w-2/3 rounded bg-secondary dark:bg-secondary" />
            <div className="mt-6 h-28 rounded-xl bg-muted dark:bg-card" />
            <div className="mt-4 h-12 rounded-xl bg-muted dark:bg-card" />
          </div>
        )}
      </div>
    </main>
  );
}
