import { apiService } from '@/features/auth/services/apiClient';

export interface Flashcard {
  id: string;
  userId: string;
  flashcardId: string;
  easeFactor: number;
  interval: number;
  nextReview: string;
  lastReview?: string;
  repetitions: number;
  correctStreak: number;
  updatedAt: string;
  synced: boolean;
}

export interface CardStats {
  total: number;
  due: number;
  upcoming: number;
  averageInterval: number;
}

export interface HighRiskTopic {
  topicId: string;
  topicName: string;
  masteryLevel: number;
  dueCards: number;
}

class FlashcardsService {
  private readonly BASE_URL = '/flashcards';

  async createFlashcard(userId: string, questionId: string): Promise<Flashcard> {
    const response = await apiService.post(`${this.BASE_URL}/create`, {
      userId,
      questionId,
    });
    return response.data;
  }

  async getDueCards(userId: string): Promise<Flashcard[]> {
    try {
      const response = await apiService.get<Flashcard[]>(`${this.BASE_URL}/due/${userId}`);
      return Array.isArray(response.data) ? response.data : [];
    } catch (error) {
      console.error('Failed to fetch due cards:', error);
      return [];
    }
  }

  async updateCard(cardId: string, quality: number): Promise<Flashcard> {
    const response = await apiService.post(`${this.BASE_URL}/update/${cardId}`, {
      quality,
    });
    return response.data;
  }

  async getCardStats(userId: string): Promise<CardStats> {
    try {
      const response = await apiService.get<CardStats>(`${this.BASE_URL}/overview/${userId}`);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch card stats:', error);
      return { total: 0, due: 0, upcoming: 0, averageInterval: 0 };
    }
  }

  async getHighRiskTopics(userId: string): Promise<HighRiskTopic[]> {
    try {
      const response = await apiService.get<HighRiskTopic[]>(
        `${this.BASE_URL}/high-risk-topics/${userId}`
      );
      return Array.isArray(response.data) ? response.data : [];
    } catch (error) {
      console.error('Failed to fetch high-risk topics:', error);
      return [];
    }
  }

  async syncCards(
    userId: string,
    cards: Array<{
      flashcardId: string;
      easeFactor: number;
      interval: number;
      nextReview: string;
      repetitions: number;
      correctStreak: number;
      updatedAt: string;
    }>
  ): Promise<{ success: boolean }> {
    try {
      const response = await apiService.post(`${this.BASE_URL}/sync/${userId}`, {
        cards,
      });
      return response.data;
    } catch (error) {
      console.error('Failed to sync cards:', error);
      return { success: false };
    }
  }
}

export const flashcardsService = new FlashcardsService();
