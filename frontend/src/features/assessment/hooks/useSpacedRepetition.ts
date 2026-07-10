import { useState, useEffect, useCallback } from 'react';
import { spacedRepetition } from '../services/spacedRepetition';

interface Flashcard {
  id: string; // local record ID
  userId: string;
  flashcardId: string; // backend content ID
  easeFactor: number;
  interval: number;
  nextReview: Date;
  lastReview?: Date;
  repetitions: number;
  correctStreak: number;
  updatedAt: Date;
  synced: boolean;
  question?: string;
  answer?: string;
}

interface CardStats {
  total: number;
  due: number;
  upcoming: number;
  averageInterval: number;
}

export function useSpacedRepetition(userId: string) {
  const [dueCards, setDueCards] = useState<Flashcard[]>([]);
  const [currentCard, setCurrentCard] = useState<Flashcard | null>(null);
  const [stats, setStats] = useState<CardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadDueCards = useCallback(async () => {
    if (!userId) return;
    try {
      setIsLoading(true);
      const cards = await spacedRepetition.getDueCards(userId);
      setDueCards(cards);
      if (cards.length > 0) {
        setCurrentCard(cards[0]);
      } else {
        setCurrentCard(null);
      }
      const cardStats = await spacedRepetition.getCardStats(userId);
      setStats(cardStats);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load cards'));
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadDueCards();
  }, [loadDueCards]);

  const rateCard = useCallback(
    async (quality: number) => {
      if (!currentCard) return;

      try {
        const updatedCard = await spacedRepetition.updateCard(currentCard.id, quality);
        if (updatedCard) {
          // Remove the current card from due cards
          setDueCards(prev => {
            const nextDue = prev.filter(card => card.id !== currentCard.id);
            // Set the next card as current if available
            if (nextDue.length > 0) {
              setCurrentCard(nextDue[0]);
            } else {
              setCurrentCard(null);
            }
            return nextDue;
          });

          // Update stats
          const newStats = await spacedRepetition.getCardStats(userId);
          setStats(newStats);
        }
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to update card'));
      }
    },
    [currentCard, userId]
  );

  const createCard = useCallback(
    async (flashcardId: string) => {
      try {
        const card = await spacedRepetition.createFlashcard(userId, flashcardId);
        if (card) {
          setDueCards(prev => {
            const updated = [...prev, card];
            if (!currentCard) {
              setCurrentCard(card);
            }
            return updated;
          });
          const newStats = await spacedRepetition.getCardStats(userId);
          setStats(newStats);
        }
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to create card'));
      }
    },
    [userId, currentCard]
  );

  const syncCards = useCallback(async () => {
    try {
      await spacedRepetition.sync();
      await loadDueCards(); // Refresh after sync
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to sync cards'));
    }
  }, [loadDueCards]);

  return {
    dueCards,
    currentCard,
    stats,
    isLoading,
    error,
    rateCard,
    createCard,
    syncCards,
    refreshCards: loadDueCards,
  };
}
