import { openDB, DBSchema, IDBPDatabase } from 'idb';

export interface QuizQuestion {
  id: string;
  topic: string;
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  lastUpdated: number;
}

export interface ReadingMaterial {
  id: string;
  title: string;
  content: Blob;
  metadata: {
    author?: string;
    date?: string;
    topic?: string;
  };
  lastUpdated: number;
}

export interface SyncQueueItem {
  id: string;
  type?: 'quiz_submission' | 'progress_log';
  data?: unknown;
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  body?: unknown;
  timestamp: number;
  createdAt: number;
  lastUpdated?: number;
  attempts: number;
  status: 'pending' | 'failed';
  lastError?: string;
  nextAttemptAt?: number;
  userId?: string;
}

export interface PersistedQueryCacheEntry {
  key: string;
  version: number;
  savedAt: number;
  state: unknown;
}

interface MedicalEducationDB extends DBSchema {
  quizQuestions: {
    key: string;
    value: QuizQuestion;
    indexes: { 'by-topic': string };
  };
  readingMaterials: {
    key: string;
    value: ReadingMaterial;
    indexes: { 'by-topic': string };
  };
  syncQueue: {
    key: string;
    value: SyncQueueItem;
    indexes: { 'by-timestamp': number };
  };
  syncLocks: {
    key: string;
    value: {
      name: string;
      owner: string;
      expiresAt: number;
    };
  };
  queryCache: {
    key: string;
    value: PersistedQueryCacheEntry;
  };
}

const DB_NAME = 'medical-education-db';
const DB_VERSION = 5;
let databasePromise: Promise<IDBPDatabase<MedicalEducationDB>> | undefined;

export function initDB(): Promise<IDBPDatabase<MedicalEducationDB>> {
  databasePromise ??= openDB<MedicalEducationDB>(DB_NAME, DB_VERSION, {
    upgrade(db, _oldVersion, _newVersion, transaction) {
      // Quiz Questions store
      if (!db.objectStoreNames.contains('quizQuestions')) {
        const quizStore = db.createObjectStore('quizQuestions', { keyPath: 'id' });
        quizStore.createIndex('by-topic', 'topic');
      } else {
        const quizStore = transaction?.objectStore('quizQuestions');
        if (quizStore && !quizStore.indexNames.contains('by-topic')) {
          quizStore.createIndex('by-topic', 'topic');
        }
      }

      // Reading Materials store
      if (!db.objectStoreNames.contains('readingMaterials')) {
        const readingStore = db.createObjectStore('readingMaterials', { keyPath: 'id' });
        readingStore.createIndex('by-topic', 'metadata.topic');
      } else {
        const readingStore = transaction?.objectStore('readingMaterials');
        if (readingStore && !readingStore.indexNames.contains('by-topic')) {
          readingStore.createIndex('by-topic', 'metadata.topic');
        }
      }

      // Sync Queue store
      if (!db.objectStoreNames.contains('syncQueue')) {
        const syncStore = db.createObjectStore('syncQueue', { keyPath: 'id' });
        syncStore.createIndex('by-timestamp', 'timestamp');
      } else {
        const syncStore = transaction?.objectStore('syncQueue');
        if (syncStore && !syncStore.indexNames.contains('by-timestamp')) {
          syncStore.createIndex('by-timestamp', 'timestamp');
        }
      }

      if (!db.objectStoreNames.contains('syncLocks')) {
        db.createObjectStore('syncLocks', { keyPath: 'name' });
      }

      if (!db.objectStoreNames.contains('queryCache')) {
        db.createObjectStore('queryCache', { keyPath: 'key' });
      }
    },
    blocked() {
      console.warn('[OfflineDB] Upgrade is waiting for another tab to close its database connection.');
    },
    blocking() {
      databasePromise?.then(db => db.close());
      databasePromise = undefined;
    },
  }).catch(error => {
    databasePromise = undefined;
    throw error;
  });

  return databasePromise;
}
