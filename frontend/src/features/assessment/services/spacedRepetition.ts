import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { apiService } from '@/features/auth/services/apiClient';

interface FlashcardDB extends DBSchema {
  flashcards: {
    key: string;
    value: {
      id: string; // local record ID
      userId: string;
      flashcardId: string; // the content/question ID on backend
      easeFactor: number;
      interval: number; // in days
      nextReview: Date;
      lastReview?: Date;
      repetitions: number;
      correctStreak: number;
      updatedAt: Date;
      synced: boolean;
      // Optional fields for UI
      question?: string;
      answer?: string;
    };
    indexes: {
      'by-user': string;
      'by-next-review': IDBValidKey;
      'by-sync-status': IDBValidKey;
    };
  };
}

class SpacedRepetitionService {
  private db: IDBPDatabase<FlashcardDB> | null = null;
  private readonly DB_NAME = 'medical-flashcards-db';
  private readonly DB_VERSION = 1;
  private readonly INITIAL_EF = 2.5;
  private readonly MIN_EF = 1.3;

  async init() {
    this.db = await openDB<FlashcardDB>(this.DB_NAME, this.DB_VERSION, {
      upgrade(db) {
        const store = db.createObjectStore('flashcards', { keyPath: 'id' });
        store.createIndex('by-user', 'userId');
        store.createIndex('by-next-review', 'nextReview');
        store.createIndex('by-sync-status', 'synced');
      },
    });
  }

  async createFlashcard(userId: string, flashcardId: string) {
    if (!this.db) await this.init();
    const flashcard = {
      id: crypto.randomUUID(),
      userId,
      flashcardId,
      easeFactor: this.INITIAL_EF,
      interval: 1,
      nextReview: new Date(),
      repetitions: 0,
      correctStreak: 0,
      updatedAt: new Date(),
      synced: false,
    };

    const tx = this.db!.transaction('flashcards', 'readwrite');
    await tx.store.put(flashcard);
    await tx.done;

    // Trigger sync
    this.sync().catch(console.error);

    return flashcard;
  }

  async getDueCards(userId: string): Promise<FlashcardDB['flashcards']['value'][]> {
    if (!this.db) await this.init();
    const tx = this.db!.transaction('flashcards', 'readonly');
    const index = tx.store.index('by-user');
    const cards = await index.getAll(userId);
    return cards.filter(card => card.nextReview <= new Date());
  }

  async updateCard(cardId: string, quality: number) {
    if (!this.db) await this.init();
    const tx = this.db!.transaction('flashcards', 'readwrite');
    const card = await tx.store.get(cardId);

    if (!card) return null;

    // SM-2 Algorithm (Basic version for offline, backend will refine)
    let newEf = card.easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    newEf = Math.max(this.MIN_EF, newEf);

    let newInterval;
    if (quality >= 3) {
      if (card.repetitions === 0) {
        newInterval = 1;
      } else if (card.repetitions === 1) {
        newInterval = 6;
      } else {
        newInterval = Math.round(card.interval * newEf);
      }
      card.correctStreak += 1;
      card.repetitions += 1;
    } else {
      card.correctStreak = 0;
      newInterval = 1;
    }

    const updatedCard = {
      ...card,
      easeFactor: newEf,
      interval: newInterval,
      nextReview: new Date(Date.now() + newInterval * 24 * 60 * 60 * 1000),
      lastReview: new Date(),
      updatedAt: new Date(),
      synced: false,
    };

    await tx.store.put(updatedCard);
    await tx.done;

    // Trigger sync
    this.sync().catch(console.error);

    return updatedCard;
  }

  async sync() {
    if (!this.db) await this.init();
    const unsyncedCards = await this.getUnsyncedCards();
    if (unsyncedCards.length === 0) return;

    try {
      const userId = unsyncedCards[0].userId;
      const response = await apiService.post(`/flashcards/sync/${userId}`, {
        cards: unsyncedCards.map(c => ({
          flashcardId: c.flashcardId,
          easeFactor: c.easeFactor,
          interval: c.interval,
          nextReview: c.nextReview.toISOString(),
          repetitions: c.repetitions,
          correctStreak: c.correctStreak,
          updatedAt: c.updatedAt.toISOString(),
        })),
      });

      if (response && (response as unknown as Record<string, unknown>).success) {
        await this.markAsSynced(unsyncedCards.map(c => c.id));
      }
    } catch (err) {
      console.warn('[Flashcards] Sync failed:', err);
    }
  }

  async getUnsyncedCards() {
    if (!this.db) await this.init();
    const tx = this.db!.transaction('flashcards', 'readonly');
    const index = tx.store.index('by-sync-status');
    return index.getAll(false as unknown as IDBValidKey);
  }

  async markAsSynced(cardIds: string[]) {
    if (!this.db) await this.init();
    const tx = this.db!.transaction('flashcards', 'readwrite');
    for (const id of cardIds) {
      const card = await tx.store.get(id);
      if (card) {
        card.synced = true;
        await tx.store.put(card);
      }
    }
    await tx.done;
  }

  async getCardStats(userId: string) {
    if (!this.db) await this.init();
    const tx = this.db!.transaction('flashcards', 'readonly');
    const index = tx.store.index('by-user');
    const cards = await index.getAll(userId);

    const now = new Date();
    const dueCards = cards.filter(card => card.nextReview <= now);
    const upcomingCards = cards.filter(card => card.nextReview > now);

    return {
      total: cards.length,
      due: dueCards.length,
      upcoming: upcomingCards.length,
      averageInterval: cards.length > 0 ? cards.reduce((sum, card) => sum + card.interval, 0) / cards.length : 0,
    };
  }
}

export const spacedRepetition = new SpacedRepetitionService();
