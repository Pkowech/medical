'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { QuizPanel } from '@/features/courses/components/QuizPanel';
import { DynamicPageProps } from '@/shared/types/nextPageProps';

type AssessmentPageProps = DynamicPageProps<{ assessmentId: string }>;

export default function AssessmentDetailPage({ params }: AssessmentPageProps) {
  const router = useRouter();
  const [assessmentId, setAssessmentId] = useState('');

  useEffect(() => {
    let mounted = true;
    void params.then(({ assessmentId: id }) => {
      if (mounted) setAssessmentId(id);
    });
    return () => {
      mounted = false;
    };
  }, [params]);

  if (!assessmentId) {
    return <div className="p-8 text-center text-slate-500">Loading assessment…</div>;
  }

  return (
    <main className="min-h-full bg-slate-50 p-4 dark:bg-slate-950 md:p-8">
      <div className="mx-auto max-w-5xl">
        <QuizPanel
          lessonId={assessmentId}
          lessonTitle="Learning path assessment"
          scope="assessment"
          onReturn={() => router.back()}
        />
      </div>
    </main>
  );
}
