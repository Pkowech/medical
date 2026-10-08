'use client';

import React, { useState, useEffect } from 'react';
import { quizService } from '@/features/assessment/services/quiz';
import { useXapi } from '@/lib/xapi/useXapi';
import { URLS } from '@/lib/urls';
import { CheckCircle, XCircle, AlertCircle, RefreshCw, Send } from 'lucide-react';
import { useCourseStudySession } from '@/features/learning-management/study/components/CourseStudySessionProvider';

interface Question {
  id: string;
  text: string;
  type: string;
  options: { id: string; text: string }[];
  explanation?: string;
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
  const [questions, setQuestions] = useState<Question[]>([]);
  const [submittedAnswers, setSubmittedAnswers] = useState<Record<string, string[]>>({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [quizComplete, setQuizComplete] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [answerCorrect, setAnswerCorrect] = useState<boolean | null>(null);
  const [finalResult, setFinalResult] = useState<{
    score: number;
    passed: boolean;
    masteryUnlocked?: boolean;
    nextTopicUnlocked?: boolean;
    nextTopicId?: string;
  } | null>(null);

  useEffect(() => {
    const fetchQuestions = async () => {
      if (!lessonId) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      try {
        const data = await quizService.getQuestionsForLesson(lessonId, scope);
        setQuestions(data as Question[]);
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : 'Failed to load quiz questions.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchQuestions();
  }, [lessonId, scope]);

  const handleOptionSelect = (optionId: string) => {
    if (isSubmitted) return;
    setSelectedOption(optionId);
  };

  const handleSubmit = async () => {
    if (!selectedOption || isSubmitted || isSubmitting) return;

    const currentQuestion = questions[currentQuestionIndex];
    const selected = currentQuestion.options.find((option) => option.id === selectedOption);
    setIsSubmitting(true);
    setSubmissionError(null);

    try {
      const result = await quizService.submitAnswer(currentQuestion.id, selectedOption);
      setAnswerCorrect(result.correct);
      setIsSubmitted(true);
      setSubmittedAnswers(previous => ({
        ...previous,
        [currentQuestion.id]: [selectedOption],
      }));
      if (result.correct) setScore((previous) => previous + 1);

      trackAction(XAPI_VERBS.ATTEMPTED, {
        id: `${URLS.BASE}/quizzes/${lessonId || 'general'}/question/${currentQuestion.id}`,
        definition: {
          name: { 'en-US': currentQuestion.text },
          type: 'http://adlnet.gov/expapi/activities/question',
        },
      }, {
        success: result.correct,
        response: selected?.text,
      });
    } catch (error) {
      setSubmissionError(error instanceof Error ? error.message : 'Answer could not be submitted.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNext = async () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setSelectedOption(null);
      setIsSubmitted(false);
      setAnswerCorrect(null);
      setSubmissionError(null);
      return;
    }

    setIsSubmitting(true);
    setSubmissionError(null);
    try {
      let result: {
        score: number;
        passed: boolean;
        masteryUnlocked: boolean;
        nextTopicUnlocked: boolean;
        nextTopicId?: string;
      } = {
        score: Math.round((score / questions.length) * 100),
        passed: score / questions.length >= 0.7,
        masteryUnlocked: false,
        nextTopicUnlocked: false,
      };

      if (scope === 'topic' && lessonId) {
        const topicResult = await quizService.submitTopicQuiz(
          lessonId,
          questions.map(question => ({
            questionId: question.id,
            selectedAnswers: submittedAnswers[question.id] || [],
          })),
        );
        result = topicResult;
      } else if ((scope === 'unit' || scope === 'assessment') && lessonId) {
        const unitResult = await quizService.submitUnitQuiz(
          lessonId,
          questions.map(question => ({
            questionId: question.id,
            selectedOption: submittedAnswers[question.id]?.[0] || '',
          })),
        );
        result = {
          ...result,
          score: unitResult.percentage,
          passed: unitResult.isPassed,
        };
      }

      setFinalResult(result);
      setQuizComplete(true);
      if (scope !== 'assessment' && lessonId != null && activeSession) {
        recordCourseActivity(
          'quiz',
          courseId ?? activeSession.courseId,
          scope === 'topic' ? String(lessonId) : activeSession.topicId,
          result.score,
        );
      }
      if (scope === 'topic' && lessonId) {
        try {
          if (result.masteryUnlocked) onTopicCompleted?.();
        } catch (error) {
          console.warn('Quiz passed, but local progress state could not be refreshed:', error);
        }

        try {
          await onTopicProgressUpdated?.();
        } catch (error) {
          console.warn('Quiz passed, but topic data could not be refreshed:', error);
        }
      }
      trackAction(XAPI_VERBS.COMPLETED, {
        id: `${URLS.BASE}/quizzes/${lessonId || 'general'}`,
          definition: {
          name: { 'en-US': `${scope === 'topic' ? 'Topic Mastery Quiz' : scope === 'assessment' ? 'Assessment' : 'Unit Quiz'}: ${lessonTitle || (scope === 'topic' ? 'Topic' : scope === 'assessment' ? 'Assessment' : 'Unit')}` },
          type: 'http://adlnet.gov/expapi/activities/assessment',
        }
      }, {
        score: {
          scaled: result.score / 100,
          raw: result.score,
          min: 0,
          max: 100,
        },
        success: result.passed,
      });
    } catch (error) {
      setSubmissionError(error instanceof Error ? error.message : 'Could not save quiz results.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white/80 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/50">
        <RefreshCw className="w-8 h-8 text-blue-500 animate-spin mb-4" />
        <p className="text-slate-500">Loading quiz questions...</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div role="alert" className="p-6 text-center text-red-600">
        {loadError}
      </div>
    );
  }

  if (!questions.length) {
    return (
      <div className="p-6 text-center text-slate-500">
        No quiz questions are available for this {scope} yet.
      </div>
    );
  }

  if (quizComplete) {
    const scorePercentage = finalResult?.score ?? Math.round((score / questions.length) * 100);
    const passed = finalResult?.passed ?? scorePercentage >= (scope === 'topic' ? 70 : 80);
    return (
      <div className="bg-white/80 dark:bg-slate-800/50 backdrop-blur-sm rounded-xl p-8 shadow-sm border border-gray-200 dark:border-slate-700/50 text-center animate-in fade-in zoom-in duration-500 motion-reduce:animate-none">
        <div className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-6 ${passed ? 'bg-green-100 dark:bg-green-500/20' : 'bg-red-100 dark:bg-red-500/20'}`}>
          {passed ? <CheckCircle className="w-10 h-10 text-green-600" /> : <AlertCircle className="w-10 h-10 text-red-600" />}
        </div>
        <h3 className="text-2xl font-bold text-slate-900 dark:text-white">Quiz Complete!</h3>
        <p className="text-slate-500 mt-2 mb-6 text-lg">
          Your score: <span className="font-bold text-slate-900 dark:text-white">{scorePercentage}%</span>
        </p>
        
        {passed ? (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800/30 p-4 rounded-lg mb-8">
            <p className="text-green-800 dark:text-green-300 font-medium">
              {scope === 'topic'
                ? "Congratulations! You've mastered this topic."
                : scope === 'assessment'
                  ? 'You passed the assessment.'
                  : 'You passed the unit quiz.'}
            </p>
          </div>
        ) : (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/30 p-4 rounded-lg mb-8">
            <p className="text-red-800 dark:text-red-300 font-medium">
              You did not reach the 70% passing score. Review the material and try again.
            </p>
          </div>
        )}

        {finalResult?.nextTopicUnlocked && (
          <p className="mb-6 text-sm font-medium text-green-700 dark:text-green-300">
            The next topic is now unlocked.
          </p>
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
            : `Return to ${scope === 'topic' ? 'Topic' : scope === 'assessment' ? 'Assessment' : 'Unit'}`}
        </button>
      </div>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];

  return (
    <div className={`${
      immersive
        ? 'mt-0 rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/70 sm:p-6'
        : 'mt-6 rounded-xl border border-gray-200 bg-white/80 p-6 shadow-sm backdrop-blur-sm dark:border-slate-700/50 dark:bg-slate-800/50'
    } animate-in slide-in-from-bottom-4 duration-500 motion-reduce:animate-none`}>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">
          {scope === 'topic'
            ? 'Topic Mastery Quiz'
            : scope === 'assessment'
              ? 'Assessment'
              : 'Unit Quiz'}
        </h3>
        <span className="text-sm font-medium text-slate-500 bg-slate-100 dark:bg-slate-700 px-3 py-1 rounded-full">
          Question {currentQuestionIndex + 1} of {questions.length}
        </span>
      </div>

      {immersive && (
        <div
          className="mb-5 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700"
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
      )}

      <div className="space-y-6">
        <div className="p-6 bg-slate-50/50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-700/50 rounded-xl">
          <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-6 leading-snug">
            {currentQuestion.text}
          </h4>
          <div className="space-y-3">
            {currentQuestion.options.map((option) => {
              const isSelected = selectedOption === option.id;
              const isCorrect = isSubmitted && isSelected && answerCorrect === true;
              const isIncorrect = isSubmitted && isSelected && answerCorrect === false;
              let borderClass = 'border-gray-100 dark:border-slate-700/50';
              let bgClass = 'bg-white dark:bg-slate-800';
              let textClass = 'text-gray-700 dark:text-slate-300';

              if (isSubmitted) {
                if (isCorrect) {
                  borderClass = 'border-green-500 dark:border-green-500/50 ring-1 ring-green-500/20';
                  bgClass = 'bg-green-50/50 dark:bg-green-500/10';
                  textClass = 'text-green-700 dark:text-green-400';
                } else if (isIncorrect) {
                  borderClass = 'border-red-500 dark:border-red-500/50 ring-1 ring-red-500/20';
                  bgClass = 'bg-red-50/50 dark:bg-red-500/10';
                  textClass = 'text-red-700 dark:text-red-400';
                }
              } else if (isSelected) {
                borderClass = 'border-blue-500 ring-1 ring-blue-500/20';
                bgClass = 'bg-blue-50/30 dark:bg-blue-500/5';
                textClass = 'text-blue-700 dark:text-blue-400';
              }

              return (
                <button
                  key={option.id}
                  onClick={() => handleOptionSelect(option.id)}
                  disabled={isSubmitted}
                  aria-pressed={isSelected}
                  className={`w-full min-h-14 flex items-center justify-between p-4 rounded-xl border ${borderClass} ${bgClass} transition-all duration-200 text-left group hover:shadow-md active:scale-[0.99] disabled:cursor-default motion-reduce:transition-none`}
                >
                  <span className={`text-sm font-medium ${textClass}`}>{option.text}</span>
                  {isSubmitted && isCorrect && <CheckCircle className="w-5 h-5 text-green-500" />}
                  {isIncorrect && <XCircle className="w-5 h-5 text-red-500" />}
                </button>
              );
            })}
          </div>

          {isSubmitted && (
            <div className="mt-6 p-4 bg-blue-50/50 dark:bg-blue-500/5 border border-blue-100 dark:border-blue-800/30 rounded-xl animate-in fade-in slide-in-from-top-2 duration-300">
              <p className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-1">Explanation</p>
              <p className="text-sm text-slate-700 dark:text-slate-300">{currentQuestion.explanation || 'Answer recorded.'}</p>
            </div>
          )}
        </div>

        {submissionError && <p role="alert" className="text-sm text-red-600">{submissionError}</p>}

        <div className={`flex gap-4 ${immersive ? 'sticky bottom-0 -mx-4 mt-3 bg-gradient-to-t from-white via-white/95 to-transparent px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-4 dark:from-slate-900 dark:via-slate-900/95 sm:-mx-6 sm:px-6' : ''}`}>
          {!isSubmitted ? (
            <button
              onClick={handleSubmit}
              disabled={!selectedOption || isSubmitting}
              className="min-h-14 flex-1 bg-blue-600 text-white font-bold py-4 rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-[0.99] motion-reduce:transition-none"
            >
              <Send className="w-4 h-4" />
              {isSubmitting ? 'Checking answer...' : 'Submit Answer'}
            </button>
          ) : (
            <button
              onClick={handleNext}
              disabled={isSubmitting}
              className="min-h-14 flex-1 bg-slate-900 dark:bg-blue-600 text-white font-bold py-4 rounded-xl hover:opacity-90 transition-all shadow-lg flex items-center justify-center gap-2 active:scale-[0.99] motion-reduce:transition-none"
            >
              {isSubmitting
                ? 'Saving results...'
                : currentQuestionIndex < questions.length - 1
                  ? 'Next Question'
                  : 'View Results'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
