import { apiService } from '@/features/auth/services/apiClient';

export interface TopicQuizSubmission {
  score: number;
  feedback: string;
  passed: boolean;
  masteryUnlocked: boolean;
  nextTopicUnlocked: boolean;
  nextTopicId?: string;
  recommendations?: QuizPerformanceRecommendations;
}

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

class QuizService {
  private readonly baseUrl = '/quizzes';

  async getQuestionsForLesson(
    lessonId: string | number,
    scope: 'unit' | 'topic' | 'assessment'
  ): Promise<unknown[]> {
    const response = await apiService.get<unknown[]>(`${this.baseUrl}/${scope}/${lessonId}`);
    return response.data;
  }

  async submitAnswer(
    questionId: string,
    selectedOptionId: string
  ): Promise<{ correct: boolean; explanation?: string }> {
    const response = await apiService.post<{
      correct: boolean;
      explanation?: string;
    }>(`${this.baseUrl}/submit`, {
      questionId,
      selectedOptionIds: [selectedOptionId],
    });
    return response.data;
  }

  async submitUnitQuiz(
    unitId: string | number,
    answers: Array<{ questionId: string; selectedOption: string }>
  ): Promise<{
    percentage: number;
    isPassed: boolean;
    recommendations?: QuizPerformanceRecommendations;
  }> {
    const response = await apiService.post<{
      percentage: number;
      isPassed: boolean;
      recommendations?: QuizPerformanceRecommendations;
    }>(`${this.baseUrl}/submit?type=full`, { unitId, answers });
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
