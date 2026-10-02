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
}

const DB_NAME = 'medical-education-db';
const DB_VERSION = 3;

export async function initDB(): Promise<IDBPDatabase<MedicalEducationDB>> {
  return openDB<MedicalEducationDB>(DB_NAME, DB_VERSION, {
    upgrade(db, _oldVersion, _newVersion, transaction) {
      // Quiz Questions store
      const quizStore = db.createObjectStore('quizQuestions', { keyPath: 'id' });
      quizStore.createIndex('by-topic', 'topic');

      // Reading Materials store
      const readingStore = db.createObjectStore('readingMaterials', { keyPath: 'id' });
      readingStore.createIndex('by-topic', 'metadata.topic');

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
    },
  });
}
