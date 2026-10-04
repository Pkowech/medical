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

export interface LocalFileMetadata {
  id: string;
  filename: string;
  mimetype: string;
  size: number;
  hash: string;
}

export interface SyncQueueItem {
  id: string;
  type?: 'quiz_submission' | 'progress_log' | 'offline_practice_submission';
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

export interface OfflineQuizOption {
  id: string;
  text: string;
}

export interface OfflineQuizQuestion {
  id: string;
  text: string;
  type: 'multiple_choice' | 'multiple_select' | 'true_false';
  difficulty: 'easy' | 'medium' | 'hard';
  options: OfflineQuizOption[];
  explanation?: string;
  points: number;
}

export interface OfflineTopicBundle {
  id: string;
  userId: string;
  courseId: string;
  unitId: string;
  topicId: string;
  title: string;
  description?: string;
  cacheMode?: 'download' | 'session';
  sessionId?: string;
  isComplete?: boolean;
  materialIds: string[];
  downloadedAt: number;
  expiresAt: number;
  totalBytes: number;
}

export interface OfflineTopicMaterial {
  id: string;
  userId: string;
  topicId: string;
  materialId: string;
  title: string;
  description?: string;
  mimeType: 'application/pdf';
  size: number;
  content: Blob;
  cachedAt: number;
}

export interface OfflineTopicQuiz {
  id: string;
  userId: string;
  topicId: string;
  questions: OfflineQuizQuestion[];
  cachedAt: number;
}

export interface OfflinePracticeAttempt {
  id: string;
  userId: string;
  topicId: string;
  responses: Array<{ questionId: string; selectedAnswers: string[] }>;
  status: 'draft' | 'pending' | 'synced' | 'failed';
  score?: number;
  lastError?: string;
  createdAt: number;
  lastUpdated: number;
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
  localFileMetadata: {
    key: string;
    value: LocalFileMetadata;
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
  offlineTopics: {
    key: string;
    value: OfflineTopicBundle;
    indexes: { 'by-user': string };
  };
  offlineTopicMaterials: {
    key: string;
    value: OfflineTopicMaterial;
    indexes: { 'by-user': string; 'by-topic': string };
  };
  offlineTopicQuizzes: {
    key: string;
    value: OfflineTopicQuiz;
    indexes: { 'by-user': string };
  };
  offlinePracticeAttempts: {
    key: string;
    value: OfflinePracticeAttempt;
    indexes: { 'by-user': string; 'by-status': OfflinePracticeAttempt['status'] };
  };
}

const DB_NAME = 'medical-education-db';
const DB_VERSION = 7;
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

      if (!db.objectStoreNames.contains('localFileMetadata')) {
        db.createObjectStore('localFileMetadata', { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains('offlineTopics')) {
        const topics = db.createObjectStore('offlineTopics', { keyPath: 'id' });
        topics.createIndex('by-user', 'userId');
      }

      if (!db.objectStoreNames.contains('offlineTopicMaterials')) {
        const materials = db.createObjectStore('offlineTopicMaterials', { keyPath: 'id' });
        materials.createIndex('by-user', 'userId');
        materials.createIndex('by-topic', 'topicId');
      }

      if (!db.objectStoreNames.contains('offlineTopicQuizzes')) {
        const quizzes = db.createObjectStore('offlineTopicQuizzes', { keyPath: 'id' });
        quizzes.createIndex('by-user', 'userId');
      }

      if (!db.objectStoreNames.contains('offlinePracticeAttempts')) {
        const attempts = db.createObjectStore('offlinePracticeAttempts', { keyPath: 'id' });
        attempts.createIndex('by-user', 'userId');
        attempts.createIndex('by-status', 'status');
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
