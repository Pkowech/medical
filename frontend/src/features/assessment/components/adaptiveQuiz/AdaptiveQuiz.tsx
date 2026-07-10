'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Progress } from '@/shared/components/ui/progress';
import { Badge } from '@/shared/components/ui/badge';
import {
  CheckCircle,
  XCircle,
  Brain,
  Target,
  TrendingUp,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { useSession } from 'next-auth/react';

import { apiService } from '@/features/auth/services/apiClient';

export interface QuizQuestion {
  id: string;
  question_text: string;
  type: 'multiple_choice' | 'multiple_select' | 'true_false';
  difficulty: 'easy' | 'medium' | 'hard';
  category: string;
  options: {
    id: string;
    option_text: string;
    is_correct: boolean;
  }[];
  explanation?: string;
  points: number;
}

interface QuizSession {
  sessionId: string;
  userId: string;
  questions: QuizQuestion[];
  currentQuestionIndex: number;
  userAbility: number;
  confidenceInterval: number;
  responses: {
    questionId: string;
    isCorrect: boolean;
    responseTime: number;
    confidence: number;
  }[];
  isComplete: boolean;
  finalScore: number;
  recommendations: string[];
}

interface AdaptiveQuizProps {
  courseId?: string;
  unitId?: string;
  onComplete?: (session: QuizSession) => void;
}

export function AdaptiveQuiz({ courseId, unitId, onComplete }: AdaptiveQuizProps) {
  const { data: sessionData } = useSession();
  const [session, setSession] = useState<QuizSession | null>(null);
  const [currentAnswer, setCurrentAnswer] = useState<string | null>(null);
  const [confidence, setConfidence] = useState(3);
  const [startTime, setStartTime] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedback, setFeedback] = useState<{ isCorrect: boolean; explanation?: string } | null>(null);

  useEffect(() => {
    startQuiz();
  }, [courseId, unitId, sessionData]);

  const startQuiz = async () => {
    try {
      setLoading(true);
      const response = await apiService.post<QuizSession>(
        '/assessments/adaptive-quiz/start',
        { courseId, unitId }
      );
      setSession(response.data);
      setStartTime(Date.now());
    } catch (error) {
      console.error('Failed to start quiz:', error);
      toast.error('Failed to start adaptive quiz');
    } finally {
      setLoading(false);
    }
  };

  const submitAnswer = async () => {
    if (!session || !currentAnswer) return;

    const responseTime = Math.floor((Date.now() - startTime) / 1000);
    const currentQuestion = session.questions[session.currentQuestionIndex];

    try {
      setLoading(true);
      const response = await apiService.post<{ session: QuizSession; isCorrect: boolean; explanation?: string; isComplete: boolean }>(
        '/assessments/adaptive-quiz/answer',
        {
          sessionId: session.sessionId,
          questionId: currentQuestion.id,
          answer: currentAnswer,
          responseTime,
          confidence,
        }
      );

      const result = response.data;
      setFeedback(result);
      setShowFeedback(true);
      setSession(result.session);

      if (result.isComplete) {
        onComplete?.(result.session);
      }
    } catch (error) {
      console.error('Failed to submit answer:', error);
      toast.error('Failed to submit answer');
    } finally {
      setLoading(false);
    }
  };

  const nextQuestion = () => {
    setCurrentAnswer(null);
    setConfidence(3);
    setShowFeedback(false);
    setFeedback(null);
    setStartTime(Date.now());
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy':
        return 'bg-green-100 text-green-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'hard':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getAbilityLevel = (ability: number) => {
    if (ability < -1) return { level: 'Beginner', color: 'text-blue-600' };
    if (ability > 1) return { level: 'Advanced', color: 'text-purple-600' };
    return { level: 'Intermediate', color: 'text-green-600' };
  };

  if (loading && !session) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Brain className="h-12 w-12 mx-auto mb-4 text-blue-500 animate-pulse" />
          <h3 className="text-lg font-medium mb-2">Preparing Your Adaptive Quiz</h3>
          <p className="text-gray-600">Analyzing your learning profile...</p>
        </CardContent>
      </Card>
    );
  }

  if (!session) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 text-red-500" />
          <h3 className="text-lg font-medium mb-2">Unable to Start Quiz</h3>
          <p className="text-gray-600 mb-4">There was an error starting your adaptive quiz.</p>
          <Button onClick={startQuiz}>Try Again</Button>
        </CardContent>
      </Card>
    );
  }

  if (session.isComplete) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-6 w-6 text-green-500" />
            Quiz Complete!
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-center">
            <div className="text-4xl font-bold text-green-600 mb-2">
              {session.finalScore.toFixed(0)}%
            </div>
            <p className="text-gray-600">Final Score</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{session.responses.length}</div>
              <p className="text-sm text-gray-600">Questions Answered</p>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">
                {getAbilityLevel(session.userAbility).level}
              </div>
              <p className="text-sm text-gray-600">Estimated Level</p>
            </div>
          </div>

          {session.recommendations.length > 0 && (
            <div>
              <h4 className="font-medium mb-3 flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Recommendations
              </h4>
              <ul className="space-y-2">
                {session.recommendations.map((rec, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                    <span className="text-sm text-gray-700">{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex gap-2">
            <Button onClick={startQuiz} className="flex-1">
              Take Another Quiz
            </Button>
            <Button variant="outline" onClick={() => onComplete?.(session)} className="flex-1">
              View Detailed Results
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const currentQuestion = session.questions[session.currentQuestionIndex];
  const progress =
    ((session.currentQuestionIndex + 1) / Math.max(session.questions.length, 5)) * 100;
  const abilityInfo = getAbilityLevel(session.userAbility);

  return (
    <div className="space-y-6">
      {/* Progress Header */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <Badge className={getDifficultyColor(currentQuestion.difficulty)}>
                {currentQuestion.difficulty}
              </Badge>
              <Badge variant="outline">{currentQuestion.category}</Badge>
              <div className="flex items-center gap-1 text-sm text-gray-600">
                <Target className="h-4 w-4" />
                <span className={abilityInfo.color}>{abilityInfo.level}</span>
              </div>
            </div>
            <div className="text-sm text-gray-600">Question {session.currentQuestionIndex + 1}</div>
          </div>
          <Progress value={progress} className="h-2" />
        </CardContent>
      </Card>

      {/* Question Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg leading-relaxed">{currentQuestion.question_text}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!showFeedback ? (
            <>
              {/* Answer Options */}
              <div className="space-y-3">
                {currentQuestion.options.map(option => (
                  <label
                    key={option.id}
                    className={`flex items-center p-4 border rounded-lg cursor-pointer transition-colors ${
                      currentAnswer === option.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="answer"
                      value={option.id}
                      checked={currentAnswer === option.id}
                      onChange={e => setCurrentAnswer(e.target.value)}
                      className="sr-only"
                    />
                    <div className="flex-1">{option.option_text}</div>
                  </label>
                ))}
              </div>

              {/* Confidence Slider */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  How confident are you in your answer?
                </label>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-500">Not sure</span>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    value={confidence}
                    onChange={e => setConfidence(Number(e.target.value))}
                    className="flex-1"
                    aria-label="Confidence level"
                  />
                  <span className="text-sm text-gray-500">Very confident</span>
                </div>
                <div className="text-center">
                  <Badge variant="outline">{confidence}/5</Badge>
                </div>
              </div>

              <Button
                onClick={submitAnswer}
                disabled={!currentAnswer || loading}
                className="w-full"
              >
                {loading ? 'Submitting...' : 'Submit Answer'}
              </Button>
            </>
          ) : feedback && (
            /* Feedback Display */
            <div className="space-y-4">
              <div
                className={`flex items-center gap-2 p-4 rounded-lg ${
                  feedback.isCorrect ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
                }`}
              >
                {feedback.isCorrect ? (
                  <CheckCircle className="h-5 w-5" />
                ) : (
                  <XCircle className="h-5 w-5" />
                )}
                <span className="font-medium">{feedback.isCorrect ? 'Correct!' : 'Incorrect'}</span>
              </div>

              {feedback.explanation && (
                <div className="p-4 bg-blue-50 rounded-lg">
                  <h4 className="font-medium text-blue-900 mb-2">Explanation</h4>
                  <p className="text-blue-800 text-sm">{feedback.explanation}</p>
                </div>
              )}

              <Button onClick={nextQuestion} className="w-full" disabled={session.isComplete}>
                {session.isComplete ? 'Quiz Complete' : 'Next Question'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
