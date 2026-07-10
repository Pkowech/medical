import { useState, useEffect, useCallback } from 'react';
import { quizService } from '@/features/assessment/services/quiz';

interface Question {
  id: string;
  question_text: string;
  question?: string;
  options: string[];
  correctAnswer: string;
  correct_answer?: string;
  explanation?: string;
  topic?: string;
}

interface RapidReviewAnswer {
  questionId: string;
  correct: boolean;
  timeSpent?: number;
  selectedAnswer?: string;
}

export function useRapidReview(userId: string, topics?: string[]) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<RapidReviewAnswer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [sessionComplete, setSessionComplete] = useState(false);
  const [isStarted, setIsStarted] = useState(false);
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);

  useEffect(() => {
    async function fetchQuestions() {
      setIsLoading(true);
      setError(null);
      try {
        const data = await quizService.getRapidReviewQuestions(userId, topics);
        setQuestions(Array.isArray(data) ? (data as Question[]) : []);
        setCurrentIndex(0);
        setAnswers([]);
        setSessionComplete(false);
        setIsStarted(false);
        setSessionStartTime(null);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to load rapid review questions'));
      } finally {
        setIsLoading(false);
      }
    }
    if (userId) fetchQuestions();
  }, [userId, topics]);

  const startSession = useCallback(() => {
    setIsStarted(true);
    setSessionStartTime(Date.now());
    setCurrentIndex(0);
    setAnswers([]);
    setSessionComplete(false);
  }, []);

  const answerQuestion = useCallback(
    (questionId: string, correct: boolean, timeSpent?: number, selectedAnswer?: string) => {
      setAnswers(prev => [...prev, { questionId, correct, timeSpent, selectedAnswer }]);
      if (currentIndex + 1 < questions.length) {
        setCurrentIndex(idx => idx + 1);
      } else {
        setSessionComplete(true);
      }
    },
    [currentIndex, questions.length]
  );

  const resetSession = useCallback(() => {
    setCurrentIndex(0);
    setAnswers([]);
    setSessionComplete(false);
    setIsStarted(false);
    setSessionStartTime(null);
  }, []);

  return {
    questions,
    currentIndex,
    currentQuestion: questions[currentIndex],
    answers,
    isLoading,
    error,
    sessionComplete,
    isStarted,
    sessionStartTime,
    answerQuestion,
    resetSession,
    startSession,
  };
}
