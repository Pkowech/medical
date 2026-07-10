import React, { useState, useEffect } from 'react';
import { useRapidReview } from '@/shared/hooks/useRapidReview';
import { Button } from '@/shared/components/ui/button';
import { Progress } from '@/shared/components/ui/progress';
import { Badge } from '@/shared/components/ui/badge';
import { Clock, Zap, Target, CheckCircle, XCircle, RotateCcw, Timer } from 'lucide-react';

interface RapidReviewSessionProps {
  userId: string;
  topics?: string[];
}

const RAPID_REVIEW_TIME_LIMIT = 10 * 60; // 10 minutes in seconds
const QUESTION_TIME_LIMIT = 30; // 30 seconds per question

export function RapidReviewSession({ userId, topics }: RapidReviewSessionProps) {
  const {
    questions,
    currentIndex,
    currentQuestion,
    answers,
    isLoading,
    error,
    sessionComplete,
    answerQuestion,
    resetSession,
    startSession,
    isStarted,
    sessionStartTime,
  } = useRapidReview(userId, topics);

  const [showAnswer, setShowAnswer] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(RAPID_REVIEW_TIME_LIMIT);
  const [questionTimeRemaining, setQuestionTimeRemaining] = useState(QUESTION_TIME_LIMIT);
  const [_selectedAnswer, setSelectedAnswer] = useState<string>('');
  const [_showExplanation, setShowExplanation] = useState(false);

  // Timer effects
  useEffect(() => {
    if (!isStarted || sessionComplete) return;

    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          // Time's up - auto-complete session
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isStarted, sessionComplete]);

  useEffect(() => {
    if (!isStarted || sessionComplete || !currentQuestion) return;

    setQuestionTimeRemaining(QUESTION_TIME_LIMIT);
    const timer = setInterval(() => {
      setQuestionTimeRemaining(prev => {
        if (prev <= 1) {
          // Auto-skip question if time runs out
          handleAutoSkip();
          return QUESTION_TIME_LIMIT;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [currentIndex, isStarted, sessionComplete]);

  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const handleAutoSkip = () => {
    if (currentQuestion) {
      answerQuestion(currentQuestion.id, false, 0); // Mark as incorrect with 0 time
      setSelectedAnswer('');
      setShowExplanation(false);
    }
  };

  const handleAnswerSelect = (answer: string, isCorrect: boolean) => {
    const timeSpent = QUESTION_TIME_LIMIT - questionTimeRemaining;
    answerQuestion(currentQuestion.id, isCorrect, timeSpent);
    setSelectedAnswer('');
    setShowExplanation(false);
  };

  if (isLoading) {
    return (
      <div className="text-center space-y-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <div className="text-blue-500 dark:text-blue-400">Loading rapid review questions...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center space-y-4">
        <XCircle className="h-12 w-12 text-red-500 mx-auto" />
        <div className="text-red-500">{error.message}</div>
        <Button onClick={() => window.location.reload()} variant="outline">
          Try Again
        </Button>
      </div>
    );
  }

  if (!currentQuestion && !sessionComplete && !isStarted) {
    return (
      <div className="text-center space-y-6">
        <div className="space-y-2">
          <Zap className="h-16 w-16 text-yellow-500 dark:text-yellow-400 mx-auto" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Ready for Rapid Review?</h2>
          <p className="text-gray-600 dark:text-slate-400 max-w-md mx-auto">
            10 high-yield questions in 10 minutes. Perfect for last-minute review and reinforcing
            weak areas.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-4 max-w-md mx-auto">
          <div className="text-center">
            <Target className="h-8 w-8 text-blue-500 dark:text-blue-400 mx-auto mb-2" />
            <div className="text-sm font-medium text-gray-900 dark:text-slate-200">10 Questions</div>
            <div className="text-xs text-gray-500 dark:text-slate-500">High-yield topics</div>
          </div>
          <div className="text-center">
            <Timer className="h-8 w-8 text-green-500 dark:text-green-400 mx-auto mb-2" />
            <div className="text-sm font-medium text-gray-900 dark:text-slate-200">10 Minutes</div>
            <div className="text-xs text-gray-500 dark:text-slate-500">Time limit</div>
          </div>
          <div className="text-center">
            <CheckCircle className="h-8 w-8 text-purple-500 dark:text-purple-400 mx-auto mb-2" />
            <div className="text-sm font-medium text-gray-900 dark:text-slate-200">Instant Feedback</div>
            <div className="text-xs text-gray-500 dark:text-slate-500">Learn as you go</div>
          </div>
        </div>

        <Button
          onClick={startSession}
          size="lg"
          className="bg-yellow-500 hover:bg-yellow-600 text-white"
        >
          <Zap className="h-5 w-5 mr-2" />
          Start Rapid Review
        </Button>
      </div>
    );
  }

  if (sessionComplete) {
    const correctCount = answers.filter(a => a.correct).length;
    const totalTime = sessionStartTime ? Math.round((Date.now() - sessionStartTime) / 1000) : 0;
    const averageTime =
      answers.length > 0
        ? Math.round(answers.reduce((sum, a) => sum + (a.timeSpent || 0), 0) / answers.length)
        : 0;
    const percentage = Math.round((correctCount / questions.length) * 100);

    const getScoreColor = (score: number) => {
      if (score >= 80) return 'text-green-600 dark:text-green-400';
      if (score >= 60) return 'text-yellow-600 dark:text-yellow-400';
      return 'text-red-600 dark:text-red-400';
    };

    const getScoreBadgeColor = (score: number) => {
      if (score >= 80) return 'bg-green-100 dark:bg-green-500/20 text-green-800 dark:text-green-400';
      if (score >= 60) return 'bg-yellow-100 dark:bg-yellow-500/20 text-yellow-800 dark:text-yellow-400';
      return 'bg-red-100 dark:bg-red-500/20 text-red-800 dark:text-red-400';
    };

    return (
      <div className="text-center space-y-6">
        <div className="space-y-2">
          <CheckCircle className="h-16 w-16 text-green-500 dark:text-green-400 mx-auto" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Rapid Review Complete!</h2>
        </div>

        <div className="grid grid-cols-2 gap-4 max-w-md mx-auto">
          <div className="bg-white/80 dark:bg-slate-800/50 backdrop-blur-sm rounded-lg p-4 border border-gray-100 dark:border-slate-700/50">
            <div className={`text-2xl font-bold ${getScoreColor(percentage)}`}>
              {correctCount}/{questions.length}
            </div>
            <div className="text-sm text-gray-500 dark:text-slate-400">Questions Correct</div>
            <Badge className={`mt-2 ${getScoreBadgeColor(percentage)}`}>{percentage}%</Badge>
          </div>

          <div className="bg-white/80 dark:bg-slate-800/50 backdrop-blur-sm rounded-lg p-4 border border-gray-100 dark:border-slate-700/50">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{formatTime(totalTime)}</div>
            <div className="text-sm text-gray-500 dark:text-slate-400">Total Time</div>
            <div className="text-xs text-gray-400 dark:text-slate-500 mt-1">Avg: {averageTime}s per question</div>
          </div>
        </div>

        {percentage < 70 && (
          <div className="bg-yellow-50 dark:bg-yellow-500/10 border border-yellow-200 dark:border-yellow-500/20 rounded-lg p-4 max-w-md mx-auto">
            <div className="text-sm text-yellow-800 dark:text-yellow-400">
              <strong>Tip:</strong> Consider reviewing the topics you missed before your next study
              session.
            </div>
          </div>
        )}

        <div className="flex gap-3 justify-center">
          <Button onClick={resetSession} variant="outline">
            <RotateCcw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
          <Button onClick={() => (window.location.href = '/dashboard')}>Back to Dashboard</Button>
        </div>
      </div>
    );
  }

  // MCQ or short answer logic
  const isMCQ = currentQuestion.options && Array.isArray(currentQuestion.options);
  const progressPercentage = ((currentIndex + 1) / questions.length) * 100;

  return (
    <div className="w-full max-w-2xl mx-auto space-y-4">
      {/* Header with timers and progress */}
      <div className="bg-white/80 dark:bg-slate-800/50 backdrop-blur-sm rounded-lg p-4 shadow-sm border border-gray-100 dark:border-slate-700/50">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-4">
            <Badge variant="outline" className="text-sm dark:border-slate-700 dark:text-slate-300">
              Question {currentIndex + 1} / {questions.length}
            </Badge>
            {currentQuestion.topic && (
              <Badge className="bg-blue-100 dark:bg-blue-500/20 text-blue-800 dark:text-blue-400 text-xs">{currentQuestion.topic}</Badge>
            )}
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-gray-500 dark:text-slate-400" />
              <span
                className={`font-mono ${questionTimeRemaining <= 10 ? 'text-red-600 dark:text-red-400 font-bold' : 'text-gray-700 dark:text-slate-300'}`}
              >
                {questionTimeRemaining}s
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Timer className="h-4 w-4 text-blue-500 dark:text-blue-400" />
              <span className="font-mono text-blue-600 dark:text-blue-300">{formatTime(timeRemaining)}</span>
            </div>
          </div>
        </div>

        <Progress value={progressPercentage} className="h-2" />
      </div>

      {/* Question card */}
      <div className="bg-white/80 dark:bg-slate-800/50 backdrop-blur-sm rounded-xl shadow-sm border border-gray-100 dark:border-slate-700/50 p-6">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white leading-relaxed">
            {currentQuestion.question_text}
          </h2>
        </div>

        {isMCQ ? (
          <div className="space-y-3">
            {currentQuestion.options.map((opt: string, idx: number) => (
              <Button
                key={opt}
                className="w-full text-left justify-start p-4 h-auto min-h-12 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-300 dark:hover:border-blue-700 dark:text-slate-200"
                variant="outline"
                onClick={() => handleAnswerSelect(opt, opt === currentQuestion.correctAnswer)}
              >
                <span className="flex items-start gap-3 w-full">
                  <span className="shrink-0 w-6 h-6 rounded-full bg-gray-100 dark:bg-slate-700 flex items-center justify-center text-sm font-medium text-gray-900 dark:text-slate-200">
                    {String.fromCharCode(65 + idx)}
                  </span>
                  <span className="text-left">{opt}</span>
                </span>
              </Button>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {showAnswer ? (
              <div className="p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
                <div className="font-semibold text-blue-900 dark:text-blue-300 mb-2">Correct Answer:</div>
                <div className="text-blue-800 dark:text-blue-400">{currentQuestion.correctAnswer}</div>
                {currentQuestion.explanation && (
                  <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-800">
                    <div className="font-semibold text-blue-900 dark:text-blue-300 mb-1">Explanation:</div>
                    <div className="text-blue-700 dark:text-blue-500 text-sm">{currentQuestion.explanation}</div>
                  </div>
                )}
              </div>
            ) : null}

            {!showAnswer ? (
              <Button
                className="w-full bg-blue-600 hover:bg-blue-700"
                onClick={() => setShowAnswer(true)}
                size="lg"
              >
                Show Answer
              </Button>
            ) : (
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20"
                  onClick={() => handleAnswerSelect('wrong', false)}
                  size="lg"
                >
                  <XCircle className="h-4 w-4 mr-2" />I got it wrong
                </Button>
                <Button
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => handleAnswerSelect('correct', true)}
                  size="lg"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />I got it right
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
