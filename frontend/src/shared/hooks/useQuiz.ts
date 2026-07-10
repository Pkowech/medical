import { useState, useEffect, useCallback } from 'react';
import { quizStorage } from '../../features/assessment/services/storage';
import { v4 as uuidv4 } from 'uuid';
import { syncService } from '@/lib/core/offline/syncService';
import { apiService } from '@/features/auth/services/apiClient';

interface QuizQuestion {
  id: string;
  question_text: string;
  options: string[];
  correct_answer: string;
  explanation?: string;
}

interface QuizState {
  id: string;
  unitId: string;
  userId: string;
  currentQuestionIndex: number;
  answers: Record<string, string>;
  startTime: Date;
  lastModified: Date;
  synced: boolean;
}

export function useQuiz(unitId: string, userId: string) {
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentState, setCurrentState] = useState<QuizState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  // Handle online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Load quiz state
  useEffect(() => {
    const loadQuizState = async () => {
      if (!unitId || !userId) {
        setIsLoading(false);
        return;
      }
      
      try {
        setIsLoading(true);

        // Try to load from IndexedDB first
        const savedState = await quizStorage.getQuizState(userId, unitId);

        if (savedState) {
          setCurrentState(savedState);
        } else {
          // Create new state if none exists
          const newState: QuizState = {
            id: uuidv4(),
            unitId,
            userId,
            currentQuestionIndex: 0,
            answers: {},
            startTime: new Date(),
            lastModified: new Date(),
            synced: false,
          };
          await quizStorage.saveQuizState(newState);
          setCurrentState(newState);
        }

        // Load questions directly from backend
        const response = await apiService.get<QuizQuestion[]>(`/quizzes/unit/${unitId}`);
        setQuestions(response.data);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to load quiz'));
      } finally {
        setIsLoading(false);
      }
    };

    loadQuizState();
  }, [unitId, userId]);

  const answerQuestion = useCallback(
    async (questionId: string, answer: string) => {
      if (!currentState) return;

      const lastUpdated = Date.now();
      const newState = {
        ...currentState,
        answers: {
          ...currentState.answers,
          [questionId]: answer,
        },
        lastModified: new Date(),
      };

      // OPTIMISTIC UI: Update state immediately
      setCurrentState(newState);
      
      // BACKGROUND SYNC: Save to IndexedDB and sync without blocking UI
      quizStorage.saveQuizState(newState).catch(err => {
        console.error('Failed to save quiz state to IndexedDB:', err);
      });

      // Save response
      const response = {
        id: uuidv4(),
        userId,
        questionId,
        selectedAnswer: answer,
        isCorrect: questions.find(q => q.id === questionId)?.correct_answer === answer,
        timestamp: new Date(),
        synced: false,
      };

      quizStorage.saveQuizResponse(response).catch(err => {
        console.error('Failed to save quiz response:', err);
      });

      // Add to sync queue with timestamp for conflict resolution (using backend path)
      syncService.addToOutbox(`/quizzes/submit/${currentState.id}`, 'POST', {
        questionId,
        answer,
        timestamp: new Date().toISOString(),
      }, {
        'X-Client-Timestamp': String(lastUpdated),
      }, lastUpdated).catch(err => {
        console.error('Failed to add to outbox:', err);
      });
    },
    [currentState, userId, questions]
  );

  const moveToNextQuestion = useCallback(() => {
    if (!currentState) return;

    const newState = {
      ...currentState,
      currentQuestionIndex: currentState.currentQuestionIndex + 1,
      lastModified: new Date(),
    };

    quizStorage.saveQuizState(newState);
    setCurrentState(newState);
  }, [currentState]);

  const moveToPreviousQuestion = useCallback(() => {
    if (!currentState || currentState.currentQuestionIndex === 0) return;

    const newState = {
      ...currentState,
      currentQuestionIndex: currentState.currentQuestionIndex - 1,
      lastModified: new Date(),
    };

    quizStorage.saveQuizState(newState);
    setCurrentState(newState);
  }, [currentState]);

  const getCurrentQuestion = useCallback(() => {
    if (!currentState || !questions.length) return null;
    return questions[currentState.currentQuestionIndex];
  }, [currentState, questions]);

  const getProgress = useCallback(() => {
    if (!currentState || !questions.length) return 0;
    return (Object.keys(currentState.answers).length / questions.length) * 100;
  }, [currentState, questions]);

  const completeQuiz = async () => {
    if (!currentState) return;

    const lastUpdated = Date.now();

    // Transform answers for backend
    const formattedAnswers = Object.entries(currentState.answers).map(([questionId, selectedOption]) => ({
      questionId,
      selectedOption,
    }));

    // OPTIMISTIC UI: Mark quiz as submitted immediately
    const updatedState = {
      ...currentState,
      lastModified: new Date(),
      synced: true, // Mark as "submitted" even if offline
    };
    setCurrentState(updatedState);

    // BACKGROUND SYNC: Queue submission without blocking UI (using backend path)
    await syncService.addToOutbox('/quizzes/submit?type=full', 'POST', {
      unitId,
      answers: formattedAnswers,
    }, {
      'X-Client-Timestamp': String(lastUpdated),
    }, lastUpdated).catch(err => {
      console.error('Failed to queue quiz submission:', err);
      setError(err instanceof Error ? err : new Error('Failed to queue submission'));
    });

    // If online, attempt immediate sync via apiService
    if (!isOffline) {
      try {
        const response = await apiService.post('/quizzes/submit?type=full', {
          unitId,
          answers: formattedAnswers,
        }, {
          headers: {
            'X-Client-Timestamp': String(lastUpdated),
          },
        });

        // Clear local state on immediate success
        await quizStorage.saveQuizState({
          ...updatedState,
          synced: true,
        });
        return response.data;
      } catch (err: unknown) {
        if (err && typeof err === 'object' && 'status' in err && err.status === 409) {
          // Conflict: server has newer data
          console.warn('Quiz submission conflict - server has newer data');
          return { conflict: true };
        }
        console.error('Online sync attempt failed, queued for later:', err);
        // Don't throw - queued for later sync via background sync
      }
    }

    // Return optimistic result
    return { queued: true, offline: isOffline };
  };

  return {
    questions,
    currentState,
    isLoading,
    error,
    isOffline,
    currentQuestion: getCurrentQuestion(),
    progress: getProgress(),
    answerQuestion,
    moveToNextQuestion,
    moveToPreviousQuestion,
    completeQuiz,
  };
}
