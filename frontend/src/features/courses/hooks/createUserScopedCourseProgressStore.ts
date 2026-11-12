import { createStore, type StateCreator, type StoreApi } from 'zustand/vanilla';
import { persist } from 'zustand/middleware';
import { useStore } from 'zustand';
import { useAuthStore } from '@/features/auth/store/useAuthStore';
import type { CourseProgressState } from '@/shared/types/courseInterface';

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
            version: 1,
            migrate: (persistedState: unknown) => {
              if (!persistedState || typeof persistedState !== 'object') {
                return {
                  progress: {},
                  bookmarks: [],
                  notes: {},
                } as CourseProgressState;
              }

              const state = persistedState as Partial<CourseProgressState>;
              return {
                ...state,
                progress: state.progress && typeof state.progress === 'object' ? state.progress : {},
                bookmarks: Array.isArray(state.bookmarks)
                  ? state.bookmarks.filter(
                      (bookmark): bookmark is string => typeof bookmark === 'string',
                    )
                  : [],
                notes: state.notes && typeof state.notes === 'object' ? state.notes : {},
              } as CourseProgressState;
            },
            partialize: state => ({
              progress: state.progress,
              bookmarks: state.bookmarks,
              notes: state.notes,
            }),
          }),
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
