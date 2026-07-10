import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface QuizDB extends DBSchema {
  quizState: {
    key: string;
    value: {
      id: string;
      unitId: string;
      userId: string;
      currentQuestionIndex: number;
      answers: Record<string, string>;
      startTime: Date;
      lastModified: Date;
      synced: boolean;
    };
    indexes: {
      'by-user': string;
      'by-unit': string;
      'by-sync-status': IDBValidKey;
    };
  };
  quizResponses: {
    key: string;
    value: {
      id: string;
      userId: string;
      questionId: string;
      selectedAnswer: string;
      isCorrect: boolean;
      timestamp: Date;
      synced: boolean;
    };
    indexes: {
      'by-user': string;
      'by-question': string;
      'by-sync-status': IDBValidKey;
    };
  };
}

class QuizStorage {
  private db: IDBPDatabase<QuizDB> | null = null;
  private readonly DB_NAME = 'medical-quiz-db';
  private readonly DB_VERSION = 1;

  async init() {
    this.db = await openDB<QuizDB>(this.DB_NAME, this.DB_VERSION, {
      upgrade(db) {
        // Create quiz state store
        const quizStateStore = db.createObjectStore('quizState', { keyPath: 'id' });
        quizStateStore.createIndex('by-user', 'userId');
        quizStateStore.createIndex('by-unit', 'unitId');
        quizStateStore.createIndex('by-sync-status', 'synced');

        // Create quiz responses store
        const quizResponsesStore = db.createObjectStore('quizResponses', { keyPath: 'id' });
        quizResponsesStore.createIndex('by-user', 'userId');
        quizResponsesStore.createIndex('by-question', 'questionId');
        quizResponsesStore.createIndex('by-sync-status', 'synced');
      },
    });
  }

  async saveQuizState(state: QuizDB['quizState']['value']) {
    if (!this.db) await this.init();
    const tx = this.db!.transaction('quizState', 'readwrite');
    await tx.store.put({
      ...state,
      synced: false,
      lastModified: new Date(),
    });
    await tx.done;
  }

  async getQuizState(userId: string, unitId: string) {
    if (!this.db) await this.init();
    const tx = this.db!.transaction('quizState', 'readonly');
    const index = tx.store.index('by-user');
    const states = await index.getAll(userId);
    return states.find(state => state.unitId === unitId);
  }

  async saveQuizResponse(response: QuizDB['quizResponses']['value']) {
    if (!this.db) await this.init();
    const tx = this.db!.transaction('quizResponses', 'readwrite');
    await tx.store.put({
      ...response,
      synced: false,
      timestamp: new Date(),
    });
    await tx.done;
  }

  async getUnsyncedResponses() {
    if (!this.db) await this.init();
    const tx = this.db!.transaction('quizResponses', 'readonly');
    const index = tx.store.index('by-sync-status');
    return index.getAll(false as unknown as IDBValidKey);
  }

  async markResponsesAsSynced(ids: string[]) {
    if (!this.db) await this.init();
    const tx = this.db!.transaction('quizResponses', 'readwrite');
    for (const id of ids) {
      const response = await tx.store.get(id);
      if (response) {
        response.synced = true;
        await tx.store.put(response);
      }
    }
    await tx.done;
  }

  async clearQuizState(userId: string, unitId: string) {
    if (!this.db) await this.init();
    const tx = this.db!.transaction('quizState', 'readwrite');
    const index = tx.store.index('by-user');
    const states = await index.getAll(userId);
    for (const state of states) {
      if (state.unitId === unitId) {
        await tx.store.delete(state.id);
      }
    }
    await tx.done;
  }
}

export const quizStorage = new QuizStorage();
