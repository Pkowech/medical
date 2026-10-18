'use client';

import { useCallback, useEffect, useState } from 'react';
import apiService from '@/features/auth/services/apiClient';

type BankQuestion = {
  id: string;
  text: string;
  category: string;
  difficulty: string;
  tags: string[];
  topicIds: string[];
  options: Array<{ id: string; text: string; isCorrect: boolean }>;
};

type BankResponse = {
  questions: BankQuestion[];
  pagination: { page: number; limit: number; total: number; pages: number };
};

export function QuestionBankBrowser({ refreshKey = 0 }: { refreshKey?: number }) {
  const [search, setSearch] = useState('');
  const [result, setResult] = useState<BankResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadQuestions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiService.get<BankResponse>('/quizzes/bank', {
        params: { page: 1, limit: 20, search: search || undefined },
      });
      setResult(response.data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Question bank could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    void loadQuestions();
  }, [loadQuestions, refreshKey]);

  return (
    <section className="space-y-4 rounded-xl border border-border bg-card p-5">
      <div>
        <h2 className="text-lg font-semibold">Question bank</h2>
        <p className="text-sm text-muted-foreground">
          Search reusable questions. Correct answers are visible only in this staff-only view.
        </p>
      </div>
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void loadQuestions();
        }}
      >
        <input
          className="min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search questions or tags"
          aria-label="Search question bank"
        />
        <button className="rounded-md border border-input px-4 text-sm font-medium" type="submit">
          Search
        </button>
      </form>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {loading && <p role="status" className="text-sm text-muted-foreground">Loading questions…</p>}
      {!loading && result && (
        <>
          <p className="text-xs text-muted-foreground">
            {result.pagination.total} question{result.pagination.total === 1 ? '' : 's'} found
          </p>
          {result.questions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No questions match this search.</p>
          ) : (
            <ul className="divide-y divide-border">
              {result.questions.map((question) => (
                <li key={question.id} className="py-3">
                  <p className="font-medium">{question.text}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {question.category} · {question.difficulty} · {question.topicIds.length} linked topic(s)
                  </p>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}