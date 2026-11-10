'use client';

import { useState } from 'react';
import { BulkQuestionImport } from '@/features/assessment/components/BulkQuestionImport';
import { QuestionBankBrowser } from '@/features/assessment/components/QuestionBankBrowser';

export default function QuizAuthoringPage() {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6">
      <BulkQuestionImport onImported={() => setRefreshKey((value) => value + 1)} />
      <QuestionBankBrowser refreshKey={refreshKey} />
    </main>
  );
}
