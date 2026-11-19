'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  quizService,
  type DetailedQuestionFeedback,
  type QuizPerformanceRecommendations,
} from '@/features/assessment/services/quiz';
import { QuestionFeedbackReview } from '@/features/assessment/components/QuestionFeedbackReview';
import { useAuthStore } from '@/features/auth/store/useAuthStore';
import { useXapi } from '@/lib/xapi/useXapi';
import { URLS } from '@/lib/urls';
import { AlertCircle, CheckCircle, Clock3, RefreshCw, Send } from 'lucide-react';
import { useCourseStudySession } from '@/features/learning-management/study/components/CourseStudySessionProvider';
import { v4 as uuidv4 } from 'uuid';
import { TOPIC_MASTERY_PASSING_SCORE, type GateDecision } from '@/shared/types/mastery.types';
import { MasteryReadinessPanel } from './MasteryReadinessPanel';

interface Question {
  id: string;
  text: string;
  type: string;
  options: { id: string; text: string }[];
}

interface QuizPanelProps {
  lessonId?: string | number;
  lessonTitle?: string;
  courseId?: string;
  scope?: 'unit' | 'topic' | 'assessment';
  onTopicCompleted?: () => void;
  onTopicProgressUpdated?: () => void | Promise<void>;
  onNextTopic?: (topicId: string) => void;
  onReturn?: () => void;
  immersive?: boolean;
}

export const QuizPanel = ({
  lessonId,
  lessonTitle,
  courseId,
  scope = 'unit',
  onTopicCompleted,
  onTopicProgressUpdated,
  onNextTopic,
  onReturn,
  immersive = false,
}: QuizPanelProps) => {
  const { trackAction, XAPI_VERBS } = useXapi();
  const { activeSession, recordCourseActivity } = useCourseStudySession();
  const userId = useAuthStore(state => state.user?.id ?? '');
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [timeRemainingSeconds, setTimeRemainingSeconds] = useState<number | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [submittedAnswers, setSubmittedAnswers] = useState<Record<string, string[]>>({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [quizComplete, setQuizComplete] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resultsAvailable, setResultsAvailable] = useState(true);
  const [questionFeedback, setQuestionFeedback] = useState<
    Record<string, DetailedQuestionFeedback>
  >({});
  const [isQuestionFeedbackLoading, setIsQuestionFeedbackLoading] = useState(false);
  const [questionFeedbackError, setQuestionFeedbackError] = useState<string | null>(null);
  const finalizingRef = useRef(false);
  const finalizeRef = useRef<(() => Promise<void>) | null>(null);
  const [finalResult, setFinalResult] = useState<{
    score?: number;
    passed?: boolean;
    masteryUnlocked?: boolean;
    nextTopicUnlocked?: boolean;
    nextTopicId?: string;
    gateDecision?: GateDecision;
    readinessPending?: boolean;
    recommendations?: QuizPerformanceRecommendations;
    recommendationsAvailable?: boolean;
    resultsAvailable?: boolean;
  } | null>(null);

  const loadQuestionFeedback = React.useCallback(
    async (reviewQuestions: Question[], answers: Record<string, string[]>) => {
      if (!userId || !lessonId) {
        setQuestionFeedbackError('Answer explanations are unavailable for this account.');
        return;
      }

      setIsQuestionFeedbackLoading(true);
      setQuestionFeedbackError(null);
      const results = await Promise.allSettled(
        reviewQuestions.map(question =>
          quizService.getDetailedQuestionFeedback(
            userId,
            String(lessonId),
            question.id,
            answers[question.id] ?? [],
            question.type,
          ),
        ),
      );
      const feedback: Record<string, DetailedQuestionFeedback> = {};
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          feedback[reviewQuestions[index].id] = result.value;
        }
      });
      setQuestionFeedback(feedback);
      if (results.some(result => result.status === 'rejected')) {
        setQuestionFeedbackError('Some answer explanations could not be loaded.');
      }
      setIsQuestionFeedbackLoading(false);
    },
    [lessonId, userId],
  );

  const fetchQuestions = React.useCallback(async () => {
    if (!lessonId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setLoadError(null);
    setQuizComplete(false);
    setFinalResult(null);
    setQuestionFeedback({});
    setQuestionFeedbackError(null);
    try {
      let data: Question[];
      let startedAttempt: Awaited<ReturnType<typeof quizService.startQuizAttempt>> | null = null;
      if (scope === 'topic') {
        const storageKey = `quiz-attempt:${scope}:${lessonId}`;
        let currentAttemptId = window.localStorage.getItem(storageKey);
        if (!currentAttemptId) {
          currentAttemptId = uuidv4();
          window.localStorage.setItem(storageKey, currentAttemptId);
        }
        startedAttempt = await quizService.startTopicQuizAttempt(
          lessonId,
          currentAttemptId,
        );
        if (startedAttempt.completedAt) {
          currentAttemptId = uuidv4();
          window.localStorage.setItem(storageKey, currentAttemptId);
          startedAttempt = await quizService.startTopicQuizAttempt(
            lessonId,
            currentAttemptId,
          );
        }
        data =
          startedAttempt.questions ??
          ((await quizService.getQuestionsForLesson(lessonId, scope)) as Question[]);
        setAttemptId(currentAttemptId);
        setExpiresAt(null);
        setResultsAvailable(startedAttempt.showResults);
      } else {
        const storageKey = `quiz-attempt:${scope}:${lessonId}`;
        let currentAttemptId = window.localStorage.getItem(storageKey);
        if (!currentAttemptId) {
          currentAttemptId = uuidv4();
          window.localStorage.setItem(storageKey, currentAttemptId);
        }
        startedAttempt = await quizService.startQuizAttempt(lessonId, currentAttemptId);
        data =
          startedAttempt.questions ??
          ((await quizService.getQuestionsForLesson(lessonId, scope)) as Question[]);
        setAttemptId(currentAttemptId);
        setExpiresAt(
          startedAttempt.expiresAt ? new Date(startedAttempt.expiresAt).getTime() : null
        );
        setResultsAvailable(startedAttempt.showResults);
      }

      if (!startedAttempt) {
        throw new Error('The quiz attempt could not be started.');
      }
      const orderedQuestions = startedAttempt.questionIds.map(questionId =>
        data.find(question => question.id === questionId)
      );
      if (orderedQuestions.some(question => !question)) {
        throw new Error('The active quiz question set has changed. Restart the quiz.');
      }
      const questionsToShow = orderedQuestions as Question[];
      setQuestions(questionsToShow);

      const savedAnswers: Record<string, string[]> = {};
      const draftKey =
        scope === 'topic'
          ? `topic-quiz-draft:${lessonId}`
          : `quiz-attempt-draft:${startedAttempt.attemptId}`;
      const availableOptions = new Map(
        questionsToShow.map(question => [
          question.id,
          new Set(question.options.map(option => option.id)),
        ])
      );
      const storedDraft = window.localStorage.getItem(draftKey);
      let legacyTopicDraft: Record<string, unknown> | null = null;
      if (storedDraft) {
        try {
          const draft = JSON.parse(storedDraft) as Record<string, unknown>;
          if (
            scope === 'topic' &&
            draft &&
            typeof draft === 'object' &&
            !Array.isArray(draft)
          ) {
            legacyTopicDraft = draft;
          }
          for (const [questionId, selected] of Object.entries(draft)) {
            const options = availableOptions.get(questionId);
            if (!options || !Array.isArray(selected)) continue;
            const validSelections = selected.filter(
              (optionId): optionId is string =>
                typeof optionId === 'string' && options.has(optionId)
            );
            if (scope !== 'topic' && validSelections.length) {
              savedAnswers[questionId] = validSelections;
            }
          }
        } catch (error) {
          console.warn('Ignoring an invalid saved quiz attempt draft:', error);
          window.localStorage.removeItem(draftKey);
        }
      }
      for (const answer of startedAttempt.answers) {
        if (typeof answer.selectedOption === 'string') {
          savedAnswers[answer.questionId] = [answer.selectedOption];
        } else if (Array.isArray(answer.selectedOption)) {
          savedAnswers[answer.questionId] = answer.selectedOption.filter(
            (optionId): optionId is string => typeof optionId === 'string'
          );
        }
      }
      if (scope === 'topic' && legacyTopicDraft) {
        for (const question of questionsToShow) {
          if (savedAnswers[question.id]?.length) continue;
          const selected = legacyTopicDraft[question.id];
          const options = availableOptions.get(question.id);
          if (!options || !Array.isArray(selected)) continue;
          const validSelections = selected.filter(
            (optionId): optionId is string =>
              typeof optionId === 'string' && options.has(optionId)
          );
          if (!validSelections.length) continue;
          await quizService.submitAnswer(
            startedAttempt.attemptId,
            question.id,
            question.type === 'multiple_select'
              ? validSelections
              : validSelections[0],
          );
          savedAnswers[question.id] = validSelections;
        }
      }
      setSubmittedAnswers(savedAnswers);
      const firstUnansweredIndex = questionsToShow.findIndex(
        question => !savedAnswers[question.id]?.length
      );
      const questionIndex =
        firstUnansweredIndex < 0 ? Math.max(0, questionsToShow.length - 1) : firstUnansweredIndex;
      const currentQuestion = questionsToShow[questionIndex];
      setCurrentQuestionIndex(questionIndex);
      setSelectedOptions(savedAnswers[currentQuestion.id] ?? []);
      setIsSubmitted(Boolean(savedAnswers[currentQuestion.id]?.length));
      if (startedAttempt.completedAt && scope !== 'topic') {
          const completedResult = await quizService.submitUnitQuiz(
            lessonId,
            startedAttempt.attemptId,
            questionsToShow.map(question => ({
              questionId: question.id,
              selectedOption:
                question.type === 'multiple_select'
                  ? (savedAnswers[question.id] ?? [])
                  : (savedAnswers[question.id]?.[0] ?? null),
            }))
          );
          setFinalResult({
            score: completedResult.percentage ?? 0,
            passed: completedResult.isPassed ?? false,
            masteryUnlocked: false,
            nextTopicUnlocked: false,
            recommendations: completedResult.recommendations,
            resultsAvailable: completedResult.resultsAvailable !== false,
          });
          setResultsAvailable(completedResult.resultsAvailable !== false);
          setQuizComplete(true);
          if (completedResult.resultsAvailable !== false) {
            void loadQuestionFeedback(questionsToShow, savedAnswers);
          }
          window.localStorage.removeItem(`quiz-attempt:${scope}:${lessonId}`);
          window.localStorage.removeItem(`quiz-attempt-draft:${startedAttempt.attemptId}`);
      }
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Failed to load quiz questions.');
    } finally {
      setIsLoading(false);
    }
  }, [lessonId, loadQuestionFeedback, scope]);

  useEffect(() => {
    void fetchQuestions();
  }, [fetchQuestions]);

  const handleOptionSelect = (optionId: string) => {
    if (isSubmitted || timeRemainingSeconds === 0) return;
    const currentQuestion = questions[currentQuestionIndex];
    if (!currentQuestion) return;
    const nextOptions =
      currentQuestion.type === 'multiple_select'
        ? selectedOptions.includes(optionId)
          ? selectedOptions.filter(id => id !== optionId)
          : [...selectedOptions, optionId]
        : [optionId];
    setSelectedOptions(nextOptions);
    if (attemptId) {
      try {
        window.localStorage.setItem(
          `quiz-attempt-draft:${attemptId}`,
          JSON.stringify({
            ...submittedAnswers,
            [currentQuestion.id]: nextOptions,
          })
        );
      } catch (error) {
        console.warn('The local quiz draft could not be saved:', error);
      }
    }
  };

  const handleSubmit = async () => {
    if (!selectedOptions.length || isSubmitted || isSubmitting) return;

    if (!questions.length) {
      setSubmissionError('No quiz questions are available yet.');
      return;
    }

    const currentQuestion = questions[currentQuestionIndex];
    const answer =
      currentQuestion.type === 'multiple_select' ? selectedOptions : selectedOptions[0];
    const selectedTexts = selectedOptions
      .map(optionId => currentQuestion.options.find(option => option.id === optionId)?.text)
      .filter((text): text is string => Boolean(text));
    setIsSubmitting(true);
    setSubmissionError(null);

    try {
      if (!attemptId) {
        throw new Error('The quiz attempt has not started yet.');
      }
      await quizService.submitAnswer(attemptId, currentQuestion.id, answer);
      setIsSubmitted(true);
      setSubmittedAnswers(previous => ({
        ...previous,
        [currentQuestion.id]: selectedOptions,
      }));
      if (scope === 'topic') {
        window.localStorage.setItem(
          `topic-quiz-draft:${lessonId}`,
          JSON.stringify({
            ...submittedAnswers,
            [currentQuestion.id]: selectedOptions,
          })
        );
      }

      trackAction(
        XAPI_VERBS.ATTEMPTED,
        {
          id: `${URLS.BASE}/quizzes/${lessonId || 'general'}/question/${currentQuestion.id}`,
          definition: {
            name: { 'en-US': currentQuestion.text },
            type: 'http://adlnet.gov/expapi/activities/question',
          },
        },
        {
          response: selectedTexts.join(', '),
        }
      );
    } catch (error) {
      setSubmissionError(error instanceof Error ? error.message : 'Answer could not be submitted.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const finalizeQuiz = async () => {
    if (finalizingRef.current || isSubmitting || quizComplete) return;
    finalizingRef.current = true;
    setIsSubmitting(true);
    setSubmissionError(null);
    try {
      let result: {
        score?: number;
        passed?: boolean;
        masteryUnlocked?: boolean;
        nextTopicUnlocked?: boolean;
        nextTopicId?: string;
        gateDecision?: GateDecision;
        readinessPending?: boolean;
        recommendations?: QuizPerformanceRecommendations;
        recommendationsAvailable?: boolean;
        resultsAvailable?: boolean;
      } = {
        score: 0,
        passed: false,
        masteryUnlocked: false,
        nextTopicUnlocked: false,
      };

      if (scope === 'topic' && lessonId && result.resultsAvailable !== false) {
        if (!attemptId) {
          throw new Error('The quiz attempt has not started yet.');
        }
        const topicResult = await quizService.submitTopicQuiz(
          lessonId,
          questions.map(question => ({
            questionId: question.id,
            selectedAnswers: submittedAnswers[question.id] || [],
          })),
          attemptId
        );
        result = topicResult;
      } else if ((scope === 'unit' || scope === 'assessment') && lessonId) {
        if (!attemptId) {
          throw new Error('The quiz attempt has not started yet.');
        }
        const unitResult = await quizService.submitUnitQuiz(
          lessonId,
          attemptId,
          questions.map(question => ({
            questionId: question.id,
            selectedOption:
              question.type === 'multiple_select'
                ? (submittedAnswers[question.id] ?? [])
                : (submittedAnswers[question.id]?.[0] ?? null),
          }))
        );
        result = {
          ...result,
          score: unitResult.percentage ?? 0,
          passed: unitResult.isPassed ?? false,
          recommendations: unitResult.recommendations,
          recommendationsAvailable: unitResult.recommendationsAvailable,
          resultsAvailable: unitResult.resultsAvailable !== false,
        };
      }

      setResultsAvailable(result.resultsAvailable !== false);
      setFinalResult(result);
      setQuizComplete(true);
      if (result.resultsAvailable !== false) {
        void loadQuestionFeedback(questions, submittedAnswers);
      }
      try {
        window.localStorage.removeItem(`quiz-attempt:${scope}:${lessonId}`);
        if (attemptId) {
          window.localStorage.removeItem(`quiz-attempt-draft:${attemptId}`);
        }
        if (scope === 'topic' && lessonId) {
          window.localStorage.removeItem(`topic-quiz-draft:${lessonId}`);
        }
      } catch (error) {
        console.warn('Quiz was submitted, but its local draft could not be cleared:', error);
      }
      if (result.resultsAvailable !== false && scope !== 'assessment' && lessonId != null) {
        recordCourseActivity(
          'quiz',
          courseId ?? activeSession?.courseId,
          scope === 'topic' ? String(lessonId) : (activeSession?.topicId ?? String(lessonId)),
          result.score
        );
      }
      if (scope === 'topic' && lessonId) {
        try {
          if (result.resultsAvailable !== false && result.masteryUnlocked) {
            onTopicCompleted?.();
          }
        } catch (error) {
          console.warn('Quiz passed, but local progress state could not be refreshed:', error);
        }

        try {
          await onTopicProgressUpdated?.();
        } catch (error) {
          console.warn('Quiz passed, but topic data could not be refreshed:', error);
        }
      }
      trackAction(
        XAPI_VERBS.COMPLETED,
        {
          id: `${URLS.BASE}/quizzes/${lessonId || 'general'}`,
          definition: {
            name: {
              'en-US': `${scope === 'topic' ? 'Topic Mastery Quiz' : scope === 'assessment' ? 'Learning Path Quiz' : 'Unit Quiz'}: ${lessonTitle || (scope === 'topic' ? 'Topic' : scope === 'assessment' ? 'Quiz' : 'Unit')}`,
            },
            type: 'http://adlnet.gov/expapi/activities/assessment',
          },
        },
        result.resultsAvailable === false || result.score === undefined
          ? { completion: true }
          : {
              score: {
                scaled: result.score / 100,
                raw: result.score,
                min: 0,
                max: 100,
              },
              success: result.passed ?? false,
            }
      );
    } catch (error) {
      setSubmissionError(error instanceof Error ? error.message : 'Could not save quiz results.');
    } finally {
      finalizingRef.current = false;
      setIsSubmitting(false);
    }
  };
  finalizeRef.current = finalizeQuiz;

  const handleNext = async () => {
    if (!questions.length) {
      setSubmissionError('No quiz questions are available yet.');
      return;
    }

    if (timeRemainingSeconds !== 0 && currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      const nextQuestion = questions[currentQuestionIndex + 1];
      const savedOptions = submittedAnswers[nextQuestion.id] ?? [];
      setSelectedOptions(savedOptions);
      setIsSubmitted(savedOptions.length > 0);
      setSubmissionError(null);
      return;
    }

    await finalizeQuiz();
  };

  useEffect(() => {
    if (!expiresAt) {
      setTimeRemainingSeconds(null);
      return;
    }
    const updateRemaining = () => {
      setTimeRemainingSeconds(Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000)));
    };
    updateRemaining();
    const intervalId = window.setInterval(updateRemaining, 1000);
    return () => window.clearInterval(intervalId);
  }, [expiresAt]);

  useEffect(() => {
    if (timeRemainingSeconds === 0 && !quizComplete && !isLoading && !isSubmitting) {
      void finalizeRef.current?.();
    }
  }, [timeRemainingSeconds, quizComplete, isLoading, isSubmitting]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-card/80 dark:bg-card/50 rounded-xl border border-border dark:border-border/50">
        <RefreshCw className="w-8 h-8 text-blue-500 animate-spin mb-4" />
        <p className="text-muted-foreground">Loading quiz questions...</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div role="alert" className="p-6 rounded-xl border border-red-200 bg-red-50 text-red-700">
        <p className="font-medium mb-3">We couldn’t load this quiz.</p>
        <p className="mb-4">{loadError}</p>
        <button
          type="button"
          onClick={() => {
            setLoadError(null);
            void fetchQuestions();
          }}
          className="inline-flex items-center gap-2 rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-500"
        >
          <RefreshCw className="h-4 w-4" />
          Retry
        </button>
      </div>
    );
  }

  if (!questions.length) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        No quiz questions are available for this {scope} yet.
      </div>
    );
  }

  if (quizComplete) {
    const showResults = resultsAvailable && finalResult?.resultsAvailable !== false;
    const scorePercentage = finalResult?.score ?? 0;
    const passed =
      finalResult?.passed ??
      (showResults && scorePercentage >= (scope === 'topic' ? TOPIC_MASTERY_PASSING_SCORE : 80));
    return (
      <div className="bg-card/80 dark:bg-card/50 backdrop-blur-sm rounded-xl p-8 shadow-sm border border-border dark:border-border/50 text-center animate-in fade-in zoom-in duration-500 motion-reduce:animate-none">
        <div
          className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-6 ${!showResults ? 'bg-muted' : passed ? 'bg-green-100 dark:bg-green-500/20' : 'bg-red-100 dark:bg-red-500/20'}`}
        >
          {!showResults ? (
            <Clock3 className="w-10 h-10 text-muted-foreground" />
          ) : passed ? (
            <CheckCircle className="w-10 h-10 text-green-600" />
          ) : (
            <AlertCircle className="w-10 h-10 text-red-600" />
          )}
        </div>
        <h3 className="text-2xl font-bold text-foreground dark:text-foreground">Quiz Complete!</h3>
        {showResults ? (
          <p className="text-muted-foreground mt-2 mb-6 text-lg">
            Your score:{' '}
            <span className="font-bold text-foreground dark:text-foreground">
              {scorePercentage}%
            </span>
          </p>
        ) : (
          <p className="text-muted-foreground mt-2 mb-6">
            Your submission was recorded. Results are not available yet.
          </p>
        )}

        {showResults && passed ? (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800/30 p-4 rounded-lg mb-8">
            <p className="text-green-800 dark:text-green-300 font-medium">
              {scope === 'topic'
                ? "Congratulations! You've mastered this topic."
                : scope === 'assessment'
                  ? 'You passed the learning-path quiz.'
                  : 'You passed the unit quiz.'}
            </p>
          </div>
        ) : showResults ? (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/30 p-4 rounded-lg mb-8">
            <p className="text-red-800 dark:text-red-300 font-medium">
              {scope === 'topic'
                ? `You did not reach the ${TOPIC_MASTERY_PASSING_SCORE}% passing score. Review the material and try again.`
                : 'You did not reach the required passing score. Review the material and try again.'}
            </p>
          </div>
        ) : null}

        {showResults && scope === 'topic' && finalResult?.readinessPending && (
          <p role="status" className="mb-4 text-sm text-muted-foreground">
            Your quiz result is saved. The separate readiness estimate is still updating; your score remains authoritative.
          </p>
        )}

        {showResults && scope === 'topic' && finalResult?.gateDecision && (
          <MasteryReadinessPanel
            decision={finalResult.gateDecision}
            quizPassed={finalResult.passed}
          />
        )}

        {showResults && finalResult?.nextTopicUnlocked && (
          <p className="mb-6 text-sm font-medium text-green-700 dark:text-green-300">
            The next topic is now unlocked.
          </p>
        )}

        {showResults && finalResult?.recommendationsAvailable === false && (
          <p role="status" className="mb-6 text-sm text-muted-foreground">
            Your quiz was submitted, but learning recommendations are temporarily unavailable.
          </p>
        )}

        {showResults &&
          finalResult?.recommendations?.topics.map(topic => (
            <section
              key={topic.topicId}
              className="mb-6 rounded-xl border border-border bg-background/70 p-4 text-left"
            >
              <h4 className="font-semibold">Learning diagnosis: {topic.topicName}</h4>
              <p className="mt-2 text-sm text-muted-foreground">
                {topic.diagnosis === 'prerequisite_gap'
                  ? 'Prior quiz evidence suggests a gap in mapped prerequisite knowledge.'
                  : topic.diagnosis === 'target_content_gap'
                    ? 'Mapped prerequisites look sufficiently strong; the current difficulty is more likely specific to this topic.'
                    : 'There is not enough prerequisite evidence to tell whether the difficulty is foundational or specific to this topic.'}{' '}
                Current attempt: {Math.round(topic.accuracy * 100)}%; across{' '}
                {topic.targetEvidence.sampleSize} completed attempts:{' '}
                {topic.targetEvidence.accuracy === null
                  ? 'not enough data'
                  : `${Math.round(topic.targetEvidence.accuracy * 100)}% accuracy`}
                ; confidence: {topic.confidence}.
              </p>
              {topic.prerequisiteEvidence.length > 0 && (
                <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                  {topic.prerequisiteEvidence.map(evidence => (
                    <li key={evidence.unitId}>
                      {evidence.unitName}:{' '}
                      {evidence.accuracy === null
                        ? 'no prior answers'
                        : `${Math.round(evidence.accuracy * 100)}% average attempt accuracy`}{' '}
                      ({evidence.sampleSize} completed attempts)
                    </li>
                  ))}
                </ul>
              )}
              {topic.sequence?.length ? (
                <ol className="mt-4 space-y-4">
                  {topic.sequence.map((step, index) => (
                    <li key={`${topic.topicId}:step:${index}`}>
                      <h5 className="text-sm font-semibold">
                        {index + 1}. {step.title}
                      </h5>
                      <p className="text-xs text-muted-foreground">{step.rationale}</p>
                      {step.resources.length > 0 && (
                        <ul className="mt-2 space-y-2 pl-3">
                          {step.resources.map(resource => (
                            <li key={`${resource.kind}:${resource.id}`}>
                              <Link
                                href={resource.href}
                                className="font-medium text-blue-700 underline dark:text-blue-300"
                              >
                                {resource.title}
                              </Link>
                              <p className="text-xs text-muted-foreground">{resource.reason}</p>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                </ol>
              ) : topic.recommendations.length > 0 ? (
                <ul className="mt-3 space-y-2">
                  {topic.recommendations.map(recommendation => (
                    <li key={`${recommendation.kind}:${recommendation.id}`}>
                      <Link
                        href={recommendation.href}
                        className="font-medium text-blue-700 underline dark:text-blue-300"
                      >
                        {recommendation.title}
                      </Link>
                      <p className="text-xs text-muted-foreground">{recommendation.reason}</p>
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}

        {showResults && (
          <QuestionFeedbackReview
            userId={userId}
            items={questions.flatMap(question => {
              const feedback = questionFeedback[question.id];
              return feedback
                ? [{
                    questionId: question.id,
                    question: question.text,
                    options: question.options,
                    selectedOptionIds: submittedAnswers[question.id] ?? [],
                    feedback,
                  }]
                : [];
            })}
            isLoading={isQuestionFeedbackLoading}
            error={questionFeedbackError}
            onRetry={() => void loadQuestionFeedback(questions, submittedAnswers)}
          />
        )}

        <button
          onClick={() => {
            if (finalResult?.nextTopicId && onNextTopic) {
              onNextTopic(finalResult.nextTopicId);
            } else {
              (onReturn ?? (() => window.location.reload()))();
            }
          }}
          className="min-h-12 px-8 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20 active:scale-[0.99] motion-reduce:transition-none"
        >
          {finalResult?.nextTopicId && onNextTopic
            ? 'Next Topic'
            : `Return to ${scope === 'topic' ? 'Topic' : scope === 'assessment' ? 'Quiz' : 'Unit'}`}
        </button>
      </div>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];

  return (
    <div
      className={`${
        immersive
          ? 'mt-0 rounded-2xl border border-border bg-card/80 p-4 shadow-sm backdrop-blur-sm dark:border-border dark:bg-card/70 sm:p-6'
          : 'mt-6 rounded-xl border border-border bg-card/80 p-6 shadow-sm backdrop-blur-sm dark:border-border/50 dark:bg-card/50'
      } animate-in slide-in-from-bottom-4 duration-500 motion-reduce:animate-none`}
    >
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-bold text-foreground dark:text-foreground">
          {scope === 'topic'
            ? 'Topic Mastery Quiz'
            : scope === 'assessment'
              ? 'Learning Path Quiz'
              : 'Unit Quiz'}
        </h3>
        <span className="text-sm font-medium text-muted-foreground bg-muted dark:bg-secondary px-3 py-1 rounded-full">
          Question {currentQuestionIndex + 1} of {questions.length}
        </span>
        {timeRemainingSeconds !== null && (
          <span
            role="timer"
            aria-live="off"
            className={`text-sm font-semibold tabular-nums ${
              timeRemainingSeconds === 0 ? 'text-red-600' : 'text-muted-foreground'
            }`}
          >
            {timeRemainingSeconds === 0
              ? 'Time expired'
              : `${Math.floor(timeRemainingSeconds / 60)
                  .toString()
                  .padStart(2, '0')}:${(timeRemainingSeconds % 60).toString().padStart(2, '0')}`}
          </span>
        )}
      </div>

      <div
        className="mb-5 h-1.5 overflow-hidden rounded-full bg-muted dark:bg-secondary"
        role="progressbar"
        aria-label="Quiz progress"
        aria-valuemin={0}
        aria-valuemax={questions.length}
        aria-valuenow={currentQuestionIndex + 1}
      >
        <div
          className="h-full rounded-full bg-blue-600 transition-[width] duration-300 motion-reduce:transition-none"
          style={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }}
        />
      </div>

      <div className="space-y-6">
        <div className="p-6 bg-background/50 dark:bg-card/30 border border-border dark:border-border/50 rounded-xl">
          <h4 className="text-lg font-semibold text-foreground dark:text-foreground mb-6 leading-snug">
            {currentQuestion.text}
          </h4>
          <div className="space-y-3">
            {currentQuestion.options.map(option => {
              const isSelected = selectedOptions.includes(option.id);
              let borderClass = 'border-border dark:border-border/50';
              let bgClass = 'bg-card dark:bg-card';
              let textClass = 'text-muted-foreground dark:text-muted-foreground';

              if (isSelected) {
                borderClass = 'border-blue-500 ring-1 ring-blue-500/20';
                bgClass = 'bg-blue-50/30 dark:bg-blue-500/5';
                textClass = 'text-blue-700 dark:text-blue-400';
              }

              return (
                <button
                  key={option.id}
                  onClick={() => handleOptionSelect(option.id)}
                  disabled={isSubmitted || timeRemainingSeconds === 0}
                  aria-pressed={isSelected}
                  className={`w-full min-h-14 flex items-center justify-between p-4 rounded-xl border ${borderClass} ${bgClass} transition-all duration-200 text-left group hover:shadow-md active:scale-[0.99] disabled:cursor-default motion-reduce:transition-none`}
                >
                  <span className={`text-sm font-medium ${textClass}`}>{option.text}</span>
                  {isSubmitted && isSelected && <CheckCircle className="w-5 h-5 text-blue-500" />}
                </button>
              );
            })}
          </div>

        </div>

        {submissionError && (
          <p role="alert" className="text-sm text-red-600">
            {submissionError}
          </p>
        )}

        <div
          className={`flex gap-4 ${immersive ? 'sticky bottom-0 -mx-4 mt-3 bg-gradient-to-t from-white via-white/95 to-transparent px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-4 dark:from-slate-900 dark:via-slate-900/95 sm:-mx-6 sm:px-6' : ''}`}
        >
          {!isSubmitted ? (
            <button
              onClick={handleSubmit}
              disabled={!selectedOptions.length || isSubmitting || timeRemainingSeconds === 0}
              className="min-h-14 flex-1 bg-blue-600 text-white font-bold py-4 rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-[0.99] motion-reduce:transition-none"
            >
              <Send className="w-4 h-4" />
              {isSubmitting ? 'Saving answer...' : 'Save Answer'}
            </button>
          ) : (
            <button
              onClick={handleNext}
              disabled={isSubmitting}
              className="min-h-14 flex-1 bg-slate-900 dark:bg-blue-600 text-white font-bold py-4 rounded-xl hover:opacity-90 transition-all shadow-lg flex items-center justify-center gap-2 active:scale-[0.99] motion-reduce:transition-none"
            >
              {isSubmitting
                ? 'Submitting quiz...'
                : currentQuestionIndex < questions.length - 1
                  ? 'Next Question'
                  : 'Submit Quiz'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
