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
  type: 'quiz_submission' | 'progress_log';
  data: unknown;
  timestamp: number;
  attempts: number;
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
const DB_VERSION = 1;

export async function initDB(): Promise<IDBPDatabase<MedicalEducationDB>> {
  return openDB<MedicalEducationDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Quiz Questions store
      const quizStore = db.createObjectStore('quizQuestions', { keyPath: 'id' });
      quizStore.createIndex('by-topic', 'topic');

      // Reading Materials store
      const readingStore = db.createObjectStore('readingMaterials', { keyPath: 'id' });
      readingStore.createIndex('by-topic', 'metadata.topic');

      // Sync Queue store
      const syncStore = db.createObjectStore('syncQueue', { keyPath: 'id' });
      syncStore.createIndex('by-timestamp', 'timestamp');
    },
  });
}
