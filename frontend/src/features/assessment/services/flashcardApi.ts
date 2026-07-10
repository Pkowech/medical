import api from '../../auth/services/apiClient';

// SM-2 Algorithm Spaced Repetition Card
export interface SM2Card {
  easeFactor: number;
  interval: number;
  repetitions: number;
  correctStreak: number;
  lastReviewDate?: Date;
  nextReviewDate: Date;
}

// Flashcard with user progress tracking
export interface Flashcard {
  id: string;
  front: string;
  back: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  tags?: string[];
  hints?: string[];
  questionId?: string;
}

// User flashcard progress tracking
export interface UserFlashcardProgress extends SM2Card {
  id: string;
  userId: string;
  flashcardId: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CardStats {
  totalCards: number;
  dueToday: number;
  mastered: number;
  needsReview: number;
  avgEaseFactor: number;
}

class FlashcardApiService {
  async createFlashcard(
    userId: string,
    dto: { front: string; back: string; questionId?: string; difficulty?: string; tags?: string[] }
  ): Promise<Flashcard> {
    const response = await api.post('/flashcards/create', {
      userId,
      ...dto,
    });
    return response.data as Flashcard;
  }

  async getDueCards(userId: string): Promise<Flashcard[]> {
    const response = await api.get(`/flashcards/due/${userId}`);
    return response.data as Flashcard[];
  }

  async updateCard(cardId: string, quality: number): Promise<UserFlashcardProgress> {
    if (quality < 1 || quality > 5) {
      throw new Error('Quality must be between 1 and 5');
    }
    const response = await api.post(`/flashcards/update/${cardId}`, {
      quality,
    });
    return response.data as UserFlashcardProgress;
  }

  async getCardStats(userId: string): Promise<CardStats> {
    const response = await api.get(`/flashcards/overview/${userId}`);
    return response.data as CardStats;
  }

  async syncCards(userId: string, cards: UserFlashcardProgress[]): Promise<Flashcard[]> {
    const response = await api.post(`/flashcards/sync/${userId}`, {
      cards,
    });
    return response.data as Flashcard[];
  }
}

export const flashcardApi = new FlashcardApiService();
