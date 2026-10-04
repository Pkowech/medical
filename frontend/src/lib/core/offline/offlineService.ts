import {
  initDB,
  LocalFileMetadata,
  QuizQuestion,
  ReadingMaterial,
  OfflinePracticeAttempt,
  OfflineQuizQuestion,
  OfflineTopicBundle,
  OfflineTopicMaterial,
  OfflineTopicQuiz,
  SyncQueueItem,
} from './db';
import { syncService } from './syncService';

const OFFLINE_USER_KEY = 'medtrack-offline-user';
const OFFLINE_CONTENT_TTL = 30 * 24 * 60 * 60 * 1000;

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

  async saveLocalFileMetadata(metadata: LocalFileMetadata): Promise<void> {
    const db = await this.initialize();
    const tx = db.transaction('localFileMetadata', 'readwrite');
    await tx.store.put(metadata);
    await tx.done;
  }

  async getLocalFileMetadata(hash: string): Promise<LocalFileMetadata | undefined> {
    const db = await this.initialize();
    const tx = db.transaction('localFileMetadata', 'readonly');
    return tx.store.get(hash);
  }

  // Sync queue methods
  async addToSyncQueue(item: Omit<SyncQueueItem, 'id' | 'attempts'>) {
    const db = await this.initialize();
    const tx = db.transaction('syncQueue', 'readwrite');
    const syncItem: SyncQueueItem = {
      ...item,
      id: crypto.randomUUID(),
      url:
        item.type === 'quiz_submission'
          ? '/api/backend/quizzes/submit?type=full'
          : '/api/backend/progress/sync',
      method: 'POST',
      body: item.data,
      createdAt: item.timestamp,
      status: 'pending',
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

  async cacheTopicBundle(input: {
    userId: string;
    courseId: string;
    unitId: string;
    topicId: string;
    title: string;
    description?: string;
    cacheMode?: 'download' | 'session';
    sessionId?: string;
    isComplete?: boolean;
    preserveCachedQuiz?: boolean;
    materials: Array<{
      materialId: string;
      title: string;
      description?: string;
      content: Blob;
    }>;
    questions: OfflineQuizQuestion[];
  }): Promise<OfflineTopicBundle> {
    const db = await this.initialize();
    const bundleId = this.topicBundleId(input.userId, input.topicId);
    const existing = await db.get('offlineTopics', bundleId);
    const now = Date.now();
    const newMaterials: OfflineTopicMaterial[] = input.materials.map(material => ({
      id: this.materialId(input.userId, input.topicId, material.materialId),
      userId: input.userId,
      topicId: input.topicId,
      materialId: material.materialId,
      title: material.title,
      description: material.description,
      mimeType: 'application/pdf',
      size: material.content.size,
      content: material.content,
      cachedAt: now,
    }));
    const materialRecords = new Map(newMaterials.map(material => [material.materialId, material]));
    if (input.cacheMode === 'session' && existing?.cacheMode === 'session') {
      for (const materialId of existing.materialIds) {
        if (materialRecords.has(materialId)) continue;
        const cached = await db.get(
          'offlineTopicMaterials',
          this.materialId(input.userId, input.topicId, materialId),
        );
        if (cached) materialRecords.set(materialId, cached);
      }
    }
    const cachedQuiz =
      input.cacheMode === 'session' &&
      existing?.cacheMode === 'session' &&
      input.preserveCachedQuiz
        ? await db.get('offlineTopicQuizzes', bundleId)
        : undefined;
    const questions = input.questions.length ? input.questions : cachedQuiz?.questions ?? [];
    const complete = input.isComplete ?? input.cacheMode !== 'session';
    const bundle: OfflineTopicBundle = {
      id: bundleId,
      userId: input.userId,
      courseId: input.courseId,
      unitId: input.unitId,
      topicId: input.topicId,
      title: input.title,
      description: input.description,
      cacheMode: input.cacheMode ?? 'download',
      sessionId: input.cacheMode === 'session' ? input.sessionId : undefined,
      isComplete: complete,
      materialIds: [...materialRecords.keys()],
      downloadedAt: now,
      expiresAt: now + (input.cacheMode === 'session' ? 24 * 60 * 60 * 1000 : OFFLINE_CONTENT_TTL),
      totalBytes:
        [...materialRecords.values()].reduce((total, material) => total + material.size, 0) +
        new Blob([JSON.stringify(questions)]).size,
    };
    const tx = db.transaction(
      ['offlineTopics', 'offlineTopicMaterials', 'offlineTopicQuizzes'],
      'readwrite',
    );
    const materialStore = tx.objectStore('offlineTopicMaterials');
    const nextMaterialIds = new Set(bundle.materialIds);
    for (const materialId of existing?.materialIds ?? []) {
      if (!nextMaterialIds.has(materialId)) {
        await materialStore.delete(this.materialId(input.userId, input.topicId, materialId));
      }
    }
    await tx.objectStore('offlineTopics').put(bundle);
    for (const material of materialRecords.values()) {
      await materialStore.put(material);
    }
    await tx.objectStore('offlineTopicQuizzes').put({
      id: bundleId,
      userId: input.userId,
      topicId: input.topicId,
      questions,
      cachedAt: now,
    });
    await tx.done;
    return bundle;
  }

  async getOfflineTopicBundle(
    userId: string,
    topicId: string,
  ): Promise<OfflineTopicBundle | undefined> {
    const db = await this.initialize();
    const id = this.topicBundleId(userId, topicId);
    const bundle = await db.get('offlineTopics', id);
    if (!bundle || bundle.expiresAt <= Date.now()) {
      if (bundle) await this.removeOfflineTopic(userId, topicId);
      return undefined;
    }
    return bundle;
  }

  async listOfflineTopicBundles(userId: string): Promise<OfflineTopicBundle[]> {
    const db = await this.initialize();
    const bundles = await db.getAllFromIndex('offlineTopics', 'by-user', userId);
    const validBundles: OfflineTopicBundle[] = [];
    for (const bundle of bundles) {
      if (bundle.expiresAt <= Date.now()) {
        await this.removeOfflineTopic(userId, bundle.topicId);
      } else if (bundle.cacheMode !== 'session') {
        validBundles.push(bundle);
      }
    }
    return validBundles;
  }

  async getOfflineTopicMaterials(
    userId: string,
    topicId: string,
  ): Promise<OfflineTopicMaterial[]> {
    const db = await this.initialize();
    const bundle = await this.getOfflineTopicBundle(userId, topicId);
    if (!bundle) return [];
    const materials: OfflineTopicMaterial[] = [];
    for (const materialId of bundle.materialIds) {
      const material = await db.get(
        'offlineTopicMaterials',
        this.materialId(userId, topicId, materialId),
      );
      if (material) materials.push(material);
    }
    return materials;
  }

  async getOfflineMaterial(
    userId: string,
    topicId: string,
    materialId: string,
  ): Promise<OfflineTopicMaterial | undefined> {
    const bundle = await this.getOfflineTopicBundle(userId, topicId);
    if (!bundle?.materialIds.includes(materialId)) return undefined;
    const db = await this.initialize();
    return db.get('offlineTopicMaterials', this.materialId(userId, topicId, materialId));
  }

  async getOfflineTopicQuiz(userId: string, topicId: string): Promise<OfflineTopicQuiz | undefined> {
    const bundle = await this.getOfflineTopicBundle(userId, topicId);
    if (!bundle) return undefined;
    const db = await this.initialize();
    return db.get('offlineTopicQuizzes', this.topicBundleId(userId, topicId));
  }

  async removeOfflineTopic(userId: string, topicId: string): Promise<void> {
    const db = await this.initialize();
    const id = this.topicBundleId(userId, topicId);
    const bundle = await db.get('offlineTopics', id);
    const tx = db.transaction(
      ['offlineTopics', 'offlineTopicMaterials', 'offlineTopicQuizzes'],
      'readwrite',
    );
    await tx.objectStore('offlineTopics').delete(id);
    await tx.objectStore('offlineTopicQuizzes').delete(id);
    for (const materialId of bundle?.materialIds ?? []) {
      await tx
        .objectStore('offlineTopicMaterials')
        .delete(this.materialId(userId, topicId, materialId));
    }
    await tx.done;
  }

  async removeSessionOfflineTopic(
    userId: string,
    topicId: string,
    sessionId: string,
  ): Promise<void> {
    const bundle = await this.getOfflineTopicBundle(userId, topicId);
    if (bundle?.cacheMode === 'session' && bundle.sessionId === sessionId) {
      await this.removeOfflineTopic(userId, topicId);
    }
  }

  async removeOfflineTopicMaterial(
    userId: string,
    topicId: string,
    materialId: string,
  ): Promise<void> {
    const db = await this.initialize();
    const bundleId = this.topicBundleId(userId, topicId);
    const bundle = await db.get('offlineTopics', bundleId);
    if (!bundle) return;
    const material = await db.get(
      'offlineTopicMaterials',
      this.materialId(userId, topicId, materialId),
    );
    const tx = db.transaction(['offlineTopics', 'offlineTopicMaterials'], 'readwrite');
    await tx
      .objectStore('offlineTopicMaterials')
      .delete(this.materialId(userId, topicId, materialId));
    await tx.objectStore('offlineTopics').put({
      ...bundle,
      materialIds: bundle.materialIds.filter(id => id !== materialId),
      totalBytes: Math.max(0, bundle.totalBytes - (material?.size ?? 0)),
    });
    await tx.done;
  }

  async saveOfflinePracticeAttempt(attempt: OfflinePracticeAttempt): Promise<void> {
    const db = await this.initialize();
    await db.put('offlinePracticeAttempts', attempt);
  }

  async queueOfflinePracticeAttempt(attempt: OfflinePracticeAttempt): Promise<void> {
    await this.saveOfflinePracticeAttempt({ ...attempt, status: 'pending', lastError: undefined });
    try {
      await syncService.addToOutbox(
        `/quizzes/topic/${encodeURIComponent(attempt.topicId)}/offline-attempts`,
        'POST',
        {
          attemptId: attempt.id,
          responses: attempt.responses,
        },
        { 'Content-Type': 'application/json' },
        attempt.lastUpdated,
        attempt.id,
        attempt.userId,
        'offline_practice_submission',
      );
    } catch (error) {
      await this.saveOfflinePracticeAttempt({
        ...attempt,
        status: 'failed',
        lastError: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async getOfflinePracticeAttempts(userId: string): Promise<OfflinePracticeAttempt[]> {
    const db = await this.initialize();
    return db.getAllFromIndex('offlinePracticeAttempts', 'by-user', userId);
  }

  async clearUserOfflineContent(userId: string): Promise<void> {
    const db = await this.initialize();
    const userStores = [
      'offlineTopics',
      'offlineTopicMaterials',
      'offlineTopicQuizzes',
      'offlinePracticeAttempts',
    ] as const;
    const tx = db.transaction([...userStores, 'syncQueue'], 'readwrite');
    for (const storeName of userStores) {
      const store = tx.objectStore(storeName);
      const ids = await store.index('by-user').getAllKeys(userId);
      for (const id of ids) await store.delete(id);
    }
    const queue = tx.objectStore('syncQueue');
    const queuedItems = await queue.getAll();
    for (const item of queuedItems) {
      if (item.userId === userId) await queue.delete(item.id);
    }
    await tx.done;
    if (this.getActiveOfflineUserId() === userId) {
      localStorage.removeItem(OFFLINE_USER_KEY);
    }
  }

  getActiveOfflineUserId(): string | undefined {
    if (typeof localStorage === 'undefined') return undefined;
    return localStorage.getItem(OFFLINE_USER_KEY) || undefined;
  }

  clearActiveOfflineUserId(userId: string): void {
    if (
      typeof localStorage !== 'undefined' &&
      localStorage.getItem(OFFLINE_USER_KEY) === userId
    ) {
      localStorage.removeItem(OFFLINE_USER_KEY);
    }
  }

  setActiveOfflineUserId(userId: string): void {
    localStorage.setItem(OFFLINE_USER_KEY, userId);
  }

  private topicBundleId(userId: string, topicId: string): string {
    return `${userId}:${topicId}`;
  }

  private materialId(userId: string, topicId: string, materialId: string): string {
    return `${userId}:${topicId}:${materialId}`;
  }
}

export const offlineService = new OfflineService();
