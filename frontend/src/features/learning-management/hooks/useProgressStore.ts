// store/useProgressStore.ts
import { create } from 'zustand';
import { syncService } from '@/lib/core/offline/syncService';

interface Progress {
  id: string;
  userId: string;
  courseId?: string;
  unitId?: string;
  status: 'notStarted' | 'inProgress' | 'completed';
  score?: number;
  lastAccessed: Date;
  lastUpdated?: number; // Track client-side timestamp for conflict resolution
}

interface ProgressState {
  progress: Progress[];
  isLoading: boolean;
  error: string | null;
  pendingSyncIds: Set<string>; // Track items being synced
  syncErrors: Record<string, string>; // Track sync errors per item
  fetchUserProgress: () => Promise<void>;
  updateProgress: (progressData: Partial<Progress>) => Promise<void>;
  getProgressForCourse: (courseId: string) => Progress[];
  getCompletionPercentage: (courseId: string) => number;
  isPending: (progressId: string) => boolean; // Check if item is syncing
  getSyncError: (progressId: string) => string | null; // Get sync error for item
}

export const useProgressStore = create<ProgressState>()((set, get) => ({
  progress: [],
  isLoading: false,
  error: null,
  pendingSyncIds: new Set(),
  syncErrors: {},

  fetchUserProgress: async () => {
    try {
      set({ isLoading: true, error: null });
      const userId = localStorage.getItem('userId'); // Get from auth store in real app
      if (!userId) throw new Error('User not authenticated');

      const progress = (await syncService.getProgress(userId)) as unknown as Progress[];
      set({ progress: progress || [], isLoading: false });
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to fetch progress';
      set({
        error: errorMsg,
        isLoading: false,
      });
    }
  },

  updateProgress: async progressData => {
    try {
      const userId = localStorage.getItem('userId'); // Get from auth store in real app
      if (!userId) throw new Error('User not authenticated');

      const progressId = progressData.id || crypto.randomUUID();
      const lastUpdated = Date.now();

      const progressToSave: Progress = {
        id: progressId,
        userId,
        ...progressData,
        status: progressData.status ?? 'inProgress',
        lastAccessed: new Date(),
        lastUpdated,
      };

      // OPTIMISTIC UI: Update local state immediately
      const updatedProgress = get().progress.map(p =>
        p.id === progressToSave.id ? progressToSave : p
      );

      if (!updatedProgress.find(p => p.id === progressToSave.id)) {
        updatedProgress.push(progressToSave);
      }

      set(state => ({
        progress: updatedProgress,
        pendingSyncIds: new Set([...state.pendingSyncIds, progressId]),
      }));

      // BACKGROUND SYNC: Fire sync without awaiting
      // This happens asynchronously while UI remains responsive
      syncService.saveProgress(progressToSave, lastUpdated).catch(error => {
        const errorMsg = error instanceof Error ? error.message : 'Sync failed';
        set(state => ({
          syncErrors: {
            ...state.syncErrors,
            [progressId]: errorMsg,
          },
        }));
        console.error(`Failed to sync progress ${progressId}:`, error);
      }).finally(() => {
        // Remove from pending when sync completes (success or failure)
        set(state => {
          const newPending = new Set(state.pendingSyncIds);
          newPending.delete(progressId);
          return { pendingSyncIds: newPending };
        });
      });
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to update progress';
      set({
        error: errorMsg,
      });
    }
  },

  getProgressForCourse: courseId => {
    return get().progress.filter(p => p.courseId === courseId);
  },

  getCompletionPercentage: courseId => {
    const courseProgress = get().getProgressForCourse(courseId);
    if (courseProgress.length === 0) return 0;

    const completedUnits = courseProgress.filter(p => p.status === 'completed').length;
    return Math.round((completedUnits / courseProgress.length) * 100);
  },

  isPending: (progressId: string) => {
    return get().pendingSyncIds.has(progressId);
  },

  getSyncError: (progressId: string) => {
    return get().syncErrors[progressId] || null;
  },
}));
