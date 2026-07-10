import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { CourseProgressState } from '@/shared/types/courseInterface';

export const useUnitProgressStore = create<CourseProgressState>()(
  persist(
    (set, get) => ({
      progress: {},
      bookmarks: [],
      notes: {},
      markTopicComplete: topicKey =>
        set(state => ({
          progress: { ...state.progress, [topicKey]: true },
        })),
      toggleBookmark: topicKey => {
        const current = get().bookmarks || [];
        const exists = current.includes(topicKey);
        const newBookmarks = exists ? current.filter(k => k !== topicKey) : [...current, topicKey];
        set({ bookmarks: newBookmarks });
      },
      saveNote: (topicKey, noteText) =>
        set(state => ({
          notes: {
            ...state.notes,
            [topicKey]: [
              ...(state.notes[topicKey] || []),
              { id: Date.now().toString(), text: noteText, timestamp: new Date().toISOString() },
            ],
          },
        })),
    }),
    {
      name: 'unit-progress-storage',
      version: 1,
      migrate: (persistedState: unknown) => {
        if (!persistedState) return persistedState;
        const state = persistedState as Record<string, unknown>;
        const bookmarks = state.bookmarks;
        let normalized = bookmarks;
        if (!Array.isArray(bookmarks)) {
          if (bookmarks && typeof bookmarks === 'object') {
            normalized = Object.keys(bookmarks as Record<string, unknown>);
          } else {
            normalized = [];
          }
        }
        return { ...state, bookmarks: normalized };
      },
    }
  )
);
