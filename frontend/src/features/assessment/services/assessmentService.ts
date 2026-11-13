import { apiService } from '@/features/auth/services/apiClient';
import type { PerformanceData } from '@/shared/types/analyticsInterface';

export interface Assessment {
  id: string;
  title: string;
  description: string;
  type: 'quiz' | 'adaptive';
  category: string;
  questionCount: number;
  timeLimitMinutes?: number;
  passingScore: number;
  unitId?: string;
  unitTitle?: string;
  courseId?: string;
  courseTitle?: string;
}

interface QuizListResponse {
  data: Array<{
    id: string;
    title: string;
    description: string | null;
    timeLimit: number | null;
    questionCount: number;
    isAdaptive: boolean;
    passingScore: number | null;
    category: { name: string } | null;
    unit: {
      id: string;
      name: string;
      course: { id: string; name: string } | null;
    } | null;
  }>;
}

export interface AssessmentHistory {
  attempts: Array<{
    id: string;
    quizId: string;
    quizTitle: string;
    score: number;
    totalQuestions: number;
    correctAnswers: number;
    timeSpent: number;
    completedAt: string;
    unitId: string;
    unitTitle: string;
  }>;
}

export const fetchAssessments = async (): Promise<Assessment[]> => {
  const response = await apiService.get<QuizListResponse>('/quizzes', {
    params: { page: 1, limit: 100 },
  });

  return response.data.data.map(quiz => ({
    id: quiz.id,
    title: quiz.title,
    description: quiz.description ?? '',
    type: quiz.isAdaptive ? 'adaptive' : 'quiz',
    category: quiz.category?.name ?? 'General',
    questionCount: quiz.questionCount,
    timeLimitMinutes: quiz.timeLimit ?? undefined,
    passingScore: quiz.passingScore ?? 0,
    unitId: quiz.unit?.id,
    unitTitle: quiz.unit?.name,
    courseId: quiz.unit?.course?.id,
    courseTitle: quiz.unit?.course?.name,
  }));
};

export const fetchUserAssessmentSummary = async (): Promise<PerformanceData | null> => {
  try {
    const response = await apiService.get<PerformanceData>('/assessment-progress/summary');
    return response.data;
  } catch (error) {
    console.error('Failed to load assessment summary:', error);
    return null;
  }
};

export const fetchAssessmentHistory = async (): Promise<AssessmentHistory['attempts']> => {
  const response = await apiService.get<AssessmentHistory>('/assessment-progress/history');
  return response.data.attempts;
};
