import { Question, QuestionDifficulty, QuestionCategory } from '@prisma/client';

export type QuestionWithAnswers = Question & {
  answers?: Array<{ id: string; isCorrect: boolean }>;
};

export type QuestionResponse = {
  questionId: string;
  answer: string | string[];
  isCorrect: boolean;
  timeSpent: number;
  confidence?: number;
};

export type QuizSession = {
  id: string;
  userId: string;
  startTime: Date;
  endTime?: Date;
  currentQuestion?: Question;
  responses: QuestionResponse[];
  score?: number;
  isPassed?: boolean;
};

export type AdaptiveQuizState = {
  userAbility: number;
  confidenceInterval: number;
  questionHistory: string[];
  categoryPerformance: Record<QuestionCategory, number>;
};

export type QuestionDifficultyParams = {
  difficultyIndex: number;
  discrimination?: number;
  guessing?: number;
};

export type QuizAnalytics = {
  totalAttempts: number;
  averageScore: number;
  completionRate: number;
  difficultyBreakdown: Record<QuestionDifficulty, number>;
  categoryBreakdown: Record<QuestionCategory, number>;
  timeDistribution: {
    average: number;
    min: number;
    max: number;
  };
};
