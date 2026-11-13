import { createStore, type StateCreator, type StoreApi } from 'zustand/vanilla';
import { persist } from 'zustand/middleware';
import { useStore } from 'zustand';
import { useAuthStore } from '@/features/auth/store/useAuthStore';
import type { CourseProgressState, Note } from '@/shared/types/courseInterface';

type PersistedCourseProgressState = Pick<CourseProgressState, 'progress' | 'bookmarks' | 'notes'>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isNote(value: unknown): value is Note {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.text === 'string' &&
    typeof value.timestamp === 'string'
  );
}

function migrateCourseProgress(persistedState: unknown): PersistedCourseProgressState {
  const state = isRecord(persistedState) ? persistedState : {};
  const progress: Record<string, boolean> = {};
  if (isRecord(state.progress)) {
    for (const [lessonKey, completed] of Object.entries(state.progress)) {
      if (typeof completed === 'boolean') progress[lessonKey] = completed;
    }
  }

  const bookmarks = Array.isArray(state.bookmarks)
    ? [
        ...new Set(
          state.bookmarks.filter((bookmark): bookmark is string => typeof bookmark === 'string')
        ),
      ]
    : [];
  const notes: Record<string, Note[]> = {};
  if (isRecord(state.notes)) {
    for (const [lessonKey, lessonNotes] of Object.entries(state.notes)) {
      if (Array.isArray(lessonNotes)) {
        notes[lessonKey] = lessonNotes.filter(isNote);
      }
    }
  }

  return { progress, bookmarks, notes };
}

function createProgressState(): StateCreator<CourseProgressState> {
  return (set, get) => ({
    progress: {},
    bookmarks: [],
    notes: {},
    markLessonComplete: lessonKey =>
      set(state => ({
        progress: { ...state.progress, [lessonKey]: true },
      })),
    toggleLessonComplete: lessonKey =>
      set(state => ({
        progress: { ...state.progress, [lessonKey]: !state.progress[lessonKey] },
      })),
    toggleBookmark: lessonKey => {
      const current = get().bookmarks || [];
      const bookmarks = current.includes(lessonKey)
        ? current.filter(key => key !== lessonKey)
        : [...current, lessonKey];
      set({ bookmarks });
    },
    saveNote: (lessonKey, noteText) =>
      set(state => ({
        notes: {
          ...state.notes,
          [lessonKey]: [
            ...(state.notes[lessonKey] || []),
            { id: Date.now().toString(), text: noteText, timestamp: new Date().toISOString() },
          ],
        },
      })),
  });
}

export function createUserScopedCourseProgressStore(storageName: string) {
  const stores = new Map<string, StoreApi<CourseProgressState>>();

  function getStore(userId?: string): StoreApi<CourseProgressState> {
    const storeKey = userId ?? '__anonymous__';
    const existingStore = stores.get(storeKey);
    if (existingStore) return existingStore;

    const stateCreator = createProgressState();
    const store = userId
      ? createStore<CourseProgressState>()(
          persist(stateCreator, {
            name: `${storageName}:${encodeURIComponent(userId)}`,
            version: 2,
            migrate: migrateCourseProgress,
            partialize: state => ({
              progress: state.progress,
              bookmarks: state.bookmarks,
              notes: state.notes,
            }),
          })
        )
      : createStore<CourseProgressState>()(stateCreator);
    stores.set(storeKey, store);
    return store;
  }

  return function useUserScopedCourseProgressStore() {
    const userId = useAuthStore(state => state.user?.id);
    return useStore(getStore(userId));
  };
}
