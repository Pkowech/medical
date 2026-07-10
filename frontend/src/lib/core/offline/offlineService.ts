import { initDB, QuizQuestion, ReadingMaterial, SyncQueueItem } from './db';

class OfflineService {
  private db: Awaited<ReturnType<typeof initDB>> | null = null;

  async initialize() {
    if (!this.db) {
      this.db = await initDB();
    }
    return this.db;
  }

  // Quiz caching methods
  async cacheQuizQuestions(questions: QuizQuestion[]) {
    const db = await this.initialize();
    const tx = db.transaction('quizQuestions', 'readwrite');
    const store = tx.objectStore('quizQuestions');

    for (const question of questions) {
      await store.put(question);
    }

    await tx.done;
  }

  async getQuizQuestionsByTopic(topic: string): Promise<QuizQuestion[]> {
    const db = await this.initialize();
    const tx = db.transaction('quizQuestions', 'readonly');
    const index = tx.store.index('by-topic');
    return index.getAll(topic);
  }

  // Reading material caching methods
  async cacheReadingMaterial(material: ReadingMaterial) {
    const db = await this.initialize();
    const tx = db.transaction('readingMaterials', 'readwrite');
    await tx.store.put(material);
    await tx.done;
  }

  async getReadingMaterial(id: string): Promise<ReadingMaterial | undefined> {
    const db = await this.initialize();
    const tx = db.transaction('readingMaterials', 'readonly');
    return tx.store.get(id);
  }

  // Sync queue methods
  async addToSyncQueue(item: Omit<SyncQueueItem, 'id' | 'attempts'>) {
    const db = await this.initialize();
    const tx = db.transaction('syncQueue', 'readwrite');
    const syncItem: SyncQueueItem = {
      ...item,
      id: crypto.randomUUID(),
      attempts: 0,
    };
    await tx.store.add(syncItem);
    await tx.done;
  }

  async getSyncQueueItems(): Promise<SyncQueueItem[]> {
    const db = await this.initialize();
    const tx = db.transaction('syncQueue', 'readonly');
    const index = tx.store.index('by-timestamp');
    return index.getAll();
  }

  async removeFromSyncQueue(id: string) {
    const db = await this.initialize();
    const tx = db.transaction('syncQueue', 'readwrite');
    await tx.store.delete(id);
    await tx.done;
  }

  async incrementSyncAttempt(id: string) {
    const db = await this.initialize();
    const tx = db.transaction('syncQueue', 'readwrite');
    const item = await tx.store.get(id);
    if (item) {
      item.attempts += 1;
      await tx.store.put(item);
    }
    await tx.done;
  }
}

export const offlineService = new OfflineService();
