'use client';

import { useEffect, useState } from 'react';
import apiService from '@/features/auth/services/apiClient';

type BankQuestion = {
  id: string;
  text: string;
  type: string;
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

interface QuestionBankBrowserProps {
  refreshKey?: number;
  selectable?: boolean;
  selectedQuestionIds?: string[];
  onSelectionChange?: (selectedQuestionIds: string[]) => void;
}

export function QuestionBankBrowser({
  refreshKey = 0,
  selectable = false,
  selectedQuestionIds = [],
  onSelectionChange,
}: QuestionBankBrowserProps) {
  const [search, setSearch] = useState('');
  const [submittedSearch, setSubmittedSearch] = useState('');
  const [searchVersion, setSearchVersion] = useState(0);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<BankResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let isCurrentRequest = true;
    setLoading(true);
    setError(null);
    setResult(null);

    void apiService
      .get<BankResponse>('/quizzes/bank', {
        params: {
          page,
          limit: 20,
          search: submittedSearch || undefined,
        },
      })
      .then(response => {
        if (isCurrentRequest) {
          setResult(response.data);
          if (page > response.data.pagination.pages) {
            setPage(Math.max(1, response.data.pagination.pages));
          }
        }
      })
      .catch((cause: unknown) => {
        if (isCurrentRequest) {
          setError(cause instanceof Error ? cause.message : 'Question bank could not be loaded.');
        }
      })
      .finally(() => {
        if (isCurrentRequest) setLoading(false);
      });

    return () => {
      isCurrentRequest = false;
    };
  }, [page, refreshKey, searchVersion, submittedSearch]);

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
        onSubmit={event => {
          event.preventDefault();
          setPage(1);
          setSubmittedSearch(search.trim());
          setSearchVersion(version => version + 1);
        }}
      >
        <input
          className="min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={search}
          onChange={event => setSearch(event.target.value)}
          placeholder="Search questions or tags"
          aria-label="Search question bank"
        />
        <button className="rounded-md border border-input px-4 text-sm font-medium" type="submit">
          Search
        </button>
      </form>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {loading && (
        <p role="status" className="text-sm text-muted-foreground">
          Loading questions…
        </p>
      )}
      {!loading && result && (
        <>
          <p className="text-xs text-muted-foreground">
            {result.pagination.total} question{result.pagination.total === 1 ? '' : 's'} found
          </p>
          {result.questions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No questions match this search.</p>
          ) : (
            <ul className="divide-y divide-border">
              {result.questions.map(question => (
                <li key={question.id} className="py-3">
                  {selectable &&
                    ['multiple_choice', 'multiple_select', 'true_false'].includes(
                      question.type
                    ) && (
                      <label className="mb-2 flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={selectedQuestionIds.includes(question.id)}
                          onChange={event => {
                            const nextSelection = event.target.checked
                              ? [...new Set([...selectedQuestionIds, question.id])]
                              : selectedQuestionIds.filter(id => id !== question.id);
                            onSelectionChange?.(nextSelection);
                          }}
                        />
                        Include in quiz
                      </label>
                    )}
                  {selectable &&
                    !['multiple_choice', 'multiple_select', 'true_false'].includes(
                      question.type
                    ) && (
                      <p className="mb-2 text-xs text-muted-foreground">
                        This question type is not currently supported in learner quizzes.
                      </p>
                    )}
                  <p className="font-medium">{question.text}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {question.type} · {question.category} · {question.difficulty} ·{' '}
                    {question.topicIds.length} linked topic(s)
                  </p>
                  <ul className="mt-2 space-y-1">
                    {question.options.map(option => (
                      <li
                        key={option.id}
                        className="flex items-center justify-between gap-3 rounded-md bg-muted/50 px-3 py-1.5 text-sm"
                      >
                        <span>{option.text}</span>
                        {option.isCorrect && (
                          <span className="shrink-0 text-xs font-medium text-green-700 dark:text-green-400">
                            Correct answer
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                  {question.tags.length > 0 && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Tags: {question.tags.join(', ')}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
          {result.pagination.pages > 1 && (
            <div className="flex items-center justify-between border-t border-border pt-3">
              <button
                type="button"
                className="rounded-md border border-input px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                disabled={page <= 1 || loading}
                onClick={() => setPage(currentPage => Math.max(1, currentPage - 1))}
              >
                Previous
              </button>
              <span className="text-sm text-muted-foreground">
                Page {result.pagination.page} of {result.pagination.pages}
              </span>
              <button
                type="button"
                className="rounded-md border border-input px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                disabled={page >= result.pagination.pages || loading}
                onClick={() => setPage(currentPage => currentPage + 1)}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
