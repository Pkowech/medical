import {
  Question,
  Quiz,
  QuestionDifficulty,
  QuestionCategory,
} from '@prisma/client';

export interface PrismaSchemaTypes {
  QuestionResponse: {
    id: string;
    userId: string;
    questionId: string;
    quizAttemptId: string;
    answer: string[];
    isCorrect: boolean;
    timeSpent: number;
    createdAt: Date;
    question: Question & {
      difficultyIndex?: number;
      discrimination?: number;
      category: QuestionCategory;
      difficulty: QuestionDifficulty;
    };
  };

  QuizAttempt: {
    id: string;
    userId: string;
    quizId: string;
    score: number;
    maxScore: number;
    percentage: number;
    passed: boolean;
    answers: Array<{ id: string; answer: string | string[] }>;
    startedAt: Date;
    completedAt: Date | null;
    timeSpent: number;
    correctAnswers?: number;
    quiz?: Quiz & {
      questions: {
        question: Question;
      }[];
    };
  };
}
