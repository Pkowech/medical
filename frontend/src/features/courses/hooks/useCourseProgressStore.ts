import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {CourseProgressState } from '@/shared/types/courseInterface';

export const useCourseProgressStore = create<CourseProgressState>()(
  persist(
    (set, get) => ({
      progress: {},
      bookmarks: [],
      notes: {},
      markLessonComplete: lessonKey =>
        set(state => ({
          progress: { ...state.progress, [lessonKey]: true },
        })),
      toggleBookmark: lessonKey => {
        const current = get().bookmarks || [];
        const exists = current.includes(lessonKey);
        const newBookmarks = exists ? current.filter(k => k !== lessonKey) : [...current, lessonKey];
        set({ bookmarks: newBookmarks });
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
    }),
    {
      name: 'course-progress-storage', // unique name for localStorage
      version: 1,
      migrate: (persistedState: unknown) => {
        if (!persistedState) return persistedState;
        // Normalize bookmarks: convert Set-like or object to array
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
