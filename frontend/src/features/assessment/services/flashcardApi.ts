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

export interface UserFlashcardProgress {
  id: string;
  userId: string;
  flashcardId: string;
  easeFactor: number;
  interval: number;
  repetitions: number;
  correctStreak: number;
  nextReview: string | Date;
  lastReview?: string | Date | null;
  updatedAt?: string | Date;
  flashcard: Flashcard;
}

export interface ScheduledReview {
  date: string;
  title: string;
  description: string;
  count: number;
  courseId: string | null;
  topicId: string | null;
}

export interface CardStats {
  totalCards: number;
  dueToday: number;
  mastered: number;
  needsReview: number;
  avgEaseFactor: number;
  total: number;
  due: number;
  upcoming: number;
  averageInterval: number;
}

class FlashcardApiService {
  async createFlashcard(
    userId: string,
    dto: { front?: string; back?: string; questionId?: string; difficulty?: string; tags?: string[] }
  ): Promise<Flashcard> {
    const response = await api.post('/flashcards/create', {
      userId,
      ...dto,
    });
    return response.data as Flashcard;
  }

  async getDueCards(
    userId: string,
    filters: { courseId?: string; topicId?: string } = {},
  ): Promise<UserFlashcardProgress[]> {
    const params = new URLSearchParams();
    if (filters.courseId) params.set('courseId', filters.courseId);
    if (filters.topicId) params.set('topicId', filters.topicId);
    const query = params.toString();
    const response = await api.get(
      `/flashcards/due/${userId}${query ? `?${query}` : ''}`,
    );
    return response.data as UserFlashcardProgress[];
  }

  async getScheduledReviews(
    userId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<ScheduledReview[]> {
    const params = new URLSearchParams({
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    });
    const response = await api.get(
      `/flashcards/schedule/${userId}?${params.toString()}`,
    );
    return response.data as ScheduledReview[];
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

  async getCardStats(
    userId: string,
    filters: { courseId?: string; topicId?: string } = {},
  ): Promise<CardStats> {
    const params = new URLSearchParams();
    if (filters.courseId) params.set('courseId', filters.courseId);
    if (filters.topicId) params.set('topicId', filters.topicId);
    const query = params.toString();
    const response = await api.get(
      `/flashcards/overview/${userId}${query ? `?${query}` : ''}`,
    );
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
