/**
 * Quiz Integration for Topic Completion
 * Automatically triggers quiz after topic materials are studied
 */
'use client';

import React, { useState, useCallback } from 'react';
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
  XCircle,
  Brain,
  Award,
  ArrowRight,
  Clock,
} from 'lucide-react';
import { apiService } from '@/features/auth/services/apiClient';
import { toast } from 'sonner';

interface QuizOption {
  id: string;
  option_text: string;
  is_correct: boolean;
}

interface QuizQuestion {
  id: string;
  question_text: string;
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
  isOpen: boolean;
  onClose: () => void;
  onComplete?: (score: number) => void;
}

export const TopicQuiz: React.FC<TopicQuizProps> = ({
  topicId,
  unitId,
  courseId,
  isOpen,
  onClose,
  onComplete,
}) => {
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string[]>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState<string>('');

  // Load quiz questions
  React.useEffect(() => {
    if (isOpen && questions.length === 0) {
      loadQuizQuestions();
    }
  }, [isOpen]);

  const loadQuizQuestions = async () => {
    try {
      setIsLoading(true);
      const response = await apiService.get<QuizQuestion[]>(
        `/quiz/topic/${topicId}`
      );
      setQuestions(response.data || []);
      if (response.data?.length === 0) {
        toast.info('No quiz questions available for this topic');
      }
    } catch (error) {
      console.error('Error loading quiz:', error);
      toast.error('Failed to load quiz questions');
    } finally {
      setIsLoading(false);
    }
  };

  const currentQuestion = questions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / questions.length) * 100;

  const handleAnswerSelect = (optionId: string, isMultiSelect: boolean) => {
    setSelectedAnswers(prev => {
      const current = prev[currentQuestion.id] || [];
      if (isMultiSelect) {
        return {
          ...prev,
          [currentQuestion.id]: current.includes(optionId)
            ? current.filter(id => id !== optionId)
            : [...current, optionId],
        };
      } else {
        return { ...prev, [currentQuestion.id]: [optionId] };
      }
    });
  };

  const handleSubmitQuiz = async () => {
    try {
      setIsSubmitting(true);
      const responses = Object.entries(selectedAnswers).map(([qId, answers]) => ({
        questionId: qId,
        selectedAnswers: answers,
      }));

      const response = await apiService.post<{ score: number; feedback?: string }>(
        `/quiz/topic/${topicId}/submit`,
        { responses }
      );

      const result = response.data;
      setScore(result?.score || 0);
      setFeedback(result?.feedback || '');
      setQuizCompleted(true);

      if (onComplete) {
        onComplete(result?.score || 0);
      }

      toast.success(`Quiz completed! Score: ${result?.score || 0}%`);
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
              Quiz Complete!
            </DialogTitle>
          </DialogHeader>

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
              <Button onClick={() => window.location.reload()} className="flex-1">
                Retake Quiz
              </Button>
            </div>
          </div>
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
          {/* Progress Bar */}
          <div className="space-y-2">
            <Progress value={progress} className="h-2" />
            <p className="text-xs text-slate-500">{Math.round(progress)}% complete</p>
          </div>

          {/* Question */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              {currentQuestion.question_text}
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
                      {option.option_text}
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
              <Button onClick={handleNextQuestion} className="flex-1">
                Next
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            ) : (
              <Button
                onClick={handleSubmitQuiz}
                disabled={isSubmitting}
                className="flex-1"
              >
                {isSubmitting ? 'Submitting...' : 'Submit Quiz'}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
