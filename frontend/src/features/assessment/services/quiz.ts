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
      readinessPending?: boolean;
      recommendations?: QuizPerformanceRecommendations;
      recommendationsAvailable?: boolean;
      resultsAvailable: true;
    };

export interface QuizPerformanceRecommendations {
  topics: Array<{
    topicId: string;
    topicName: string;
    accuracy: number;
    targetEvidence: {
      sampleSize: number;
      accuracy: number | null;
    };
    diagnosis: 'prerequisite_gap' | 'target_content_gap' | 'insufficient_evidence';
    confidence: 'low' | 'medium' | 'high';
    prerequisiteEvidence: Array<{
      unitId: string;
      unitName: string;
      sampleSize: number;
      accuracy: number | null;
    }>;
    sequence?: Array<{
      title: string;
      rationale: string;
      resources: Array<{
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
  questions?: Array<{
    id: string;
    text: string;
    type: string;
    points: number;
    topicIds: string[];
    options: Array<{ id: string; text: string; order: number }>;
  }>;
  answers: Array<{ questionId: string; selectedOption: string | string[] | null }>;
  timeLimit: number | null;
  expiresAt: string | null;
  showResults: boolean;
}

export interface DetailedQuestionFeedback {
  questionId: string;
  isCorrect: boolean;
  userAnswer: unknown;
  correctAnswer: Array<{ id: string; text: string }>;
  explanation: string;
  conceptsToReview: string[];
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

  async startTopicQuizAttempt(
    topicId: string | number,
    attemptId: string
  ): Promise<StartedQuizAttempt> {
    const response = await apiService.post<StartedQuizAttempt>(
      `${this.baseUrl}/topic/${topicId}/start`,
      { attemptId }
    );
    return response.data;
  }

  async submitAnswer(
    attemptId: string,
    questionId: string,
    selectedOption: string | string[]
  ): Promise<{ saved: true }> {
    const response = await apiService.post<{ saved: true }>(
      `${this.baseUrl}/attempts/${attemptId}/answers`,
      { questionId, selectedOption }
    );
    return response.data;
  }

  async submitUnitQuiz(
    unitId: string | number,
    attemptId: string,
    answers: Array<{ questionId: string; selectedOption: string | string[] | null }>
  ): Promise<{
    percentage?: number;
    isPassed?: boolean;
    resultsAvailable?: boolean;
    recommendations?: QuizPerformanceRecommendations;
    recommendationsAvailable?: boolean;
  }> {
    const response = await apiService.post<{
      percentage?: number;
      isPassed?: boolean;
      resultsAvailable?: boolean;
      recommendations?: QuizPerformanceRecommendations;
      recommendationsAvailable?: boolean;
    }>(`${this.baseUrl}/submit?type=full`, { unitId, attemptId, answers });
    return response.data;
  }

  async submitTopicQuiz(
    topicId: string | number,
    responses: Array<{ questionId: string; selectedAnswers: string[] }>,
    idempotencyKey = crypto.randomUUID(),
  ): Promise<TopicQuizSubmission> {
    const response = await apiService.post<TopicQuizSubmission>(
      `${this.baseUrl}/topic/${topicId}/submit`,
      { responses },
      { headers: { 'X-Idempotency-Key': idempotencyKey } },
    );
    return response.data;
  }

  async getDetailedQuestionFeedback(
    userId: string,
    assessmentId: string,
    questionId: string,
    selectedOptionIds: string[],
    questionType: string,
  ): Promise<DetailedQuestionFeedback> {
    const answerData =
      questionType === 'multiple_select'
        ? selectedOptionIds
        : selectedOptionIds[0] ?? null;
    const response = await apiService.post<DetailedQuestionFeedback>('/feedback', {
      userId,
      assessmentId,
      questionId,
      selectedOptionIds,
      answerData,
      timeSpentSeconds: 0,
    });
    return response.data;
  }
}
export const quizService = new QuizService();
