'use client';

import React, { useState, useEffect } from 'react';
import { quizService } from '@/features/assessment/services/quiz';
import { useXapi } from '@/lib/xapi/useXapi';
import { CheckCircle, XCircle, AlertCircle, RefreshCw, Send } from 'lucide-react';

interface Question {
  id: string;
  text: string;
  type: string;
  options: { id: string; text: string; isCorrect: boolean }[];
  explanation: string;
  topic: string;
}

interface QuizPanelProps {
  lessonId?: string | number;
  lessonTitle?: string;
}

export const QuizPanel = ({ lessonId, lessonTitle }: QuizPanelProps) => {
  const { trackAction, XAPI_VERBS } = useXapi();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [quizComplete, setQuizComplete] = useState(false);

  useEffect(() => {
    const fetchQuestions = async () => {
      if (!lessonId) return;
      setIsLoading(true);
      try {
        const data = await quizService.getQuestionsForLesson(lessonId);
        setQuestions(data as Question[]);
      } catch (error) {
        console.error('Failed to fetch quiz questions:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchQuestions();
  }, [lessonId]);

  const handleOptionSelect = (optionId: string) => {
    if (isSubmitted) return;
    setSelectedOption(optionId);
  };

  const handleSubmit = () => {
    if (!selectedOption || isSubmitted) return;
    
    setIsSubmitted(true);
    const currentQuestion = questions[currentQuestionIndex];
    const selected = currentQuestion.options.find(o => o.id === selectedOption);
    
    if (selected?.isCorrect) {
      setScore(prev => prev + 1);
    }

    // Track attempt
    trackAction(XAPI_VERBS.ATTEMPTED, {
      id: `https://medtrackhub.com/quizzes/${lessonId || 'general'}/question/${currentQuestion.id}`,
      definition: {
        name: { 'en-US': currentQuestion.text },
        type: 'http://adlnet.gov/expapi/activities/question',
      }
    }, {
      success: selected?.isCorrect,
      response: selected?.text,
    });
  };

  const handleNext = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setSelectedOption(null);
      setIsSubmitted(false);
    } else {
      setQuizComplete(true);
      // Track quiz completion
      trackAction(XAPI_VERBS.COMPLETED, {
        id: `https://medtrackhub.com/quizzes/${lessonId || 'general'}`,
        definition: {
          name: { 'en-US': `Mastery Quiz: ${lessonTitle || 'Topic'}` },
          type: 'http://adlnet.gov/expapi/activities/assessment',
        }
      }, {
        score: {
          scaled: score / questions.length,
          raw: score,
          min: 0,
          max: questions.length
        },
        success: (score / questions.length) >= 0.8
      });
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

  if (quizComplete) {
    const passed = (score / questions.length) >= 0.8;
    return (
      <div className="bg-white/80 dark:bg-slate-800/50 backdrop-blur-sm rounded-xl p-8 shadow-sm border border-gray-200 dark:border-slate-700/50 text-center animate-in fade-in zoom-in duration-500">
        <div className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-6 ${passed ? 'bg-green-100 dark:bg-green-500/20' : 'bg-red-100 dark:bg-red-500/20'}`}>
          {passed ? <CheckCircle className="w-10 h-10 text-green-600" /> : <AlertCircle className="w-10 h-10 text-red-600" />}
        </div>
        <h3 className="text-2xl font-bold text-slate-900 dark:text-white">Quiz Complete!</h3>
        <p className="text-slate-500 mt-2 mb-6 text-lg">
          Your score: <span className="font-bold text-slate-900 dark:text-white">{score}/{questions.length}</span> ({Math.round((score / questions.length) * 100)}%)
        </p>
        
        {passed ? (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800/30 p-4 rounded-lg mb-8">
            <p className="text-green-800 dark:text-green-300 font-medium">Congratulations! You've mastered this topic.</p>
          </div>
        ) : (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/30 p-4 rounded-lg mb-8">
            <p className="text-red-800 dark:text-red-300 font-medium">You didn't reach the 80% mastery threshold. We recommend reviewing the materials and trying again.</p>
          </div>
        )}

        <button
          onClick={() => window.location.reload()}
          className="px-8 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20"
        >
          {passed ? "Continue to Next Lesson" : "Retry Quiz"}
        </button>
      </div>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];

  return (
    <div className="bg-white/80 dark:bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 shadow-sm border border-gray-200 dark:border-slate-700/50 mt-6 animate-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Mastery Assessment</h3>
        <span className="text-sm font-medium text-slate-500 bg-slate-100 dark:bg-slate-700 px-3 py-1 rounded-full">
          Question {currentQuestionIndex + 1} of {questions.length}
        </span>
      </div>

      <div className="space-y-6">
        <div className="p-6 bg-slate-50/50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-700/50 rounded-xl">
          <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-6 leading-snug">
            {currentQuestion.text}
          </h4>
          <div className="space-y-3">
            {currentQuestion.options.map((option) => {
              const isSelected = selectedOption === option.id;
              const isCorrect = option.isCorrect;
              let borderClass = 'border-gray-100 dark:border-slate-700/50';
              let bgClass = 'bg-white dark:bg-slate-800';
              let textClass = 'text-gray-700 dark:text-slate-300';

              if (isSubmitted) {
                if (isCorrect) {
                  borderClass = 'border-green-500 dark:border-green-500/50 ring-1 ring-green-500/20';
                  bgClass = 'bg-green-50/50 dark:bg-green-500/10';
                  textClass = 'text-green-700 dark:text-green-400';
                } else if (isSelected) {
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
                  className={`w-full flex items-center justify-between p-4 rounded-xl border ${borderClass} ${bgClass} transition-all duration-200 text-left group hover:shadow-md disabled:cursor-default`}
                >
                  <span className={`text-sm font-medium ${textClass}`}>{option.text}</span>
                  {isSubmitted && isCorrect && <CheckCircle className="w-5 h-5 text-green-500" />}
                  {isSubmitted && isSelected && !isCorrect && <XCircle className="w-5 h-5 text-red-500" />}
                </button>
              );
            })}
          </div>

          {isSubmitted && (
            <div className="mt-6 p-4 bg-blue-50/50 dark:bg-blue-500/5 border border-blue-100 dark:border-blue-800/30 rounded-xl animate-in fade-in slide-in-from-top-2 duration-300">
              <p className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-1">Explanation</p>
              <p className="text-sm text-slate-700 dark:text-slate-300">{currentQuestion.explanation}</p>
            </div>
          )}
        </div>

        <div className="flex gap-4">
          {!isSubmitted ? (
            <button
              onClick={handleSubmit}
              disabled={!selectedOption}
              className="flex-1 bg-blue-600 text-white font-bold py-4 rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Send className="w-4 h-4" />
              Submit Answer
            </button>
          ) : (
            <button
              onClick={handleNext}
              className="flex-1 bg-slate-900 dark:bg-blue-600 text-white font-bold py-4 rounded-xl hover:opacity-90 transition-all shadow-lg flex items-center justify-center gap-2"
            >
              {currentQuestionIndex < questions.length - 1 ? "Next Question" : "View Results"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
