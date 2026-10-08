/**
 * Quiz Integration for Topic Completion
 * Automatically triggers quiz after topic materials are studied
 */
'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { Progress } from '@/shared/components/ui/progress';
import {
  CheckCircle,
  Brain,
  Award,
  ArrowRight,
} from 'lucide-react';
import { apiService } from '@/features/auth/services/apiClient';
import { toast } from 'sonner';
import { useCourseStudySession } from '@/features/learning-management/study/components/CourseStudySessionProvider';
import { v4 as uuidv4 } from 'uuid';
import { offlineService } from '@/lib/core/offline/offlineService';

interface QuizOption {
  id: string;
  text: string;
  isCorrect?: boolean;
}

interface QuizQuestion {
  id: string;
  text: string;
  type: 'multiple_choice' | 'multiple_select' | 'true_false';
  difficulty: 'easy' | 'medium' | 'hard';
  options: QuizOption[];
  explanation?: string;
  points: number;
}

interface TopicQuizProps {
  topicId: string;
  unitId: string;
  courseId: string;
  userId: string;
  isOpen: boolean;
  onClose: () => void;
  onComplete?: (result: {
    score: number;
    passed: boolean;
    masteryUnlocked: boolean;
    nextTopicUnlocked: boolean;
    nextTopicId?: string;
  }) => void | Promise<void>;
  onNextTopic?: (topicId: string) => void;
}

export const TopicQuiz: React.FC<TopicQuizProps> = ({
  topicId,
  unitId,
  courseId,
  userId,
  isOpen,
  onClose,
  onComplete,
  onNextTopic,
}) => {
  const { recordCourseActivity } = useCourseStudySession();
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string[]>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState<string>('');
  const [nextTopicId, setNextTopicId] = useState<string | undefined>();
  const [isOffline, setIsOffline] = useState(false);
  const [isProvisional, setIsProvisional] = useState(false);
  const [attemptId, setAttemptId] = useState(() => uuidv4());

  React.useEffect(() => {
    if (isOpen) recordCourseActivity('reading', courseId, topicId);
  }, [courseId, isOpen, recordCourseActivity, topicId]);

  React.useEffect(() => {
    const updateConnection = () => setIsOffline(!navigator.onLine);
    updateConnection();
    window.addEventListener('online', updateConnection);
    window.addEventListener('offline', updateConnection);
    return () => {
      window.removeEventListener('online', updateConnection);
      window.removeEventListener('offline', updateConnection);
    };
  }, []);

  // Load quiz questions
  React.useEffect(() => {
    if (isOpen && questions.length === 0) {
      loadQuizQuestions();
    }
  }, [isOpen, userId, topicId]);

  const loadQuizQuestions = async () => {
    try {
      setIsLoading(true);
      if (!navigator.onLine) {
        const cachedQuiz = userId
          ? await offlineService.getOfflineTopicQuiz(userId, topicId)
          : undefined;
        if (!cachedQuiz) {
          throw new Error('This topic quiz has not been downloaded for offline use.');
        }
        setQuestions(cachedQuiz.questions);
        const savedDraft = userId
          ? (await offlineService.getOfflinePracticeAttempts(userId))
              .filter(attempt => attempt.topicId === topicId && attempt.status === 'draft')
              .sort((left, right) => right.lastUpdated - left.lastUpdated)[0]
          : undefined;
        if (savedDraft) {
          setAttemptId(savedDraft.id);
          setSelectedAnswers(
            Object.fromEntries(
              savedDraft.responses.map(response => [response.questionId, response.selectedAnswers]),
            ),
          );
        }
        return;
      }
      const response = await apiService.get<QuizQuestion[]>(
        `/quizzes/topic/${topicId}`
      );
      setQuestions(response.data || []);
      if (response.data?.length === 0) {
        toast.info('No quiz questions available for this topic');
      }
    } catch (error) {
      console.error('Error loading quiz:', error);
      const status = (error as { status?: number; rawResponse?: { statusCode?: number } })
        ?.status ?? (error as { rawResponse?: { statusCode?: number } })?.rawResponse?.statusCode;
      if (userId && status !== 401 && status !== 403 && status !== 404) {
        try {
          const cachedQuiz = await offlineService.getOfflineTopicQuiz(userId, topicId);
          if (cachedQuiz) {
            setQuestions(cachedQuiz.questions);
            toast.info('Using the practice quiz saved on this device.');
            return;
          }
        } catch (cacheError) {
          console.error('[OfflineQuiz] Could not load the saved practice quiz:', cacheError);
        }
      }
      toast.error(error instanceof Error ? error.message : 'Failed to load quiz questions');
    } finally {
      setIsLoading(false);
    }
  };

  const currentQuestion = questions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / questions.length) * 100;
  const hasCurrentAnswer = Boolean(selectedAnswers[currentQuestion?.id]?.length);

  const handleAnswerSelect = (optionId: string, isMultiSelect: boolean) => {
    const current = selectedAnswers[currentQuestion.id] || [];
    const updatedAnswers = isMultiSelect
      ? {
          ...selectedAnswers,
          [currentQuestion.id]: current.includes(optionId)
            ? current.filter(id => id !== optionId)
            : [...current, optionId],
        }
      : { ...selectedAnswers, [currentQuestion.id]: [optionId] };
    setSelectedAnswers(updatedAnswers);
    if (isOffline && userId) {
      void offlineService
        .saveOfflinePracticeAttempt({
          id: attemptId,
          userId,
          topicId,
          responses: Object.entries(updatedAnswers).map(([questionId, selectedAnswers]) => ({
            questionId,
            selectedAnswers,
          })),
          status: 'draft',
          createdAt: Date.now(),
          lastUpdated: Date.now(),
        })
        .catch(error => console.error('[OfflineQuiz] Failed to save a draft answer:', error));
    }
  };

  const handleSubmitQuiz = async () => {
    try {
      setIsSubmitting(true);
      const responses = Object.entries(selectedAnswers).map(([qId, answers]) => ({
        questionId: qId,
        selectedAnswers: answers,
      }));

      if (isOffline) {
        if (!userId) {
          throw new Error('Sign in online once before taking this offline quiz.');
        }
        const now = Date.now();
        await offlineService.queueOfflinePracticeAttempt({
          id: attemptId,
          userId,
          topicId,
          responses,
          status: 'pending',
          createdAt: now,
          lastUpdated: now,
        });
        setIsProvisional(true);
        setQuizCompleted(true);
        recordCourseActivity('quiz', courseId, topicId);
        toast.success('Practice attempt saved on this device; it will be validated when online.');
        return;
      }

      const response = await apiService.post<{
        score: number;
        feedback?: string;
        passed: boolean;
        masteryUnlocked: boolean;
        nextTopicUnlocked: boolean;
        nextTopicId?: string;
      }>(
        `/quizzes/topic/${topicId}/submit`,
        { responses }
      );

      const result = response.data;
      setScore(result?.score || 0);
      setFeedback(result?.feedback || '');
      setNextTopicId(result?.nextTopicId);
      setQuizCompleted(true);
      recordCourseActivity('quiz', courseId, topicId, result.score);

      if (onComplete) {
        try {
          await onComplete({
            score: result.score,
            passed: result.passed,
            masteryUnlocked: result.masteryUnlocked,
            nextTopicUnlocked: result.nextTopicUnlocked,
            nextTopicId: result.nextTopicId,
          });
        } catch (progressError) {
          console.error('Topic quiz was submitted, but progress sync failed:', progressError);
          toast.error('Quiz submitted, but topic progress could not be saved.');
        }
      }

      toast.success(`Quiz completed! Score: ${result.score}%`);
    } catch (error) {
      console.error('Error submitting quiz:', error);
      toast.error('Failed to submit quiz');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    }
  };

  const handlePreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
    }
  };

  if (!isOpen) return null;

  if (isLoading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Loading Topic Quiz</DialogTitle>
            <DialogDescription>Quiz questions are loading for this topic.</DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center py-12">
            <div className="text-center space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mx-auto" />
              <p className="text-slate-600 dark:text-slate-400">Loading quiz...</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (quizCompleted) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Award className="w-6 h-6 text-yellow-500" />
              {isProvisional ? 'Practice Saved' : 'Quiz Complete!'}
            </DialogTitle>
            <DialogDescription>
              {isProvisional
                ? 'This offline attempt is provisional and does not count toward mastery or topic unlocks.'
                : 'Your topic quiz results are ready.'}
            </DialogDescription>
          </DialogHeader>

            {isProvisional ? (
              <div className="space-y-6">
                <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  Answers are saved on this device. They will be checked by the server when your
                  connection returns. You can review sync status in Offline downloads.
                </p>
                <Button onClick={onClose} className="w-full">Close</Button>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="text-center space-y-4">
                  <div className={`text-5xl font-bold ${score >= 70 ? 'text-green-600' : 'text-orange-600'}`}>
                    {score}%
                  </div>
                  <p className="text-slate-600 dark:text-slate-400">
                    {score >= 90
                      ? '🎉 Excellent! You mastered this topic!'
                      : score >= 70
                        ? '👍 Good job! You understand the key concepts.'
                        : '📚 Keep practicing! Review the materials and try again.'}
                  </p>
                </div>

                {feedback && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                    <h4 className="font-semibold text-slate-900 dark:text-white mb-2">Feedback</h4>
                    <p className="text-slate-700 dark:text-slate-300 text-sm">{feedback}</p>
                  </div>
                )}

                <div className="flex gap-3">
                  <Button variant="outline" onClick={onClose} className="flex-1">
                    Close
                  </Button>
                  <Button
                    onClick={() => {
                      if (nextTopicId && onNextTopic) {
                        onNextTopic(nextTopicId);
                      } else {
                        window.location.reload();
                      }
                    }}
                    className="flex-1"
                  >
                    {nextTopicId && onNextTopic ? 'Next Topic' : 'Retake Quiz'}
                  </Button>
                </div>
              </div>
            )}
        </DialogContent>
      </Dialog>
    );
  }

  if (questions.length === 0) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Quiz</DialogTitle>
            <DialogDescription>No quiz questions available</DialogDescription>
          </DialogHeader>
          <p className="text-slate-600 dark:text-slate-400 py-8 text-center">
            Quiz questions will be added soon for this topic.
          </p>
          <Button onClick={onClose} className="w-full">
            Close
          </Button>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-blue-600" />
            Topic Quiz
          </DialogTitle>
          <DialogDescription>
            Question {currentQuestionIndex + 1} of {questions.length}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
            {isOffline && (
              <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                Offline practice only. Your attempt will be provisional until the server validates it.
              </p>
            )}
          {/* Progress Bar */}
          <div className="space-y-2">
            <Progress value={progress} className="h-2" />
            <p className="text-xs text-slate-500">{Math.round(progress)}% complete</p>
          </div>

          {/* Question */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              {currentQuestion.text}
            </h3>

            <div className="flex gap-2">
              <Badge variant="secondary">{currentQuestion.difficulty}</Badge>
              <Badge variant="outline">{currentQuestion.points} points</Badge>
            </div>

            {/* Options */}
            <div className="space-y-2">
              {currentQuestion.options.map(option => (
                <button
                  key={option.id}
                  onClick={() =>
                    handleAnswerSelect(
                      option.id,
                      currentQuestion.type === 'multiple_select'
                    )
                  }
                  className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                    selectedAnswers[currentQuestion.id]?.includes(option.id)
                      ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-5 h-5 rounded border-2 mt-0.5 flex items-center justify-center ${
                        selectedAnswers[currentQuestion.id]?.includes(option.id)
                          ? 'border-blue-600 bg-blue-600'
                          : 'border-slate-300'
                      }`}
                    >
                      {selectedAnswers[currentQuestion.id]?.includes(option.id) && (
                        <CheckCircle className="w-4 h-4 text-white" />
                      )}
                    </div>
                    <span className="text-slate-700 dark:text-slate-300">
                      {option.text}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Navigation and Submit */}
          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              onClick={handlePreviousQuestion}
              disabled={currentQuestionIndex === 0}
            >
              Previous
            </Button>

            {currentQuestionIndex < questions.length - 1 ? (
              <Button onClick={handleNextQuestion} disabled={!hasCurrentAnswer} className="flex-1">
                Next
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            ) : (
              <Button
                onClick={handleSubmitQuiz}
                disabled={isSubmitting || !hasCurrentAnswer}
                className="flex-1"
              >
                {isSubmitting ? 'Saving...' : isOffline ? 'Save Practice Attempt' : 'Submit Quiz'}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
