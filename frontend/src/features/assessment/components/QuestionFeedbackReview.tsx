'use client';

import { useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { flashcardApi } from '@/features/assessment/services/flashcardApi';
import type { DetailedQuestionFeedback } from '@/features/assessment/services/quiz';

export interface QuestionFeedbackReviewItem {
  questionId: string;
  question: string;
  options: Array<{ id: string; text: string }>;
  selectedOptionIds: string[];
  feedback: DetailedQuestionFeedback;
}

interface QuestionFeedbackReviewProps {
  items: QuestionFeedbackReviewItem[];
  userId: string;
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
}

export function QuestionFeedbackReview({
  items,
  userId,
  isLoading,
  error,
  onRetry,
}: QuestionFeedbackReviewProps) {
  const [savingQuestionId, setSavingQuestionId] = useState<string | null>(null);
  const [savedQuestionIds, setSavedQuestionIds] = useState<Set<string>>(() => new Set());
  const [saveError, setSaveError] = useState<string | null>(null);

  const addToFlashcards = async (questionId: string) => {
    setSavingQuestionId(questionId);
    setSaveError(null);
    try {
      await flashcardApi.createFlashcard(userId, { questionId });
      setSavedQuestionIds(previous => new Set(previous).add(questionId));
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : 'The card could not be added.',
      );
    } finally {
      setSavingQuestionId(null);
    }
  };

  return (
    <section className="mt-8 space-y-4 text-left" aria-labelledby="question-review-title">
      <div>
        <h4 id="question-review-title" className="text-lg font-semibold">
          Review your answers
        </h4>
        <p className="text-sm text-muted-foreground">
          Revisit the reasoning, then save any correct answers you want to practice again.
        </p>
      </div>

      {isLoading && <p role="status">Loading answer explanations…</p>}
      {error && (
        <div role="alert" className="flex items-center justify-between gap-3 text-sm text-destructive">
          <span>{error}</span>
          <Button type="button" variant="outline" size="sm" onClick={onRetry}>
            Retry
          </Button>
        </div>
      )}
      {saveError && <p role="alert" className="text-sm text-destructive">{saveError}</p>}

      {items.map(item => {
        const selectedAnswers = item.options
          .filter(option => item.selectedOptionIds.includes(option.id))
          .map(option => option.text);
        const correctAnswers = item.feedback.correctAnswer.map(option => option.text);
        const isSaved = savedQuestionIds.has(item.questionId);

        return (
          <Card key={item.questionId}>
            <CardHeader>
              <CardTitle className="text-base">{item.question}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p>
                <span className="font-medium">Your answer: </span>
                {selectedAnswers.join(', ') || 'No answer'}
                {' — '}
                {item.feedback.isCorrect ? 'Correct' : 'Review this answer'}
              </p>
              <p>
                <span className="font-medium">Correct answer: </span>
                {correctAnswers.join(', ') || 'Unavailable'}
              </p>
              {item.feedback.explanation && (
                <p className="whitespace-pre-line text-muted-foreground">
                  {item.feedback.explanation}
                </p>
              )}
              {item.feedback.conceptsToReview.length > 0 && (
                <div>
                  <p className="font-medium">Concepts to revisit</p>
                  <ul className="list-disc pl-5 text-muted-foreground">
                    {item.feedback.conceptsToReview.map(concept => (
                      <li key={concept}>{concept}</li>
                    ))}
                  </ul>
                </div>
              )}
              {item.feedback.isCorrect ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={isSaved || savingQuestionId === item.questionId}
                  onClick={() => void addToFlashcards(item.questionId)}
                >
                  {isSaved
                    ? 'Added to flashcards'
                    : savingQuestionId === item.questionId
                      ? 'Adding…'
                      : 'Add to flashcards'}
                </Button>
              ) : (
                <p className="text-xs text-muted-foreground">
                  This missed question was added to your review queue.
                </p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </section>
  );
}
