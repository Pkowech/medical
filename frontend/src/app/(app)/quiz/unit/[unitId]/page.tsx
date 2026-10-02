'use client';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DynamicPageProps } from '@/shared/types/nextPageProps';
import { QuizPanel } from '@/features/courses/components/QuizPanel';

type UnitQuizPageProps = DynamicPageProps<{ unitId: string }>;

export default function UnitQuizPage({ params }: UnitQuizPageProps) {
  const router = useRouter();
  const [unitId, setUnitId] = useState<string>('');

  useEffect(() => {
    params.then(resolvedParams => {
      setUnitId(resolvedParams.unitId);
    });
  }, [params]);

  if (!unitId) return <div className="p-8 text-center text-slate-500">Loading unit quiz...</div>;

  return (
    <main className="min-h-full bg-slate-50 p-4 dark:bg-slate-950 md:p-8">
      <div className="mx-auto max-w-5xl">
        <QuizPanel
          lessonId={unitId}
          lessonTitle="Pharmacology unit"
          scope="unit"
          onReturn={() => router.back()}
        />
      </div>
    </main>
  );
}
