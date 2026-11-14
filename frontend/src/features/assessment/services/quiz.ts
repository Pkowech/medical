import { apiService } from '@/features/auth/services/apiClient';
import type { GateDecision } from '@/shared/types/mastery.types';

export type TopicQuizSubmission =
  | { resultsAvailable: false }
  | {
      score: number;
      feedback: string;
      passed: boolean;
      masteryUnlocked: boolean;
      nextTopicUnlocked: boolean;
      nextTopicId?: string;
      gateDecision?: GateDecision;
      recommendations?: QuizPerformanceRecommendations;
      resultsAvailable: true;
    };

export interface QuizPerformanceRecommendations {
  topics: Array<{
    topicId: string;
    topicName: string;
    accuracy: number;
    diagnosis: 'prerequisite_gap' | 'target_content_gap' | 'insufficient_evidence';
    confidence: 'low' | 'medium' | 'high';
    prerequisiteEvidence: Array<{
      unitId: string;
      unitName: string;
      sampleSize: number;
      accuracy: number | null;
    }>;
    recommendations: Array<{
      kind: string;
      id: string;
      title: string;
      href: string;
      reason: string;
    }>;
  }>;
  recommendations: Array<{
    kind: string;
    id: string;
    title: string;
    href: string;
    reason: string;
  }>;
}

export interface StartedQuizAttempt {
  attemptId: string;
  startedAt: string;
  completedAt: string | null;
  questionIds: string[];
  answers: Array<{ questionId: string; selectedOption: string | null }>;
  timeLimit: number | null;
  expiresAt: string | null;
  showResults: boolean;
}

class QuizService {
  private readonly baseUrl = '/quizzes';

  async getQuestionsForLesson(
    lessonId: string | number,
    scope: 'unit' | 'topic' | 'assessment'
  ): Promise<unknown[]> {
    const response = await apiService.get<unknown[]>(`${this.baseUrl}/${scope}/${lessonId}`);
    return response.data;
  }

  async startQuizAttempt(
    quizOrUnitId: string | number,
    attemptId: string
  ): Promise<StartedQuizAttempt> {
    const response = await apiService.post<StartedQuizAttempt>(
      `${this.baseUrl}/${quizOrUnitId}/start`,
      { attemptId }
    );
    return response.data;
  }

  async submitAnswer(
    attemptId: string,
    questionId: string,
    selectedOptionId: string
  ): Promise<{ saved: true }> {
    const response = await apiService.post<{ saved: true }>(
      `${this.baseUrl}/attempts/${attemptId}/answers`,
      { questionId, selectedOption: selectedOptionId }
    );
    return response.data;
  }

  async submitUnitQuiz(
    unitId: string | number,
    attemptId: string,
    answers: Array<{ questionId: string; selectedOption: string | null }>
  ): Promise<{
    percentage?: number;
    isPassed?: boolean;
    resultsAvailable?: boolean;
    recommendations?: QuizPerformanceRecommendations;
  }> {
    const response = await apiService.post<{
      percentage?: number;
      isPassed?: boolean;
      resultsAvailable?: boolean;
      recommendations?: QuizPerformanceRecommendations;
    }>(`${this.baseUrl}/submit?type=full`, { unitId, attemptId, answers });
    return response.data;
  }

  async submitTopicQuiz(
    topicId: string | number,
    responses: Array<{ questionId: string; selectedAnswers: string[] }>
  ): Promise<TopicQuizSubmission> {
    const response = await apiService.post<TopicQuizSubmission>(
      `${this.baseUrl}/topic/${topicId}/submit`,
      { responses }
    );
    return response.data;
  }
}
export const quizService = new QuizService();
