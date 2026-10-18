import { useState, useEffect, useCallback } from 'react';
import {
  flashcardApi,
  type CardStats,
  type UserFlashcardProgress,
} from '../services/flashcardApi';

export function useSpacedRepetition(userId: string) {
  const [dueCards, setDueCards] = useState<UserFlashcardProgress[]>([]);
  const [currentCard, setCurrentCard] = useState<UserFlashcardProgress | null>(null);
  const [stats, setStats] = useState<CardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadDueCards = useCallback(async () => {
    if (!userId) {
      setDueCards([]);
      setCurrentCard(null);
      setStats(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const [cards, cardStats] = await Promise.all([
        flashcardApi.getDueCards(userId),
        flashcardApi.getCardStats(userId),
      ]);
      setDueCards(cards);
      setCurrentCard(cards[0] ?? null);
      setStats(cardStats);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load review cards'));
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void loadDueCards();
  }, [loadDueCards]);

  const rateCard = useCallback(async (quality: number): Promise<boolean> => {
    if (!currentCard) return false;

    setError(null);
    try {
      await flashcardApi.updateCard(currentCard.id, quality);
      await loadDueCards();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to update review card'));
      return false;
    }
  }, [currentCard, loadDueCards]);

  const createCard = useCallback(async (questionId: string) => {
    if (!userId) return;

    setError(null);
    try {
      await flashcardApi.createFlashcard(userId, { questionId });
      await loadDueCards();
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to create review card'));
    }
  }, [loadDueCards, userId]);

  return {
    dueCards,
    currentCard,
    stats,
    isLoading,
    error,
    rateCard,
    createCard,
    refreshCards: loadDueCards,
  };
}
