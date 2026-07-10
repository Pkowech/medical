import { useState } from 'react';
import { useSpacedRepetition } from '@/features/assessment/hooks/useSpacedRepetition';
import { useSession } from 'next-auth/react';
import { Card } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Progress } from '@/shared/components/ui/progress';
import { Alert, AlertDescription } from '@/shared/components/ui/alert';
import { ThumbsUp, ThumbsDown, Clock, CheckCircle2 } from 'lucide-react';

interface SpacedRepetitionReviewProps {
  questionId: string;
  question: string;
  answer: string;
}

export function SpacedRepetitionReview({
  questionId: _questionId,
  question: propQuestion,
  answer: propAnswer,
}: SpacedRepetitionReviewProps) {
  const { data: session } = useSession();
  const { currentCard, stats, isLoading, error, rateCard } = useSpacedRepetition(
    session?.user?.id || ''
  );

  const [showAnswer, setShowAnswer] = useState(false);

  // Use props if provided, otherwise fallback to currentCard from hook
  const displayQuestion = propQuestion || currentCard?.question || 'Loading card content...';
  const displayAnswer = propAnswer || currentCard?.answer || 'No answer available.';

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-gray-200 rounded w-1/4"></div>
        <div className="h-32 bg-gray-200 rounded"></div>
        <div className="h-8 bg-gray-200 rounded w-1/2"></div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error.message}</AlertDescription>
      </Alert>
    );
  }

  if (!currentCard) {
    return (
      <div className="text-center py-8">
        <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">No cards due for review!</h3>
        <p className="text-gray-500">
          {stats?.upcoming ? `${stats.upcoming} cards coming up soon` : 'All caught up!'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="space-y-1">
          <h3 className="text-sm font-medium text-gray-500">Review Progress</h3>
          <div className="flex items-center space-x-2">
            <Progress
              value={(stats?.total ? (stats.total - stats.due) / stats.total : 0) * 100}
              className="w-32"
            />
            <span className="text-sm text-gray-500">
              {stats?.total ? `${stats.total - stats.due}/${stats.total}` : '0/0'}
            </span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm font-medium text-gray-500">Next Review</div>
          <div className="flex items-center space-x-1 text-sm text-gray-500">
            <Clock className="h-4 w-4" />
            <span>{currentCard.nextReview.toLocaleDateString()}</span>
          </div>
        </div>
      </div>

      <Card className="p-8 min-h-[300px] flex flex-col justify-center items-center text-center cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors shadow-inner" onClick={() => !showAnswer && setShowAnswer(true)}>
        <div className="space-y-6 w-full">
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white leading-relaxed">
              {displayQuestion}
            </h2>
          </div>

          {showAnswer ? (
            <div className="space-y-8 mt-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="p-6 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800/50">
                <p className="text-lg text-gray-800 dark:text-slate-200 font-medium">
                  {displayAnswer}
                </p>
              </div>

              <div className="flex flex-wrap justify-center gap-3">
                <Button
                  variant="outline"
                  className="px-8 border-red-200 hover:bg-red-50 hover:text-red-700 dark:border-red-900/50 dark:hover:bg-red-900/20"
                  onClick={(e) => {
                    e.stopPropagation();
                    rateCard(1); // Hard
                    setShowAnswer(false);
                  }}
                >
                  <ThumbsDown className="h-4 w-4 mr-2" />
                  Hard (1)
                </Button>
                <Button
                  variant="outline"
                  className="px-8 border-blue-200 hover:bg-blue-50 hover:text-blue-700 dark:border-blue-900/50 dark:hover:bg-blue-900/20"
                  onClick={(e) => {
                    e.stopPropagation();
                    rateCard(3); // Good
                    setShowAnswer(false);
                  }}
                >
                  <ThumbsUp className="h-4 w-4 mr-2" />
                  Good (2)
                </Button>
                <Button
                  className="px-10 bg-green-600 hover:bg-green-700 text-white shadow-lg"
                  onClick={(e) => {
                    e.stopPropagation();
                    rateCard(5); // Easy
                    setShowAnswer(false);
                  }}
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Easy (3)
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-12 text-gray-400 text-sm animate-pulse">
              Click or press space to reveal answer
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
