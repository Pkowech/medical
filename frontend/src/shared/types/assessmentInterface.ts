import { BaseEntity } from './systemInterface';

export interface Quiz extends BaseEntity {
  title: string;
  description: string;
  timeLimit?: number; // in minutes
  passingScore?: number;
  allowRetakes?: boolean;
  shuffleQuestions?: boolean;
  questions: QuizQuestion[];
  attempts?: QuizAttempt[];
  duration?: number;
  questionCount?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
  bestScore?: number;
  lastAttempt?: string;
  isCompleted?: boolean;
}

export type QuestionType = 'multiple_choice' | 'multiple_select' | 'true_false' | 'short_answer' | 'essay';

export interface QuizQuestionOption {
  id: string;
  option_text: string;
  is_correct: boolean;
}

export interface QuizQuestion extends BaseEntity {
  question_text: string;
  type: QuestionType;
  difficulty: 'easy' | 'medium' | 'hard';
  category: string;
  topic?: string;
  options: QuizQuestionOption[] | string[];
  correct_answer?: string;
  explanation?: string;
  points: number;
  order?: number;
  materialId?: string;
  unitId?: string;
}

export interface QuizAttempt extends BaseEntity {
  quizId: string;
  userId: string;
  score: number;
  totalPoints: number;
  percentage: number;
  timeSpent: number; // in seconds
  startedAt: string;
  completedAt?: string;
  answers: QuizAnswer[];
}

export interface QuizAnswer {
  questionId: string;
  answer: string;
  isCorrect: boolean;
  points: number;
}

export interface QuizSession {
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

export interface AdaptiveQuizProps {
  courseId?: string;
  unitId?: string;
  onComplete?: (session: QuizSession) => void;
}
