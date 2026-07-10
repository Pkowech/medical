'use client';

import * as React from 'react';
import { useQuiz } from '@/shared/hooks/useQuiz';
import { useSession } from 'next-auth/react';
import { Progress } from '@/shared/components/ui/progress';
import { Button } from '@/shared/components/ui/button';
import { Card } from '@/shared/components/ui/card';
import { Alert, AlertDescription } from '@/shared/components/ui/alert';
import { WifiOff, ArrowLeft, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { DynamicPageProps } from '@/shared/types/nextPageProps';

type QuizPageProps = DynamicPageProps<{ unitId: string }>;

export default function QuizPage({ params }: QuizPageProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const [unitId, setUnitId] = React.useState<string>('');

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      const { unitId } = await params;
      if (mounted) setUnitId(unitId);
    })();
    return () => { mounted = false; };
  }, [params]);

  const {
    questions,
    currentState,
    isLoading,
    error,
    isOffline,
    currentQuestion,
    progress,
    answerQuestion,
    moveToNextQuestion,
    moveToPreviousQuestion,
    completeQuiz,
  } = useQuiz(unitId, session?.user?.id || '');

  React.useEffect(() => {
    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(error => {
        console.warn('Service worker registration failed:', error instanceof Error ? error.message : error);
      });
    }
  }, []);

  if (!unitId || isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
          <div className="h-8 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Alert variant="destructive">
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!currentQuestion) {
    return (
      <div className="container mx-auto p-6">
        <Alert>
          <AlertDescription>No questions available for this unit.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-3xl">
      {isOffline && (
        <Alert className="mb-4">
          <WifiOff className="h-4 w-4" />
          <AlertDescription>
            You are currently offline. Your answers will be saved locally and synced when you're
            back online.
          </AlertDescription>
        </Alert>
      )}

      <div className="mb-6">
        <Progress value={progress} className="h-2" />
        <p className="text-sm text-gray-500 mt-2">
          Question{' '}
          {(currentState?.currentQuestionIndex !== undefined
            ? currentState.currentQuestionIndex
            : 0) + 1}{' '}
          of {questions.length}
        </p>
      </div>

      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">{currentQuestion.question_text}</h2>

        <div className="space-y-3">
          {currentQuestion.options.map((option, index) => (
            <button
              key={index}
              onClick={() => answerQuestion(currentQuestion.id, option)}
              className={`w-full p-4 text-left rounded-lg border transition-colors ${currentState?.answers[currentQuestion.id] === option
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
                }`}
            >
              {option}
            </button>
          ))}
        </div>

        <div className="flex justify-between mt-6">
          <Button
            variant="outline"
            onClick={moveToPreviousQuestion}
            disabled={currentState?.currentQuestionIndex === 0}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Previous
          </Button>

          {currentState?.currentQuestionIndex === questions.length - 1 ? (
            <Button
              onClick={async () => {
                try {
                  await completeQuiz();
                  // Redirect to results or dashboard
                  // For now, go back to dashboard/unit view
                  router.push('/dashboard');
                } catch (error) {
                  console.warn('Quiz submission failed:', error instanceof Error ? error.message : error);
                }
              }}
              className="bg-green-600 hover:bg-green-700"
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Complete Quiz
            </Button>
          ) : (
            <Button
              onClick={moveToNextQuestion}
              disabled={!currentState?.answers[currentQuestion.id]}
            >
              Next
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
